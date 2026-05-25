import { redirect } from 'next/navigation';
import { getCurrentUser, type SessionPayload } from '@/lib/auth/session';
import {
  getHomePathForRole,
  hasRequiredRole,
  type AppRole,
  type AuthenticatedAppRole
} from '@/lib/auth/roles';
import {
  canAccessAdminSection,
  isAdminWorkspaceRole,
  type AdminWorkspaceSection
} from '@/lib/admin-access';

type RequireOptions = {
  loginPath?: string;
};

function redirectToLogin(loginPath: string): never {
  redirect(loginPath);
}

function redirectToAuthorizedHome(role: AppRole): never {
  redirect(getHomePathForRole(role));
}

export async function requireAuth(options?: RequireOptions): Promise<SessionPayload> {
  const session = await getCurrentUser();
  if (!session) {
    redirectToLogin(options?.loginPath ?? '/login');
  }
  return session;
}

export async function requireRole(
  role: AuthenticatedAppRole,
  options?: RequireOptions
): Promise<SessionPayload> {
  const session = await getCurrentUser();
  if (!session) {
    redirectToLogin(options?.loginPath ?? (role === 'CLIENT' ? '/login/familles' : '/login'));
  }
  if (!hasRequiredRole(session.role, role)) {
    redirectToAuthorizedHome(session.role);
  }
  return session;
}

export async function requireAnyRole(
  roles: AuthenticatedAppRole[],
  options?: RequireOptions
): Promise<SessionPayload> {
  const session = await getCurrentUser();
  if (!session) {
    redirectToLogin(options?.loginPath ?? '/login');
  }
  if (!roles.some((role) => hasRequiredRole(session.role, role))) {
    redirectToAuthorizedHome(session.role);
  }
  return session;
}

export async function requireMnemos(options?: RequireOptions) {
  return requireRole('MNEMOS', options);
}

export async function requireAdminOrMnemos(options?: RequireOptions) {
  return requireAnyRole(['ADMIN', 'MNEMOS'], options);
}

export async function requireOrganizer(options?: RequireOptions) {
  return requireRole('ORGANISATEUR', {
    ...options,
    loginPath: options?.loginPath ?? '/login/organisateur'
  });
}

export async function requirePartner(options?: RequireOptions) {
  return requireRole('PARTENAIRE', options);
}

export async function requireAdminSection(section: AdminWorkspaceSection, options?: RequireOptions) {
  const session = await requireAnyRole(['ADMIN', 'ADMIN_SALES', 'MNEMOS'], options);
  if (!isAdminWorkspaceRole(session.role) || !canAccessAdminSection(session.role, section)) {
    redirectToAuthorizedHome(session.role);
  }
  return session;
}
