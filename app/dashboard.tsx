import { useRouter } from 'expo-router';
import { Banner, Button, Card, Chip, H1, H2, KeyValue, Lede, Muted, P, Pre, Row, Screen } from '@/components/ui';
import { APP_KEY } from '@/lib/core';
import { useCoreContext } from '@/hooks/useCoreContext';

export default function Dashboard() {
  const router = useRouter();
  const { loading, context, error } = useCoreContext();

  if (loading) {
    return (
      <Screen>
        <H1>Dashboard</H1>
        <P>Resolving identity and permissions…</P>
      </Screen>
    );
  }

  // Rendered before the context below, because a failed resolution leaves no
  // permission set to trust and every check against it must deny.
  if (error) {
    return (
      <Screen>
        <H1>Dashboard</H1>
        <Banner tone="dev">Could not resolve this session against Core: {error}</Banner>
        <Muted>
          Nothing is granted while this is unresolved. An unresolved permission set is a denial,
          not a reason to skip the check (Section 6.3).
        </Muted>
      </Screen>
    );
  }

  if (context.state === 'signed-out') {
    return (
      <Screen>
        <H1>Dashboard</H1>
        <P>Not signed in.</P>
        <Row>
          <Button label="Go to sign in" onPress={() => router.push('/sign-in')} />
        </Row>
      </Screen>
    );
  }

  /**
   * Signed in to Clerk, but no core.users row yet.
   *
   * In production this is a brief window while the user.created webhook is in
   * flight (Section 4.6). Locally it lasts until reconciliation runs, because
   * Clerk cannot deliver webhooks to a LAN address any more than to localhost.
   */
  if (context.state === 'unlinked') {
    return (
      <Screen>
        <H1>Dashboard</H1>
        <Banner tone="dev">You are signed in, but this account is not yet known to Core.</Banner>
        <Card>
          <KeyValue
            items={[
              { key: 'Clerk user id', value: context.clerkUserId },
              { key: 'Core identity', value: 'not yet created' },
            ]}
          />
        </Card>
        <P>
          Identity reaches Core through Clerk&apos;s user.created webhook. Clerk cannot deliver
          webhooks to a private network address, so in local development the reconciliation job
          bridges the gap instead.
        </P>
        <Pre>
          {`cd core-api
npm run db:reconcile
npm run db:grant-dev-access -- ${context.clerkUserId} ${APP_KEY} viewer`}
        </Pre>
        <Muted>
          The second command exists because Clerk owns organisations and knows nothing about app
          roles, so a new account arrives with an identity and nothing else. Without an
          organisation there is no membership, and permissions are never a property of a user
          alone.
        </Muted>
        <Muted>
          The role is named explicitly. grant-dev-access defaults to admin, and this app needs
          Alice to be a viewer for the side-by-side demonstration against core-web to show
          anything.
        </Muted>
      </Screen>
    );
  }

  const { user, organization, membership, permissions } = context.context;

  return (
    <Screen>
      <H1>Dashboard</H1>
      <Lede>
        Everything below came from Core. This app holds no identity data, has no read access to
        the core schema, and has no database connection of any kind (Section 5.5).
      </Lede>

      <H2>Identity</H2>
      <Card>
        <KeyValue
          items={[
            { key: 'Core user id', value: user.id },
            { key: 'Clerk user id', value: user.clerkUserId },
            { key: 'Email', value: user.email },
            { key: 'Name', value: user.fullName ?? '—' },
          ]}
        />
      </Card>
      <Muted>
        The Core user id stays the same across every BeOrchid app this person signs into, on any
        surface (Section 4.1a).
      </Muted>

      <H2>Organisation</H2>
      <Card>
        {organization ? (
          <KeyValue
            items={[
              { key: 'Name', value: organization.name },
              { key: 'Slug', value: organization.slug },
              { key: 'Role in org', value: membership?.roleKey ?? '—' },
            ]}
          />
        ) : (
          <>
            <P>No organisation context on this session.</P>
            <Muted>
              Permissions are always evaluated within an organisation (Section 6.1), so without
              one there is nothing to resolve. core-web puts an organisation into the session
              with Clerk&apos;s OrganizationSwitcher; Clerk&apos;s Expo SDK has no equivalent
              component, so on mobile the organisation has to come from the session Clerk already
              issued.
            </Muted>
          </>
        )}
      </Card>

      <H2>Effective permissions in {APP_KEY}</H2>
      <Card>
        {permissions ? (
          <>
            <Muted>Core-wide, from the organisation role:</Muted>
            <Row>
              {permissions.orgWide.length ? (
                permissions.orgWide.map((key) => <Chip key={key} label={key} state="granted" />)
              ) : (
                <Muted>none</Muted>
              )}
            </Row>
            <H2>Scoped to this app only</H2>
            <Row>
              {permissions.appScoped.length ? (
                permissions.appScoped.map((key) => <Chip key={key} label={key} state="granted" />)
              ) : (
                <Muted>none</Muted>
              )}
            </Row>
          </>
        ) : (
          <P>
            No app role assignment for {APP_KEY}, which means no access to it at all. Absence is
            the default deny (Section 6.1a).
          </P>
        )}
      </Card>
      <Muted>
        The same person holds a different set in core_web. That is resolved per app rather than
        tied to identity, which is what Section 6.4 asks the reference apps to demonstrate.
      </Muted>
    </Screen>
  );
}
