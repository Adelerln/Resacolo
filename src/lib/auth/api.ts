import type { AppRole } from '@/lib/auth/session';

export async function requireApiRole(req: Request, role: AppRole) {
  void req;
  void role;
  return null;
}

export async function requireApiAdmin(req: Request) {
  return requireApiRole(req, 'ADMIN');
}
