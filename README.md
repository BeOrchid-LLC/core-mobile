# core-mobile

Mobile reference app. Proves login and permission resolution on the mobile
surface, and demonstrates that the same person holds a **different** effective
permission set here than in `core-web` (§3.1, §6.4, §16).

## Running it

`core-mobile` is its own repository, not a directory inside a larger one — it
depends on `@beorchid/core-sdk` via `file:../core-sdk`, so a sibling checkout
of [`core-sdk`](https://github.com/BeOrchid-LLC/core-sdk) needs to exist
alongside it on disk, built before `core-mobile` can resolve it (it consumes
the SDK's `dist/`, not its source):

```bash
cd ../core-sdk && npm install && npm run build
cd ../core-mobile && npm install
npm start                # then press a for Android, or scan with Expo Go
```

**This sibling-clone pattern has a real gap, not just a local-dev quirk: it
does not survive a cloud build.** EAS Build (or any CI that clones only this
repository) never sees a `../core-sdk` directory, so `npm install` fails
there. `beorchid-core-web` hit the identical problem and fixed it by vendoring
the SDK in as a git submodule instead of a sibling clone — see
[`../beorchid-core-web`](https://github.com/BeOrchid-LLC/beorchid-core-web)'s
`packages/core-sdk` and
[`add-new-app.md`](../beorchid-core/docs/add-new-app.md#7-install-the-core-sdk)
for that pattern. `core-mobile` has not been migrated to it yet — Expo's
per-SDK-version dependency pinning fights the workspace-hoisting that pattern
relies on, so it needs more care here than a direct copy. Until this is
resolved, an EAS cloud build should be expected to fail at install unless
this is fixed first.

It runs today with no Clerk instance and no Core API, using development
stand-ins for both. Sign in with any Clerk user id; the fixture recognises
`user_2ab9k1` (Alice).

`core-mobile` is deliberately **not** a member of the root workspace, so it
installs its own `node_modules`. Expo's dependency versions are pinned per SDK
and would fight the hoisting the other three packages rely on.

## localhost does not exist on a phone

`core-web` runs on the same machine as Core API, so `http://localhost:3000`
works there. On a device or emulator, `localhost` is the *device*.

When Core API does get wired up, use your machine's LAN address, and bind Core
API to all interfaces rather than loopback:

```bash
# macOS
ipconfig getifaddr en0
# Linux
hostname -I | awk '{print $1}'
# Windows
(Get-NetIPAddress -AddressFamily IPv4 -InterfaceAlias Wi-Fi).IPAddress
```

## The two seams

The same two seams as `core-web`, each behind exactly one file. Nothing above
those files knows which implementation is in use.

| Seam | File | Development | Live |
|---|---|---|---|
| Authentication | `src/lib/session.ts` | SecureStore stand-in | Clerk |
| Identity and permissions | `src/lib/core.ts` | `StubCoreClient` | not yet decided — see below |

The seam is a hook here (`useSessionClaims`, `useCoreContext`) where `core-web`'s
is a plain async function. That is not a difference in the model: `core-web`
resolves the session on the server before the page renders, and React Native has
no server to do that on.

Both stand-ins refuse to run outside development. `StubCoreClient` throws in its
constructor when `NODE_ENV` is anything else, and this is verified rather than
assumed — in an `expo export` production bundle the minifier folds the guard to
an unconditional `throw`, because `process.env.NODE_ENV` is inlined as
`"production"`. A release build therefore cannot construct it.

**The consequence is worth stating plainly:** a release build of this app today
resolves nothing and grants nothing. That is correct. There is no agreed way for
mobile to authenticate to Core API yet (below), so there is no configuration in
which a release build should be handing out permissions.

The home screen reports which side each seam is on, so the state is never a
guess.

## How mobile authenticates to Core API — resolved

`core-web` holds `CORE_API_KEY` server-side, where the browser never sees it. A
mobile app has no server side: anything shipped in the bundle is extractable by
anyone who downloads the app, and the Core API key reads any user in the system.

So there is no `EXPO_PUBLIC_CORE_API_KEY`, and `src/lib/core.ts` contains no code
path that reads one — setting it in `.env` cannot silently ship it. Setting
`EXPO_PUBLIC_CORE_API_URL` fails loudly rather than quietly falling back to the
fixture, so nobody concludes they are running against a real Core API when they
are not.

**Resolved and built**, of the three options this section used to list in order
of preference: mobile sends the signed-in user's own Clerk session token
(`Authorization: Bearer <clerk-jwt>`), which Core API verifies itself with
`TokenVerifier`. See `docs/registering-core-mobile.md` for the full mechanism —
`UserTokenCoreClient` here, `core-api/src/middleware/clerk-auth.ts` and
`core-api/src/routes/mobile.ts` (`GET /mobile/v1/me`, mounted outside the
shared-secret-gated `/v1/*` tree) on the server side. Deployed and confirmed
live at `https://api.id.beorchid.ca/mobile/v1/me`.

## Integrating Clerk

When the keys exist, add to `.env`:

```
EXPO_PUBLIC_CLERK_PUBLISHABLE_KEY=pk_test_...
```

Restart. That is the whole change. `isClerkConfigured()` sees a real publishable
key, `ClerkProvider` mounts with a SecureStore token cache, and the sign-in
screen switches from the stand-in to email/password plus Google and Microsoft.

There is no secret key, and there cannot be one.

Two things Clerk cannot supply are still needed for production sign-in: a Google
Cloud OAuth client and a Microsoft Entra ID app registration (§4.2). Configure
the instance per
[`../core-api/docs/clerk-configuration.md`](../core-api/docs/clerk-configuration.md).

**A redirect URL has to be allow-listed before sign-in will work at all.**
`app/sign-in.tsx` calls Clerk with `Linking.createURL('/dashboard')` as the
redirect target — in Expo Go this resolves to something like
`exp://<your-LAN-ip>:8081/--/dashboard`, in a real build to
`beorchidcore:///dashboard`. Either one has to be added under Clerk Dashboard
→ Configure → **Native applications** (a separate page from the Paths shown
under Component paths) before sign-in succeeds — Clerk's error names the exact
URL it rejected if this hasn't been done yet. This is scoped **per Clerk
instance**: an entry added while the dashboard is switched to one instance
(e.g. Production) does not apply to another (e.g. Development) — confirm which
instance `EXPO_PUBLIC_CLERK_PUBLISHABLE_KEY` actually belongs to (`pk_test_` =
development, `pk_live_` = production) before assuming an added URL takes
effect. The Expo Go one also changes with your machine's IP, so expect to
re-add it on a new network; the build-scheme one is stable once added.

**One difference from `core-web` worth knowing before you test OAuth.** `core-web`
uses Clerk's hosted `<SignIn />`, which renders whichever strategies the
dashboard has enabled, so the page cannot drift from the configuration. Expo has
no hosted equivalent, so `app/sign-in.tsx` calls the flows itself and the three
buttons are written into that file. Enabling or disabling a strategy in the
Clerk dashboard will **not** change what this screen shows.

**And one thing that is missing by omission.** `core-web`'s layout renders
Clerk's `OrganizationSwitcher`, which is what puts `org_id` into the session
token and therefore what lets Core resolve permissions against the right
membership (§6.1). Clerk's Expo SDK has no equivalent component. On the
development path this does not bite, because the stand-in session hardcodes
`org_acme`; with real Clerk keys a session can arrive with no organisation, and
the dashboard names that state rather than letting it look like a bug.

## Screens

| Route | Shows |
|---|---|
| `/` | Integration status for both seams, and sign in / sign out |
| `/sign-in` | Clerk's three strategies, or the development stand-in |
| `/dashboard` | Identity, organisation and the effective permission set, all resolved through Core |
| `/leads` | Gated on `leads:read`. The create control appears only with `leads:create`. |

To see enforcement work, sign in as a user the fixture does not know, such as
`user_no_access`, and open `/leads`.

## The demonstration (§16)

The point of this app is that **the same user shows different permissions on web
and mobile**. Alice is `admin` in `core_web` and `viewer` in `core_mobile` — same
person, same organisation, same moment, full access on one surface and read-only
on the other (§6.1a).

Against the fixtures, which needs no database and no Core API:

1. Run `core-web` (`npm run dev:web`) and sign in as `user_2ab9k1`. Open
   `/leads`: `leads:read`, `leads:create` and `leads:delete` are all granted, and
   the create form is present.
2. Run `core-mobile` and sign in as the same `user_2ab9k1`. Open `/leads`:
   `leads:read` is granted, `leads:create` and `leads:delete` are denied, and the
   create control is absent — not disabled, absent.

Both apps read the same `defaultFixture()` from `core-sdk` for Alice, Acme and
the membership, so it is genuinely one identity. `src/lib/core.ts` adds this
app's own `core_mobile: ['leads:read']` entry, because the SDK's fixture names
`core_web` and a placeholder `second_app` and would otherwise resolve
`core_mobile` to no access at all.

Against a real database, once §2.2 is answered, the equivalent is
`npm run db:grant-dev-access -- user_2ab9k1 core_mobile viewer` in `core-api`.
Note the explicit role: that script defaults to `admin`, which would grant Alice
the same set on both surfaces and show nothing.

## What this app may and may not touch

It has **no database connection of any kind** — not to `core`, and not to a
schema of its own. There is no `DATABASE_URL` in this app and there must never be
one. Every fact about identity, organisation and permissions arrives through the
Core SDK (§1.3 principle 2, §5.5).

This is the one place `core-mobile` is not simply `core-web` on another surface:
`core-web` owns `core_web.leads` and reads it as `core_web_rw`. The leads screen
here shows the permission gate and no rows, because Core API serves identity and
permissions rather than any app's business data, and no app-owned API exists in
Milestone 2.

Tokens live in `expo-secure-store` — the iOS Keychain and Android Keystore —
never `AsyncStorage`, which is plaintext on disk. That includes Clerk's token
cache, whose default is in-memory and silently signs users out on restart.

## Known workaround: `jose`

`core-sdk`'s `index.ts` re-exports `./verify`, which imports `jose`. So importing
*anything* from `@beorchid/core-sdk` — even a type — drags `jose` in. Its Node
build imports `node:buffer` and fails to bundle; its browser build is
`export default crypto` at module scope, and neither React Native nor Expo
defines a global `crypto`, so that throws at import.

`metro.config.js` maps `jose` to `src/shims/jose.ts`, which throws if either
symbol is ever called. This app does not verify tokens itself — Clerk's Expo SDK
does — so nothing calls them.

**This is a workaround, not a fix.** The fix belongs in `core-sdk`: either split
`./verify` out of the barrel, or give the package a `react-native` export
condition. It is reported and left alone, since `core-sdk` is under review.

## Out of scope — do not build

- iOS cross-app sessions, App Groups, shared Keychain (§15.3). Instructed but not
  agreed; blocked on the Apple Developer account.
- Android cross-app sessions. Deferred to a written, costed approach document.
- Sign in with Apple. Not in the order. It **will** block App Store submission if
  Google and Microsoft ship without it — flagged, not built. Note that
  `@clerk/clerk-expo` ships a `useSignInWithApple` hook; it is deliberately
  unused.
- App Store or Play Store submission. Not in Milestone 2.
