import { AccountSecurityPanel } from '@/components/auth/AccountSecurityPanel';
import OrganizerPageHeader from '@/components/organisme/OrganizerPageHeader';
import { getCurrentUser } from '@/lib/auth/session';
import { requireOrganizerPageAccess } from '@/lib/organizer-backoffice-access.server';

export const metadata = {
  title: 'Sécurité du compte'
};

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

type SecurityAction = 'menu' | 'password' | 'email';

function normalizeAction(value: string | undefined): SecurityAction {
  if (value === 'password' || value === 'email') return value;
  return 'menu';
}

export default async function OrganismeSecurityPage({
  searchParams
}: {
  searchParams?: Promise<{ action?: string; organizerId?: string | string[] }>;
}) {
  const resolved = searchParams ? await searchParams : undefined;
  await requireOrganizerPageAccess({
    requestedOrganizerId: resolved?.organizerId
  });

  const session = await getCurrentUser();
  const action = normalizeAction(resolved?.action);
  const basePath = '/organisme/securite';

  return (
    <div className="space-y-6">
      <OrganizerPageHeader
        title="Sécurité du compte"
        subtitle={
          session?.email
            ? `Connecté en tant que ${session.email}. Modifiez votre mot de passe ou votre e-mail.`
            : 'Modifiez votre mot de passe ou votre e-mail de connexion.'
        }
      />
      <AccountSecurityPanel
        currentEmail={session?.email ?? ''}
        action={action}
        basePath={basePath}
        className="organizer-card p-4 sm:p-6"
      />
    </div>
  );
}
