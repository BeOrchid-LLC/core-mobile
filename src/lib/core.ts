import {
  StubCoreClient,
  UserTokenCoreClient,
  defaultFixture,
  type CoreClient,
  type ResolvedContext,
  type StubFixture,
} from '@beorchid/core-sdk';
import { isClerkConfigured } from './session';

/**
 * THE CORE API SEAM, and the composition root that picks an implementation.
 *
 * Section 5.5: this app has no database access to `core` of any kind, not even
 * read — and unlike core-web it has no database access at all, to any schema.
 * Every fact about who the user is, which organisation they are acting in, and
 * what they may do arrives through this client.
 */

/** This app's key in core.apps. Also its schema name and grant scope. */
export const APP_KEY = 'core_mobile';

let client: CoreClient | null = null;

/**
 * The fixture core-web's stub uses, with this app's own permission set added.
 *
 * The SDK's defaultFixture() names core_web and a placeholder `second_app`, so
 * resolving core_mobile against it unmodified returns null permissions — a
 * correct default deny (Section 6.1a), but it would leave this app's whole
 * reason for existing invisible. Alice, Acme and the membership are reused
 * exactly as core-web has them, because the demonstration depends on it being
 * the same person in the same organisation at the same moment.
 *
 * `leads:read` alone is the `viewer` contrast to core-web's admin set. Same
 * person, full access on one surface, read-only on the other (Section 6.1a).
 */
function mobileFixture(): StubFixture {
  const fixture = defaultFixture();
  return {
    ...fixture,
    permissionsByApp: {
      ...fixture.permissionsByApp,
      [APP_KEY]: ['leads:read'],
    },
  };
}

/**
 * Deliberately NOT the guide's `baseUrl && apiKey` selection.
 *
 * core-web keeps CORE_API_KEY server-side where the browser never sees it. A
 * mobile app has no server side: any key in the bundle is extractable by
 * anyone who downloads it, and the Core API key reads any user in the system.
 * Reading an EXPO_PUBLIC_CORE_API_KEY here would mean that merely setting it
 * in .env silently ships that credential — so this file does not read it, and
 * there is no code path that can.
 *
 * The resolved answer: mobile authenticates every Core API call with the
 * user's OWN Clerk session token (`Authorization: Bearer <clerk-jwt>`), sent
 * by UserTokenCoreClient. Core API verifies that token itself and derives
 * identity and application context from it server-side (core-api's
 * middleware/clerk-auth.ts and routes/mobile.ts) — there is no shared secret
 * anywhere in this path for a client to extract.
 *
 * A real Core API call is therefore only possible when BOTH a URL is set AND
 * Clerk is configured — a token has to exist to send. Setting the URL with
 * the development stand-in still active fails loudly rather than silently
 * sending no credential, since a fake dev clerk_user_id has no JWT behind it
 * for Core API to verify.
 */
export function coreClient(getToken?: () => Promise<string | null>): CoreClient {
  if (client) return client;

  const baseUrl = process.env.EXPO_PUBLIC_CORE_API_URL;

  if (baseUrl && !isClerkConfigured()) {
    throw new Error(
      `EXPO_PUBLIC_CORE_API_URL is set (${baseUrl}), but Clerk is not configured. A real ` +
        'Core API call requires a real, verifiable Clerk session token — the development ' +
        'stand-in has none to present. Set EXPO_PUBLIC_CLERK_PUBLISHABLE_KEY as well, or ' +
        'unset the API URL to run against the fixture.',
    );
  }

  if (baseUrl && isClerkConfigured()) {
    if (!getToken) {
      throw new Error(
        'coreClient() requires a getToken function once a real Core API URL is configured. ' +
          'Pass useSessionClaims().getToken through (see useCoreContext.ts).',
      );
    }
    client = new UserTokenCoreClient({ baseUrl, getToken });
    return client;
  }

  client = new StubCoreClient(mobileFixture());
  return client;
}

/**
 * Named to match core-web so the screens read alike. Real once both a URL and
 * Clerk are configured together — see coreClient()'s guard above for why
 * neither alone is enough.
 */
export function isCoreApiConfigured(): boolean {
  return Boolean(process.env.EXPO_PUBLIC_CORE_API_URL) && isClerkConfigured();
}

/**
 * Three states, not two, because "signed out" and "signed in but not yet known
 * to Core" need different handling and produce different screens.
 *
 * The third state is ordinary rather than exceptional: Clerk creates the
 * account, and the webhook that projects it into core.users arrives moments
 * later (Section 4.6). A person can legitimately open the app in between.
 */
export type CurrentContext =
  | { state: 'signed-out' }
  | { state: 'unlinked'; clerkUserId: string }
  | { state: 'resolved'; context: ResolvedContext };
