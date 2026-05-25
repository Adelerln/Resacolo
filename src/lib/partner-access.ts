export type PartnerAccessRole = 'PARTNER_ADMIN' | 'PARTNER_BENEFICIARY_MANAGER';
export type StoredPartnerMembershipRole = 'OWNER' | 'PARTNER_AGENT';
export const PARTNER_MEMBERSHIP_ROLE_CONSTRAINT_MESSAGE =
  "Le schéma Supabase de collectivity_members doit être mis à jour pour autoriser les rôles partenaire.";

export type PartnerWorkspaceSection =
  | 'dashboard'
  | 'partner-profile'
  | 'beneficiaries'
  | 'catalog'
  | 'financing'
  | 'white-label'
  | 'reservations';

export const DEFAULT_PARTNER_ACCESS_ROLE: PartnerAccessRole = 'PARTNER_ADMIN';
export const PARTNER_ACCESS_ROLE_VALUES = [
  'PARTNER_ADMIN',
  'PARTNER_BENEFICIARY_MANAGER'
] as const;

export const PARTNER_ACCESS_LABELS: Record<PartnerAccessRole, string> = {
  PARTNER_ADMIN: 'Admin',
  PARTNER_BENEFICIARY_MANAGER: 'Gestion bénéficiaires et réservations'
};

const PARTNER_ACCESS_SECTIONS: Record<PartnerAccessRole, PartnerWorkspaceSection[]> = {
  PARTNER_ADMIN: [
    'dashboard',
    'partner-profile',
    'beneficiaries',
    'catalog',
    'financing',
    'white-label',
    'reservations'
  ],
  PARTNER_BENEFICIARY_MANAGER: ['dashboard', 'beneficiaries', 'reservations']
};

const PARTNER_NAV_LINKS: Array<{
  href: string;
  label: string;
  section: PartnerWorkspaceSection;
}> = [
  { href: '/partenaire', label: 'Dashboard', section: 'dashboard' },
  { href: '/partenaire/fiche', label: 'Fiche partenaire', section: 'partner-profile' },
  { href: '/partenaire/beneficiaires', label: 'Bénéficiaires', section: 'beneficiaries' },
  { href: '/partenaire/catalogue', label: 'Catalogue', section: 'catalog' },
  { href: '/partenaire/financement', label: 'Financement', section: 'financing' },
  { href: '/partenaire/marque-blanche', label: 'Marque blanche', section: 'white-label' },
  { href: '/partenaire/reservations', label: 'Réservations', section: 'reservations' }
];

export function isPartnerAccessRole(value: string | null | undefined): value is PartnerAccessRole {
  return typeof value === 'string' && (PARTNER_ACCESS_ROLE_VALUES as readonly string[]).includes(value);
}

export function normalizePartnerAccessRole(value: string | null | undefined): PartnerAccessRole {
  if (value === 'OWNER' || value === 'PARTNER_ADMIN') return 'PARTNER_ADMIN';
  if (value === 'PARTNER_AGENT' || value === 'PARTNER_BENEFICIARY_MANAGER') {
    return 'PARTNER_BENEFICIARY_MANAGER';
  }
  return DEFAULT_PARTNER_ACCESS_ROLE;
}

export function toStoredPartnerMembershipRole(role: PartnerAccessRole): StoredPartnerMembershipRole {
  return role === 'PARTNER_ADMIN' ? 'OWNER' : 'PARTNER_AGENT';
}

export function isCollectivityMembersRoleConstraintError(error: { message?: string; code?: string } | null | undefined) {
  const message = String(error?.message ?? '');
  return error?.code === '23514' && message.includes('collectivity_members_role_check');
}

export function canAccessPartnerSection(role: PartnerAccessRole, section: PartnerWorkspaceSection) {
  return PARTNER_ACCESS_SECTIONS[role].includes(section);
}

export function getPartnerNavLinks(role: PartnerAccessRole) {
  return PARTNER_NAV_LINKS.filter((link) => canAccessPartnerSection(role, link.section));
}

export function getPartnerSectionFromPath(pathname: string): PartnerWorkspaceSection {
  if (pathname === '/partenaire' || pathname === '/partenaire/') return 'dashboard';
  if (pathname.startsWith('/partenaire/fiche')) return 'partner-profile';
  if (pathname.startsWith('/partenaire/beneficiaires')) return 'beneficiaries';
  if (pathname.startsWith('/partenaire/catalogue')) return 'catalog';
  if (pathname.startsWith('/partenaire/financement')) return 'financing';
  if (pathname.startsWith('/partenaire/marque-blanche')) return 'white-label';
  if (pathname.startsWith('/partenaire/reservations')) return 'reservations';
  return 'dashboard';
}

export function canAccessPartnerPath(role: PartnerAccessRole, pathname: string) {
  return canAccessPartnerSection(role, getPartnerSectionFromPath(pathname));
}

export function getPartnerAccessRoleFromSession(session: {
  tenantId?: string | null;
  collectivityRolesById: Record<string, string>;
}) {
  const membershipRole = session.tenantId ? session.collectivityRolesById[session.tenantId] : null;
  return normalizePartnerAccessRole(membershipRole);
}
