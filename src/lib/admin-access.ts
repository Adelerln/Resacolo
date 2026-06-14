import type { AppRole } from '@/lib/auth/roles';

export type AdminWorkspaceSection =
  | 'dashboard'
  | 'stays'
  | 'accommodations'
  | 'finances'
  | 'reservations'
  | 'users'
  | 'organizers'
  | 'partners';

export type AdminWorkspaceRole = Extract<AppRole, 'ADMIN' | 'MNEMOS' | 'ADMIN_SALES'>;

const ADMIN_ACCESS_SECTIONS: Record<AdminWorkspaceRole, AdminWorkspaceSection[]> = {
  ADMIN: ['dashboard', 'stays', 'accommodations', 'finances', 'reservations', 'users', 'organizers', 'partners'],
  MNEMOS: ['dashboard', 'stays', 'accommodations', 'finances', 'reservations', 'users', 'organizers', 'partners'],
  ADMIN_SALES: ['dashboard', 'reservations', 'partners']
};

export const ADMIN_NAV_LINKS: Array<{ href: string; label: string; section: AdminWorkspaceSection }> = [
  { href: '/admin', label: 'Dashboard', section: 'dashboard' },
  { href: '/admin/sejours', label: 'Séjours', section: 'stays' },
  { href: '/admin/hebergements', label: 'Hébergements', section: 'accommodations' },
  { href: '/admin/finances', label: 'Recettes', section: 'finances' },
  { href: '/admin/reservations', label: 'Réservations', section: 'reservations' },
  { href: '/admin/utilisateurs', label: 'Utilisateurs', section: 'users' },
  { href: '/admin/organizers', label: 'Organismes', section: 'organizers' },
  { href: '/admin/partenaires', label: 'Partenaires', section: 'partners' }
];

export function isAdminWorkspaceRole(role: AppRole): role is AdminWorkspaceRole {
  return role === 'ADMIN' || role === 'MNEMOS' || role === 'ADMIN_SALES';
}

export function canAccessAdminSection(role: AdminWorkspaceRole, section: AdminWorkspaceSection) {
  return ADMIN_ACCESS_SECTIONS[role].includes(section);
}

export function canMutateAdminSection(role: AdminWorkspaceRole, section: AdminWorkspaceSection) {
  if (role === 'ADMIN' || role === 'MNEMOS') return true;
  if (role === 'ADMIN_SALES') return section === 'partners';
  return false;
}

export function getAdminSectionFromPath(pathname: string): AdminWorkspaceSection {
  if (pathname === '/admin' || pathname === '/admin/') return 'dashboard';
  if (pathname.startsWith('/admin/sejours')) return 'stays';
  if (pathname.startsWith('/admin/hebergements')) return 'accommodations';
  if (pathname.startsWith('/admin/finances')) return 'finances';
  if (pathname.startsWith('/admin/reservations')) return 'reservations';
  if (pathname.startsWith('/admin/utilisateurs')) return 'users';
  if (pathname.startsWith('/admin/organizers')) return 'organizers';
  if (pathname.startsWith('/admin/partenaires')) return 'partners';
  return 'dashboard';
}

export function getAdminNavLinksForRole(role: AdminWorkspaceRole) {
  return ADMIN_NAV_LINKS.filter((link) => canAccessAdminSection(role, link.section));
}
