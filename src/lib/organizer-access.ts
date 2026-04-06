export type OrganizerAccessRole = 'OWNER' | 'EDITOR' | 'RESERVATION_MANAGER';

export type OrganizerWorkspaceSection =
  | 'dashboard'
  | 'organizer-profile'
  | 'stays'
  | 'accommodations'
  | 'reservations';

export const ORGANIZER_ACCESS_COOKIE_NAME = 'resacolo_organizer_access_role';
export const DEFAULT_ORGANIZER_ACCESS_ROLE: OrganizerAccessRole = 'EDITOR';

export const ORGANIZER_ACCESS_LABELS: Record<OrganizerAccessRole, string> = {
  OWNER: 'Propriétaire',
  EDITOR: 'Éditeur',
  RESERVATION_MANAGER: 'Gestionnaire'
};

const ORGANIZER_ACCESS_SECTIONS: Record<OrganizerAccessRole, OrganizerWorkspaceSection[]> = {
  OWNER: ['dashboard', 'organizer-profile', 'stays', 'accommodations', 'reservations'],
  EDITOR: ['dashboard', 'stays', 'accommodations', 'reservations'],
  RESERVATION_MANAGER: ['dashboard', 'reservations']
};

const ORGANIZER_NAV_LINKS: Array<{
  href: string;
  label: string;
  section: OrganizerWorkspaceSection;
}> = [
  { href: '/organisme', label: 'Dashboard', section: 'dashboard' },
  { href: '/organisme/organisateur', label: 'Fiche organisateur', section: 'organizer-profile' },
  { href: '/organisme/sejours', label: 'Séjours', section: 'stays' },
  { href: '/organisme/hebergements', label: 'Hébergements', section: 'accommodations' },
  { href: '/organisme/reservations', label: 'Réservations', section: 'reservations' }
];

export function isOrganizerAccessRole(value: string | null | undefined): value is OrganizerAccessRole {
  return value === 'OWNER' || value === 'EDITOR' || value === 'RESERVATION_MANAGER';
}

export function normalizeOrganizerAccessRole(
  value: string | null | undefined
): OrganizerAccessRole {
  return isOrganizerAccessRole(value) ? value : DEFAULT_ORGANIZER_ACCESS_ROLE;
}

export function canAccessOrganizerSection(
  role: OrganizerAccessRole,
  section: OrganizerWorkspaceSection
) {
  return ORGANIZER_ACCESS_SECTIONS[role].includes(section);
}

export function getOrganizerNavLinks(role: OrganizerAccessRole) {
  return ORGANIZER_NAV_LINKS.filter((link) => canAccessOrganizerSection(role, link.section));
}

export function getOrganizerSectionFromPath(pathname: string): OrganizerWorkspaceSection {
  if (pathname === '/organisme' || pathname === '/organisme/') return 'dashboard';
  if (pathname.startsWith('/organisme/organisateur')) return 'organizer-profile';
  if (pathname.startsWith('/organisme/sejours') || pathname.startsWith('/organisme/stays')) {
    return 'stays';
  }
  if (pathname.startsWith('/organisme/hebergements')) return 'accommodations';
  if (pathname.startsWith('/organisme/reservations')) return 'reservations';
  return 'dashboard';
}

export function canAccessOrganizerPath(role: OrganizerAccessRole, pathname: string) {
  return canAccessOrganizerSection(role, getOrganizerSectionFromPath(pathname));
}
