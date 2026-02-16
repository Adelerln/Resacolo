import { redirect } from 'next/navigation';
import { getSession, type AppRole, type SessionPayload } from '@/lib/auth/session';

export function requireRole(role: AppRole): SessionPayload {
  if (process.env.MOCK_UI === '1') {
    return {
      userId: 'mock-user',
      email: 'mock@resacolo.com',
      role,
      tenantId: 'mock-tenant'
    };
  }
  const session = getSession();
  if (!session || session.role !== role) {
    redirect('/login');
  }
  return session;
}

export function requireAnyRole(): SessionPayload {
  if (process.env.MOCK_UI === '1') {
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
