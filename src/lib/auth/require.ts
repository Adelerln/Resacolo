import { getSession, type AppRole, type SessionPayload } from '@/lib/auth/session';
import { mockOrganizerTenant, mockPartnerTenant } from '@/lib/mocks';

function buildBypassSession(role: AppRole): SessionPayload {
  const tenantId =
    role === 'ORGANISATEUR'
      ? mockOrganizerTenant.id
      : role === 'PARTENAIRE'
        ? mockPartnerTenant.id
        : null;

  return {
    userId: 'backoffice-user',
    email: 'backoffice@resacolo.com',
    name: 'Backoffice',
    role,
    tenantId
  };
}

export async function requireRole(role: AppRole): Promise<SessionPayload> {
  const session = await getSession();
  if (session?.role === role) return session;
  return buildBypassSession(role);
}

export async function requireAnyRole(): Promise<SessionPayload> {
  const session = await getSession();
  return session ?? buildBypassSession('ADMIN');
}
