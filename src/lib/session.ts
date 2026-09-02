import { useCallback, useEffect, useState } from 'react';
import * as SecureStore from 'expo-secure-store';
import { useAuth } from '@clerk/clerk-expo';
import type { SessionClaims } from '@beorchid/core-sdk';

/**
 * THE AUTH SEAM.
 *
 * Web carries the token in a cookie managed by Clerk's SDK; mobile carries it
 * in an Authorization header (Section 3.3). That is the ONLY difference between
 * the surfaces. Everything above this file asks for SessionClaims and receives
 * them, without knowing whether Clerk or the development stand-in produced them.
 *
 * To go live with Clerk: set the publishable key in .env and restart. No file
 * above this one changes.
 */

/**
 * Clerk is considered configured when a real publishable key is present.
 * Absence is what selects the development path, so a missing key can never
 * silently fall through to "authenticated".
 */
export function isClerkConfigured(): boolean {
  const key = process.env.EXPO_PUBLIC_CLERK_PUBLISHABLE_KEY;
  return typeof key === 'string' && key.startsWith('pk_');
}

export function isDevAuthAllowed(): boolean {
  return __DEV__ && !isClerkConfigured();
}

const DEV_USER_KEY = 'beorchid_dev_user';

/**
 * SecureStore, never AsyncStorage, for anything token-shaped (Section 4.4).
 * SecureStore is the iOS Keychain and the Android Keystore; AsyncStorage is
 * plaintext on disk. The dev user id is not a token, but it selects an
 * identity, and keeping both in the same store means there is no second
 * storage habit for a real credential to be written into by mistake.
 */

/** Development stand-in only. Mirrors core-web's dev cookie. */
export async function setDevUser(clerkUserId: string): Promise<void> {
  if (!isDevAuthAllowed()) throw new Error('Development sign-in is not available.');
  await SecureStore.setItemAsync(DEV_USER_KEY, clerkUserId);
  notifyDevSessionChanged();
}

export async function clearDevUser(): Promise<void> {
  await SecureStore.deleteItemAsync(DEV_USER_KEY);
  notifyDevSessionChanged();
}

export async function getDevSession(): Promise<SessionClaims | null> {
  if (!isDevAuthAllowed()) return null; // never falls through to "authenticated"
  const devUser = await SecureStore.getItemAsync(DEV_USER_KEY);
  if (!devUser) return null;
  const now = Math.floor(Date.now() / 1000);
  return {
    clerkUserId: devUser,
    clerkOrgId: 'org_acme', // matches the seeded fixture
    sessionId: 'dev_session',
    issuedAt: now,
    expiresAt: now + 3600,
  };
}

/**
 * The seam is a hook here, where core-web's is a plain async function.
 *
 * Not a difference in the model: core-web resolves the session on the server
 * before the page renders, and React Native has no server to do that on, so the
 * only place claims can be read is inside the component tree. Clerk's own
 * session lives behind hooks for the same reason. Callers still ask one
 * question and get SessionClaims back.
 */
export interface SessionState {
  loading: boolean;
  claims: SessionClaims | null;
  /** Re-reads the session. Sign-in and sign-out call this through the store. */
  refresh: () => void;
  /**
   * The current session's raw Clerk JWT, or null when there is none to
   * present. This is what src/lib/core.ts sends to Core API as
   * `Authorization: Bearer <token>` on the real (non-stub) path — never an
   * EXPO_PUBLIC_CORE_API_KEY, which does not exist and must not.
   *
   * Only the Clerk path ever returns a usable token: the development
   * stand-in has no signed JWT, because it never talks to a real Core API
   * (src/lib/core.ts refuses that combination outright).
   */
  getToken: () => Promise<string | null>;
}

type Listener = () => void;
const devSessionListeners = new Set<Listener>();

function notifyDevSessionChanged(): void {
  for (const listener of devSessionListeners) listener();
}

function useDevSessionClaims(): SessionState {
  const [claims, setClaims] = useState<SessionClaims | null>(null);
  const [loading, setLoading] = useState(true);
  const [reloadCount, setReloadCount] = useState(0);

  const refresh = useCallback(() => setReloadCount((count) => count + 1), []);

  useEffect(() => {
    let active = true;
    setLoading(true);
    void getDevSession().then((next) => {
      if (!active) return;
      setClaims(next);
      setLoading(false);
    });
    return () => {
      active = false;
    };
  }, [reloadCount]);

  // SecureStore cannot be subscribed to, so the writers announce themselves.
  // Without this a screen that signed in would keep rendering the signed-out
  // view until something else happened to remount it.
  useEffect(() => {
    devSessionListeners.add(refresh);
    return () => {
      devSessionListeners.delete(refresh);
    };
  }, [refresh]);

  // No real Clerk session exists on this path, so there is no JWT to hand
  // Core API. src/lib/core.ts never reaches a real Core API while the
  // development stand-in is active, so this is never called in practice —
  // returning null rather than a fabricated string keeps that true even if
  // something upstream changes.
  const getToken = useCallback(async () => null, []);

  return { loading, claims, refresh, getToken };
}

function useClerkSessionClaims(): SessionState {
  const { isLoaded, userId, orgId, sessionId, getToken } = useAuth();

  // Clerk's SDK has already verified the token's signature locally against
  // cached JWKS before this runs (Section 4.5), and it keeps its own state
  // current, so there is nothing for refresh() to re-read.
  const refresh = useCallback(() => {}, []);

  return {
    loading: !isLoaded,
    refresh,
    getToken,
    claims: userId
      ? {
          clerkUserId: userId,
          clerkOrgId: orgId ?? undefined,
          sessionId: sessionId ?? undefined,
          // Clerk verified exp and iat before handing these over; carrying its
          // numbers here would invite a second, weaker check above this file.
          issuedAt: 0,
          expiresAt: 0,
        }
      : null,
  };
}

/**
 * Chosen once at module load, not per render.
 *
 * The publishable key is inlined into the bundle at build time, so which side
 * of the seam this app is on cannot change while it runs. Binding the choice
 * here means useAuth() is only ever called in a build that has a ClerkProvider
 * above it, and React sees the same hook on every render either way.
 */
export const useSessionClaims: () => SessionState = isClerkConfigured()
  ? useClerkSessionClaims
  : useDevSessionClaims;
