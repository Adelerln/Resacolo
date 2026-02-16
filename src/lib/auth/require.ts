import { redirect } from 'next/navigation';
import { getSession, type AppRole, type SessionPayload } from '@/lib/auth/session';

export function requireRole(role: AppRole): SessionPayload {
  const session = getSession();
  if (!session || session.role !== role) {
    redirect('/login');
  }
  return session;
}

export function requireAnyRole(): SessionPayload {
  const session = getSession();
  if (!session) redirect('/login');
  return session;
}
