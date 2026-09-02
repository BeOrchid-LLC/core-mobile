import { useRouter } from 'expo-router';
import { hasPermission } from '@beorchid/core-sdk';
import { Banner, Button, Card, Chip, H1, H2, Lede, Muted, P, Row, Screen } from '@/components/ui';
import { APP_KEY } from '@/lib/core';
import { useCoreContext } from '@/hooks/useCoreContext';

/**
 * The Section 6.4 demonstration: a screen gated on a specific permission.
 *
 * Read access requires `leads:read`. The create control appears only with
 * `leads:create`. Change the user's app role and what this screen allows changes
 * with it, which is what "permissions are functional, not just stored" means.
 *
 * This is also the Section 16 deliverable — the second reference app showing a
 * different effective permission set for the same user. Alice is admin in
 * core_web and viewer here: same person, same organisation, same moment, full
 * access on one surface and read-only on the other.
 */
export default function Leads() {
  const router = useRouter();
  const { loading, context, error } = useCoreContext();

  if (loading) {
    return (
      <Screen>
        <H1>Leads</H1>
        <P>Resolving permissions…</P>
      </Screen>
    );
  }

  if (error) {
    return (
      <Screen>
        <H1>Leads</H1>
        <Banner tone="dev">Could not resolve permissions: {error}</Banner>
        <Muted>
          Access is refused while this is unresolved. A null or unresolved permission set is a
          denial, never a reason to skip the check (Section 6.3).
        </Muted>
      </Screen>
    );
  }

  if (context.state === 'signed-out') {
    return (
      <Screen>
        <H1>Leads</H1>
        <P>Not signed in.</P>
        <Row>
          <Button label="Go to sign in" onPress={() => router.push('/sign-in')} />
        </Row>
      </Screen>
    );
  }

  if (context.state === 'unlinked') {
    return (
      <Screen>
        <H1>Leads</H1>
        <Banner tone="dev">
          This account is not yet known to Core, so it holds no permissions anywhere.
        </Banner>
        <Row>
          <Button label="See how to link it" onPress={() => router.push('/dashboard')} />
        </Row>
      </Screen>
    );
  }

  const { permissions } = context.context;
  const canRead = hasPermission(permissions, 'leads:read');
  const canCreate = hasPermission(permissions, 'leads:create');
  const canDelete = hasPermission(permissions, 'leads:delete');

  if (!canRead) {
    return (
      <Screen>
        <H1>Leads</H1>
        <Banner tone="dev">
          Access denied. This screen requires leads:read, which this user does not hold in this
          app.
        </Banner>
        <Muted>
          The check ran against the permission set Core resolved for this membership and this app.
          Holding the permission in a different app would not help here (Section 6.1a).
        </Muted>
      </Screen>
    );
  }

  return (
    <Screen>
      <H1>Leads</H1>
      <Lede>
        What this screen allows is decided entirely by the permission set Core resolved for this
        membership in {APP_KEY}. Nothing here is decided locally.
      </Lede>

      <Row>
        <Chip label="leads:read" state="granted" />
        <Chip label="leads:create" state={canCreate ? 'granted' : 'denied'} />
        <Chip label="leads:delete" state={canDelete ? 'granted' : 'denied'} />
      </Row>

      {canCreate && (
        <>
          <H2>Create</H2>
          <Row>
            <Button label="Create lead" onPress={() => undefined} />
          </Row>
        </>
      )}

      <H2>Leads</H2>
      <Card>
        <P>No rows to show.</P>
        <Muted>
          This is not an empty table. core-web reads its rows from its own core_web schema using
          its own database role; this app has no database connection, and Core API serves identity
          and permissions rather than any app&apos;s business data. Rows would arrive here from an
          app-owned API that does not exist in Milestone 2.
        </Muted>
      </Card>

      <Muted>
        The contrast is the point: signed in as the same person, core-web shows leads:create and
        leads:delete granted and this screen does not. One identity, one organisation, two
        effective permission sets, resolved per app (Section 6.1a).
      </Muted>
    </Screen>
  );
}
