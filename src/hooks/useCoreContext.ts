import { useCallback, useEffect, useState } from 'react';
import { AppState } from 'react-native';
import { APP_KEY, coreClient, type CurrentContext } from '@/lib/core';
import { useSessionClaims } from '@/lib/session';

/**
 * Resolves the current session to identity, organisation and effective
 * permissions. One call, per Section 5.6, so a screen never assembles this from
 * several round trips.
 *
 * core-web does this in a server component before the page renders. React
 * Native has no server, so the same work becomes a hook with loading and error
 * states. The answer is held in memory for the session and re-resolved when the
 * app returns to the foreground, because a permission may have been revoked
 * while it was backgrounded — Section 6.3 requires a revocation to take effect
 * at once rather than after a timeout.
 */
export interface CoreContextState {
  loading: boolean;
  context: CurrentContext;
  /** Non-null when resolution failed. Screens must render this before reading context. */
  error: string | null;
  refresh: () => void;
}

export function useCoreContext(): CoreContextState {
  const session = useSessionClaims();
  const [context, setContext] = useState<CurrentContext>({ state: 'signed-out' });
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [reloadCount, setReloadCount] = useState(0);

  const refresh = useCallback(() => setReloadCount((count) => count + 1), []);

  const clerkUserId = session.claims?.clerkUserId ?? null;
  const clerkOrgId = session.claims?.clerkOrgId ?? null;

  useEffect(() => {
    if (session.loading) {
      setLoading(true);
      return;
    }

    if (!clerkUserId) {
      setContext({ state: 'signed-out' });
      setError(null);
      setLoading(false);
      return;
    }

    let active = true;
    setLoading(true);

    void (async () => {
      try {
        // session.getToken is read here rather than added to this effect's
        // dependency list on purpose: coreClient() is a module-level
        // singleton that only ever consumes getToken on its FIRST
        // construction call, so re-running this effect every time Clerk
        // hands back a new function reference for the same capability would
        // add nothing but risk — Clerk's useAuth() does not guarantee a
        // stable reference across renders, and depending on it here could
        // re-trigger this effect (and its state updates) every render.
        const resolved = await coreClient(session.getToken).resolveContext(
          clerkUserId,
          APP_KEY,
          clerkOrgId ?? undefined,
        );
        if (!active) return;
        setError(null);
        setContext(
          resolved ? { state: 'resolved', context: resolved } : { state: 'unlinked', clerkUserId },
        );
      } catch (cause) {
        if (!active) return;
        // Default deny (Section 6.3). A failed resolution discards the previous
        // answer rather than serving it on: continuing to honour a permission
        // set we can no longer confirm is exactly the revocation gap this is
        // re-resolved on foreground to close.
        setError(cause instanceof Error ? cause.message : String(cause));
        setContext({ state: 'unlinked', clerkUserId });
      } finally {
        if (active) setLoading(false);
      }
    })();

    return () => {
      active = false;
    };
  }, [session.loading, clerkUserId, clerkOrgId, reloadCount]);

  useEffect(() => {
    const subscription = AppState.addEventListener('change', (next) => {
      if (next === 'active') refresh();
    });
    return () => subscription.remove();
  }, [refresh]);

  return { loading, context, error, refresh };
}
