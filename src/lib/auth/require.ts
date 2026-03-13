import { redirect } from 'next/navigation';
import { getSession, type AppRole, type SessionPayload } from '@/lib/auth/session';
import { mockOrganizerTenant, mockPartnerTenant } from '@/lib/mocks';

export function requireRole(role: AppRole): SessionPayload {
  if (process.env.MOCK_UI === '1' || process.env.DISABLE_AUTH === '1') {
    const tenantId =
      role === 'ORGANISATEUR'
        ? mockOrganizerTenant.id
        : role === 'PARTENAIRE'
          ? mockPartnerTenant.id
          : 'mock-tenant';
    return {
      userId: 'mock-user',
      email: 'mock@resacolo.com',
      role,
      tenantId
    };
  }
  const session = getSession();
  if (!session || session.role !== role) {
    redirect('/login');
  }
  return session;
}

export function requireAnyRole(): SessionPayload {
  if (process.env.MOCK_UI === '1' || process.env.DISABLE_AUTH === '1') {
    return {
      userId: 'mock-user',
      email: 'mock@resacolo.com',
      role: 'ADMIN'
    };
  }
  const session = getSession();
  if (!session) redirect('/login');
  return session;
}
