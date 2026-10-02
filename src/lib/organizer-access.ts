export type OrganizerAccessRole = 'OWNER' | 'EDITOR' | 'RESERVATION_MANAGER';

export type OrganizerWorkspaceSection =
  | 'dashboard'
  | 'organizer-profile'
  | 'stays'
  | 'accommodations'
  | 'reservations'
  | 'partner-amounts'
  | 'inquiries'
  | 'support'
  | 'users';

export const ORGANIZER_ACCESS_COOKIE_NAME = 'resacolo_organizer_access_role';
export const DEFAULT_ORGANIZER_ACCESS_ROLE: OrganizerAccessRole = 'EDITOR';
export const ORGANIZER_ACCESS_ROLE_VALUES = [
  'OWNER',
  'EDITOR',
  'RESERVATION_MANAGER'
] as const;

export const ORGANIZER_ACCESS_LABELS: Record<OrganizerAccessRole, string> = {
  OWNER: 'Propriétaire',
  EDITOR: 'Éditeur',
  RESERVATION_MANAGER: 'Gestionnaire'
};

const ORGANIZER_ACCESS_SECTIONS: Record<OrganizerAccessRole, OrganizerWorkspaceSection[]> = {
  OWNER: [
    'dashboard',
    'organizer-profile',
    'stays',
    'accommodations',
    'reservations',
    'partner-amounts',
    'inquiries',
    'support',
    'users'
  ],
  EDITOR: ['dashboard', 'stays', 'accommodations', 'reservations', 'partner-amounts', 'inquiries', 'support'],
  RESERVATION_MANAGER: ['dashboard', 'reservations', 'partner-amounts', 'inquiries', 'support']
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
  { href: '/organisme/reservations', label: 'Réservations', section: 'reservations' },
  { href: '/organisme/montants-partenaires', label: 'Montants partenaires', section: 'partner-amounts' },
  { href: '/organisme/demandes', label: 'Demandes', section: 'inquiries' },
  { href: '/organisme/assistance', label: 'Assistance technique', section: 'support' },
  { href: '/organisme/utilisateurs', label: 'Utilisateurs', section: 'users' }
];

export function isOrganizerAccessRole(value: string | null | undefined): value is OrganizerAccessRole {
  return (
    typeof value === 'string' &&
    (ORGANIZER_ACCESS_ROLE_VALUES as readonly string[]).includes(value)
  );
}

export function normalizeOrganizerAccessRole(
  value: string | null | undefined
): OrganizerAccessRole {
  return isOrganizerAccessRole(value) ? value : DEFAULT_ORGANIZER_ACCESS_ROLE;
}

export type OrganizerSectionAccessOptions = {
  canManageOrganizerProfile?: boolean;
};

export function canAccessOrganizerSection(
  role: OrganizerAccessRole,
  section: OrganizerWorkspaceSection,
  options?: OrganizerSectionAccessOptions
) {
  if (section === 'organizer-profile') {
    if (role === 'OWNER') return true;
    return Boolean(options?.canManageOrganizerProfile);
  }
  return ORGANIZER_ACCESS_SECTIONS[role].includes(section);
}

export function getOrganizerNavLinks(
  role: OrganizerAccessRole,
  options?: OrganizerSectionAccessOptions
) {
  return ORGANIZER_NAV_LINKS.filter((link) =>
    canAccessOrganizerSection(role, link.section, options)
  );
}

export function getOrganizerSectionFromPath(pathname: string): OrganizerWorkspaceSection {
  if (pathname === '/organisme' || pathname === '/organisme/') return 'dashboard';
  if (pathname.startsWith('/organisme/organisateur')) return 'organizer-profile';
  if (pathname.startsWith('/organisme/sejours') || pathname.startsWith('/organisme/stays')) {
    return 'stays';
  }
  if (pathname.startsWith('/organisme/hebergements')) return 'accommodations';
  if (pathname.startsWith('/organisme/reservations')) return 'reservations';
  if (pathname.startsWith('/organisme/montants-partenaires')) return 'partner-amounts';
  if (pathname.startsWith('/organisme/demandes')) return 'inquiries';
  if (pathname.startsWith('/organisme/assistance')) return 'support';
  if (pathname.startsWith('/organisme/utilisateurs')) return 'users';
  return 'dashboard';
}

export function canAccessOrganizerPath(role: OrganizerAccessRole, pathname: string) {
  return canAccessOrganizerSection(role, getOrganizerSectionFromPath(pathname));
}
