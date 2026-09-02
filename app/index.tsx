import { useRouter } from 'expo-router';
import { useClerk } from '@clerk/clerk-expo';
import { Banner, Button, Card, H1, H2, KeyValue, Lede, Muted, Row, Screen } from '@/components/ui';
import { isCoreApiConfigured } from '@/lib/core';
import {
  clearDevUser,
  isClerkConfigured,
  isDevAuthAllowed,
  useSessionClaims,
} from '@/lib/session';

/**
 * Sign-out follows whichever provider issued the session.
 *
 * Clerk's own signOut clears its session and the SecureStore token cache. The
 * development path can only delete its own key, and it is unreachable once
 * Clerk is configured — isDevAuthAllowed() is false the moment a publishable
 * key exists, so a control that can forge or clear a session is not merely
 * hidden, it refuses.
 *
 * Bound once at module load for the same reason as useSessionClaims: hooks
 * cannot be called conditionally, and which side of the seam this build is on
 * cannot change while it runs.
 */
function ClerkSignOut({ onDone }: { onDone: () => void }) {
  const clerk = useClerk();
  return (
    <Button
      label="Sign out"
      variant="secondary"
      onPress={() => {
        void clerk.signOut().then(onDone);
      }}
    />
  );
}

function DevSignOut({ onDone }: { onDone: () => void }) {
  return (
    <Button
      label="Sign out"
      variant="secondary"
      onPress={() => {
        void clearDevUser().then(onDone);
      }}
    />
  );
}

const SignOutControl = isClerkConfigured() ? ClerkSignOut : DevSignOut;

export default function Home() {
  const router = useRouter();
  const session = useSessionClaims();
  const clerk = isClerkConfigured();
  const coreApi = isCoreApiConfigured();

  return (
    <Screen>
      <H1>Mobile reference app</H1>
      <Lede>
        Proves login and permission resolution on the mobile surface, and demonstrates that
        permissions determine what a user can reach (Sections 3.1 and 6.4).
      </Lede>

      <Banner tone={clerk && coreApi ? 'live' : 'dev'}>
        {clerk && coreApi
          ? 'Running against Clerk and the Core API.'
          : clerk
            ? 'Authentication is live against Clerk. Identity and permissions still come from a fixture, not the Core API.'
            : 'Running in development mode. Neither authentication nor permissions come from a real service.'}
      </Banner>

      <H2>Integration status</H2>
      <Card>
        <KeyValue
          items={[
            { key: 'Authentication', value: clerk ? 'Clerk (live)' : 'Development stand-in' },
            {
              key: 'Identity & permissions',
              value: coreApi ? 'Core API (live)' : 'StubCoreClient (fixture)',
            },
            { key: 'Token storage', value: 'expo-secure-store (Keychain / Keystore)' },
            { key: 'Own-schema database', value: 'none — this app has no database access' },
            {
              key: 'Signed in as',
              value: session.loading ? '…' : (session.claims?.clerkUserId ?? 'nobody'),
            },
          ]}
        />
      </Card>
      <Muted>
        Both switches are environment variables. No code above src/lib/session.ts and
        src/lib/core.ts is aware of which side either one is on.
      </Muted>
      <Muted>
        Where core-web connects to its own core_web schema as core_web_rw, this app connects to
        nothing at all. Every fact it shows arrives through Core API (Section 5.5).
      </Muted>

      <H2>{session.claims ? 'You are signed in' : 'Sign in'}</H2>
      {session.claims ? (
        <Row>
          <Button
            label="View identity and permissions"
            onPress={() => router.push('/dashboard')}
          />
          <SignOutControl onDone={session.refresh} />
        </Row>
      ) : (
        <Row>
          <Button label="Go to sign in" onPress={() => router.push('/sign-in')} />
          {!isDevAuthAllowed() && (
            <Muted>Account creation happens in Clerk&apos;s own flow.</Muted>
          )}
        </Row>
      )}
    </Screen>
  );
}
