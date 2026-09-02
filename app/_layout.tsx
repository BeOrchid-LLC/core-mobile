import type { ReactNode } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { Link, Slot, usePathname } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { ClerkProvider } from '@clerk/clerk-expo';
import { tokenCache } from '@clerk/clerk-expo/token-cache';
import { SafeAreaProvider, SafeAreaView } from 'react-native-safe-area-context';
import { isClerkConfigured } from '@/lib/session';
import { usePalette } from '@/lib/theme';

/**
 * ClerkProvider wraps the tree only once Clerk is configured. Before then it is
 * not mounted at all, since it throws without a publishable key — the same
 * arrangement as core-web's layout, for the same reason.
 *
 * The token cache MUST be backed by SecureStore. Clerk's default is in memory,
 * which silently signs the user out on every app restart; SecureStore puts the
 * session token in the iOS Keychain and the Android Keystore instead
 * (Section 4.4). This is Clerk's own SecureStore implementation rather than a
 * hand-written one, so it stays correct as the SDK changes.
 */
function Providers({ children }: { children: ReactNode }) {
  if (!isClerkConfigured()) return <>{children}</>;

  return (
    <ClerkProvider
      publishableKey={process.env.EXPO_PUBLIC_CLERK_PUBLISHABLE_KEY!}
      tokenCache={tokenCache}
    >
      {children}
    </ClerkProvider>
  );
}

/**
 * Mirrors core-web's top nav, minus its account controls.
 *
 * core-web puts Clerk's OrganizationSwitcher up here, and that is not cosmetic:
 * it is what places org_id into the session token, which is what lets Core
 * resolve permissions against the right membership (Section 6.1). Clerk's Expo
 * SDK has no equivalent component, so on the real Clerk path a session can
 * arrive with no organisation. The dashboard names that state rather than
 * letting it read as a bug.
 */
function Nav() {
  const palette = usePalette();
  const pathname = usePathname();

  const links = [
    { href: '/', label: 'Home' },
    { href: '/dashboard', label: 'Dashboard' },
    { href: '/leads', label: 'Leads' },
  ] as const;

  return (
    <View style={[styles.nav, { backgroundColor: palette.surface, borderColor: palette.rule }]}>
      <Text style={[styles.brand, { color: palette.ink }]}>BeOrchid Core</Text>
      {links.map((link) => (
        <Link key={link.href} href={link.href} style={styles.navLink}>
          <Text
            style={{
              color: pathname === link.href ? palette.ink : palette.accent,
              fontSize: 14,
            }}
          >
            {link.label}
          </Text>
        </Link>
      ))}
    </View>
  );
}

export default function RootLayout() {
  return (
    <Providers>
      <SafeAreaProvider>
        <StatusBar style="auto" />
        <SafeAreaView style={styles.root} edges={['top', 'left', 'right']}>
          <Nav />
          <Slot />
        </SafeAreaView>
      </SafeAreaProvider>
    </Providers>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1 },
  nav: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 16,
    paddingHorizontal: 20,
    paddingVertical: 12,
    borderBottomWidth: 1,
  },
  brand: { fontWeight: '600', fontSize: 15 },
  navLink: { paddingVertical: 2 },
});
