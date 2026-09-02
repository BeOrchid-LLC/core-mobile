import { useState } from 'react';
import { StyleSheet, TextInput, View } from 'react-native';
import { useRouter } from 'expo-router';
import * as Linking from 'expo-linking';
import { useSSO, useSignIn } from '@clerk/clerk-expo';
import type { OAuthStrategy } from '@clerk/types';
import { Banner, Button, Card, Chip, H1, H2, Muted, P, Row, Screen } from '@/components/ui';
import { mono, usePalette } from '@/lib/theme';
import { isDevAuthAllowed, setDevUser, useSessionClaims } from '@/lib/session';

/**
 * Sign-in (Section 4.2).
 *
 * The three strategies are email and password, Google and Microsoft. On web
 * Clerk's hosted component renders whichever of them the dashboard has enabled,
 * so the page cannot drift from the configuration. Expo has no hosted
 * component, so mobile must call the flows itself — which means this file, not
 * the Clerk dashboard, decides which buttons appear. That is a real difference
 * from core-web and the one place the two surfaces can fall out of step.
 */

function Field(props: {
  label: string;
  value: string;
  onChangeText: (next: string) => void;
  secure?: boolean;
  autoCapitalize?: 'none' | 'sentences';
  keyboardType?: 'default' | 'email-address';
}) {
  const palette = usePalette();
  return (
    <TextInput
      accessibilityLabel={props.label}
      placeholder={props.label}
      placeholderTextColor={palette.inkFaint}
      value={props.value}
      onChangeText={props.onChangeText}
      secureTextEntry={props.secure ?? false}
      autoCapitalize={props.autoCapitalize ?? 'none'}
      autoCorrect={false}
      keyboardType={props.keyboardType ?? 'default'}
      style={[
        styles.input,
        { backgroundColor: palette.surface, borderColor: palette.rule, color: palette.ink },
      ]}
    />
  );
}

function ClerkSignIn() {
  const router = useRouter();
  const { isLoaded, signIn, setActive } = useSignIn();
  const { startSSOFlow } = useSSO();

  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  async function signInWithPassword() {
    if (!isLoaded || !signIn || !setActive) return;
    setBusy(true);
    setError(null);
    try {
      const attempt = await signIn.create({ identifier: email, password });
      if (attempt.status === 'complete' && attempt.createdSessionId) {
        await setActive({ session: attempt.createdSessionId });
        router.replace('/dashboard');
      } else {
        // Multi-factor and other continuation states are Clerk's to drive; this
        // reference app does not reimplement them.
        setError(`Sign-in needs another step: ${attempt.status ?? 'unknown'}`);
      }
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : String(cause));
    } finally {
      setBusy(false);
    }
  }

  async function signInWithProvider(strategy: OAuthStrategy) {
    setBusy(true);
    setError(null);
    try {
      // The system browser, not an embedded webview — required by Google's
      // policy, and credentials are never entered inside this app's own view
      // (Section 4.4). Control returns through the beorchidcore scheme.
      const result = await startSSOFlow({
        strategy,
        redirectUrl: Linking.createURL('/dashboard'),
      });
      if (result.createdSessionId && result.setActive) {
        await result.setActive({ session: result.createdSessionId });
        router.replace('/dashboard');
      }
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : String(cause));
    } finally {
      setBusy(false);
    }
  }

  return (
    <>
      {error ? <Banner tone="dev">{error}</Banner> : null}

      <H2>Email and password</H2>
      <Card>
        <View style={styles.stack}>
          <Field
            label="Work email"
            value={email}
            onChangeText={setEmail}
            keyboardType="email-address"
          />
          <Field label="Password" value={password} onChangeText={setPassword} secure />
          <Button
            label={busy ? 'Signing in…' : 'Sign in'}
            disabled={busy || !isLoaded}
            onPress={() => void signInWithPassword()}
          />
        </View>
      </Card>

      <H2>Or continue with</H2>
      <Row>
        <Button
          label="Google"
          variant="secondary"
          disabled={busy}
          onPress={() => void signInWithProvider('oauth_google')}
        />
        <Button
          label="Microsoft"
          variant="secondary"
          disabled={busy}
          onPress={() => void signInWithProvider('oauth_microsoft')}
        />
      </Row>
      <Muted>
        Google and Microsoft credentials live in the Clerk dashboard, per provider, per instance.
        This app never holds or sees them.
      </Muted>
    </>
  );
}

function DevSignIn() {
  const router = useRouter();
  const session = useSessionClaims();
  const [clerkUserId, setClerkUserId] = useState('user_2ab9k1');
  const [error, setError] = useState<string | null>(null);

  async function signIn() {
    setError(null);
    try {
      await setDevUser(clerkUserId.trim());
      session.refresh();
      router.replace('/dashboard');
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : String(cause));
    }
  }

  return (
    <>
      <Banner tone="dev">
        Clerk is not configured, so this is the development stand-in. With keys present, Clerk
        renders email and password, Google and Microsoft here instead.
      </Banner>

      {error ? <Banner tone="dev">{error}</Banner> : null}

      {isDevAuthAllowed() ? (
        <Card>
          <View style={styles.stack}>
            <Field label="Clerk user id" value={clerkUserId} onChangeText={setClerkUserId} />
            <Button label="Sign in as this user" onPress={() => void signIn()} />
          </View>
        </Card>
      ) : (
        <P>No authentication provider is available in this environment.</P>
      )}

      <H2>What appears here once Clerk is connected</H2>
      <Card>
        <Row>
          <Chip label="email + password" state="neutral" />
          <Chip label="Google" state="neutral" />
          <Chip label="Microsoft" state="neutral" />
        </Row>
        <View style={{ height: 12 }} />
        <Muted>
          Google and Microsoft need OAuth credentials registered in the Clerk dashboard. They are
          held by Clerk, never by this app.
        </Muted>
      </Card>
    </>
  );
}

const SignInBody = isDevAuthAllowed() ? DevSignIn : ClerkSignIn;

export default function SignInScreen() {
  return (
    <Screen>
      <H1>Sign in</H1>
      <SignInBody />
    </Screen>
  );
}

const styles = StyleSheet.create({
  stack: { gap: 12 },
  input: {
    borderWidth: 1,
    borderRadius: 6,
    paddingHorizontal: 12,
    paddingVertical: 10,
    fontFamily: mono,
    fontSize: 14,
  },
});
