# Registering `core_mobile` in Core

**Still not executed against a real database.** The decision that blocked this
is resolved (below); what remains is running it, which needs a Postgres
instance this change was not made against. No `.env` exists in `core-api` in
this environment and no local PostgreSQL is installed, so the steps below are
written to be run, not run here.

## The decision that was blocking this

Mobile has no server side to hold a shared secret on, so it cannot authenticate
to Core API the way `core-web` does (`CORE_API_KEY`, held server-side). The
resolved approach: every mobile request carries the signed-in user's **own**
Clerk session token (`Authorization: Bearer <clerk-jwt>`), and Core API
verifies that token itself — see:

- `core-api/src/middleware/clerk-auth.ts` — JWT verification against Clerk's
  JWKS, never a client-supplied `clerk_user_id`.
- `core-api/src/routes/mobile.ts` — `GET /mobile/v1/me`, mounted OUTSIDE the
  `/v1/*` tree `app-auth.ts`'s shared secret guards. The calling app is fixed
  to `core_mobile` in code, never taken from a client-supplied header or
  parameter.
- `core-mobile/src/lib/core.ts` — `UserTokenCoreClient`, which sends the
  token obtained through the existing session seam.

There is still no `EXPO_PUBLIC_CORE_API_KEY` anywhere in `core-mobile`, and
there cannot be one — that constraint did not change, only the mechanism that
satisfies it did.

## Steps, when a database exists

### 1 & 2. Register the app and seed its permission data

Both now happen together, idempotently, via the existing dev fixture script —
this is the "make it survive a clean seed" gap this document used to flag as
left for whoever owns `core-api`. It is done:

```bash
cd core-api
npm run db:seed-dev
```

This registers `core_mobile` in `core.apps` (via `connect-app.ts`, called
internally — with an empty password, so its database role stays `NOLOGIN`:
unlike every other app, `core_mobile` never connects to any schema, so it gets
no credential that would go unused), creates its own `leads:read` permission
row scoped to `core_mobile`'s `app_id` (a distinct row from `core_web`'s
`leads:read`, per Section 5.2's per-app scoping), links it to the `viewer`
role, and assigns Alice `viewer` on `core_mobile` while she keeps `admin` on
`core_web` — the Section 6.4 demonstration.

To do the same by hand, or against a database `seed-dev.ts` refuses to touch
(anything but `development`):

```bash
npx tsx scripts/connect-app.ts core_mobile "Core Mobile Reference App"
npm run db:grant-dev-access -- user_2ab9k1 core_mobile viewer
```

**The role must be stated explicitly.** `grant-dev-access.ts` defaults to
`admin`, which would make Alice an admin on mobile too and the demonstration
would show nothing.

### 3. Clerk and API key configuration

No API key to configure for mobile — that is the point of the JWT-verification
approach. What Core API needs instead:

```
CLERK_JWKS_URL=<Clerk instance JWKS endpoint>
CLERK_ISSUER=<Clerk instance issuer URL>
```

Both are already read by `core-api/src/config.ts` and used by
`middleware/clerk-auth.ts`. `core_web` already needs these same two values for
`core-sdk`'s `TokenVerifier`, so no new Clerk-side configuration is required —
see `core-api/docs/clerk-configuration.md`.

### 4. Point the app at a real Core API

```bash
# core-mobile/.env
EXPO_PUBLIC_CLERK_PUBLISHABLE_KEY=pk_test_...
EXPO_PUBLIC_CORE_API_URL=http://<your-LAN-address>:3000
```

Both together, or neither — `src/lib/core.ts` refuses a URL set without a real
Clerk session, since there would be no JWT to present.

## Known defects — re-verify before relying on this list

This section previously listed four defects. One of them,

> `/v1/permissions/resolve` accepts an arbitrary `app_id` with no check
> against the calling app

no longer describes the code — `core-api/src/routes/v1/identity.ts` rejects a
`app_id` that disagrees with the caller with a 403. Either it was fixed after
this was written, or something here is still missed; it was not re-verified
line by line. That endpoint is moot for mobile regardless: `/mobile/v1/me`
takes no `app_id` parameter at all — there is nothing for a client to disagree
with the server about, which is the point of giving mobile its own route
rather than validating a parameter on a shared one.

The remaining three, not re-verified either, from the original writing:

| Defect | Effect |
|---|---|
| `connect-app.ts` cannot run as the migration role — no `INSERT` on `core.apps`, no `CREATEROLE` | Works locally as superuser only. Will fail in staging. |
| No sequence grants issued for app schemas | A `bigserial` insert fails with `permission denied for sequence` |
| `core-api` webhook handler broken — `svix` v2's `verify()` returns `undefined` | Every Clerk event 500s, so identity will not populate from webhooks. Use `npm run db:reconcile` and `npm run db:seed-dev`. |

Confirm each against the current `core-api` before treating it as still true.

## Per-app database role naming

Unaffected by any of the above. `core_mobile` has no database role that can
log in — `seed-dev.ts` and the manual command above both pass no password, so
`connect-app.ts` creates the role `NOLOGIN` and stops. The name
(`core_mobile_rw`) exists in `core.apps.db_role` for consistency with every
other app row, but nothing ever authenticates as it.
