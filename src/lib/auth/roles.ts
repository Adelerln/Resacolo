import type { SupabaseClient } from '@supabase/supabase-js';
import { getServerSupabaseClient } from '@/lib/supabase/server';
import { isMissingAnyColumnError } from '@/lib/supabase-schema-errors';
import type { Database } from '@/types/supabase';

export type AppRole =
  | 'ANONYME'
  | 'CLIENT'
  | 'ORGANISATEUR'
  | 'PARTENAIRE'
  | 'ADMIN'
  | 'ADMIN_SALES'
  | 'MNEMOS';
export type AuthenticatedAppRole = Exclude<AppRole, 'ANONYME'>;

export type ResolvedRoleContext = {
  role: AuthenticatedAppRole;
  staffRoles: string[];
  organizerIds: string[];
  collectivityIds: string[];
  organizerRolesById: Record<string, string>;
  collectivityRolesById: Record<string, string>;
  /** Sous-entité du membre partenaire (null = vue globale du CSE). */
  collectivitySubEntityId: string | null;
  isClient: boolean;
};

const PARTNER_STAFF_ROLES = new Set([
  'PARTNER_ADMIN',
  'PARTNER_BENEFICIARY_MANAGER',
  'PARTNER_AGENT',
  'OWNER'
]);

function normalizeRoleValue(value: string | null | undefined) {
  return String(value ?? '')
    .trim()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toUpperCase();
}

function isPartnerStaffRole(normalizedRole: string) {
  return PARTNER_STAFF_ROLES.has(normalizedRole);
}

function isAdminLikeStaffRole(normalizedRole: string) {
  if (!normalizedRole || isPartnerStaffRole(normalizedRole)) return false;
  return (
    normalizedRole === 'ADMIN' ||
    normalizedRole.includes('PLATFORM_ADMIN') ||
    normalizedRole.includes('SUPPORT') ||
    normalizedRole.includes('ADMIN')
  );
}

function mapStaffRole(staffRoles: string[]): AuthenticatedAppRole | null {
  const normalizedRoles = staffRoles.map(normalizeRoleValue).filter(Boolean);
  if (normalizedRoles.some((role) => role.includes('MNEMOS'))) {
    return 'MNEMOS';
  }
  if (normalizedRoles.some((role) => role === 'SALES_ADMIN' || role === 'ADMIN_SALES')) {
    return 'ADMIN_SALES';
  }
  if (normalizedRoles.some((role) => isAdminLikeStaffRole(role))) {
    return 'ADMIN';
  }
  return null;
}

export const __testables__ = {
  mapStaffRole,
  normalizeRoleValue,
  isAdminLikeStaffRole
};

export async function resolveRoleContextForUserId(
  userId: string,
  supabase: SupabaseClient<Database> = getServerSupabaseClient()
): Promise<ResolvedRoleContext> {
  const normalizedUserId = userId.trim();
  if (!normalizedUserId) {
    throw new Error('Identifiant utilisateur Supabase invalide.');
  }

  const [
    { data: staffRows },
    { data: organizerRows },
    { data: collectivityRows, error: collectivityError },
    { data: clientRow }
  ] = await Promise.all([
    supabase.from('staff_users').select('role').eq('user_id', normalizedUserId),
    supabase.from('organizer_members').select('organizer_id,role').eq('user_id', normalizedUserId),
    supabase
      .from('collectivity_members')
      .select('collectivity_id,role,sub_entity_id')
      .eq('user_id', normalizedUserId),
    supabase.from('clients').select('user_id').eq('user_id', normalizedUserId).maybeSingle()
  ]);

  let membershipRows: Array<{
    collectivity_id: string;
    role: string;
    sub_entity_id: string | null;
  }> = (collectivityRows ?? []).map((row) => ({
    collectivity_id: row.collectivity_id,
    role: row.role,
    sub_entity_id: row.sub_entity_id ?? null
  }));

  if (collectivityError && isMissingAnyColumnError(collectivityError, ['sub_entity_id'])) {
    const { data: legacyMemberships } = await supabase
      .from('collectivity_members')
      .select('collectivity_id,role')
      .eq('user_id', normalizedUserId);
    membershipRows = (legacyMemberships ?? []).map((row) => ({
      collectivity_id: row.collectivity_id,
      role: row.role,
      sub_entity_id: null
    }));
  }

  const staffRoles = (staffRows ?? []).map((row) => row.role).filter(Boolean);
  const organizerIds = Array.from(
    new Set((organizerRows ?? []).map((row) => row.organizer_id).filter(Boolean))
  );
  const partnerMemberships = membershipRows.filter((row) =>
    PARTNER_STAFF_ROLES.has(normalizeRoleValue(row.role))
  );
  const partnerCollectivityIds = Array.from(
    new Set(partnerMemberships.map((row) => row.collectivity_id).filter(Boolean))
  );
  const collectivityIds = Array.from(new Set(partnerCollectivityIds));
  const primaryMembership = partnerMemberships[0] ?? null;
  const collectivitySubEntityId =
    typeof primaryMembership?.sub_entity_id === 'string' && primaryMembership.sub_entity_id.trim()
      ? primaryMembership.sub_entity_id
      : null;

  const staffRole = mapStaffRole(staffRoles);
  const role =
    staffRole ??
    (organizerIds.length > 0
      ? 'ORGANISATEUR'
      : partnerCollectivityIds.length > 0
        ? 'PARTENAIRE'
        : 'CLIENT');

  return {
    role,
    staffRoles,
    organizerIds,
    collectivityIds,
    organizerRolesById: Object.fromEntries(
      (organizerRows ?? []).map((row) => [row.organizer_id, row.role])
    ),
    collectivityRolesById: Object.fromEntries(
      partnerMemberships.map((row) => [row.collectivity_id, row.role])
    ),
    collectivitySubEntityId,
    isClient: Boolean(clientRow) || role === 'CLIENT'
  };
}

export function getHomePathForRole(role: AppRole) {
  switch (role) {
    case 'MNEMOS':
      return '/mnemos';
    case 'ADMIN':
      return '/admin';
    case 'ADMIN_SALES':
      return '/admin';
    case 'ORGANISATEUR':
      return '/organisme';
    case 'PARTENAIRE':
      return '/partenaire';
    case 'CLIENT':
      return '/mon-compte';
    default:
      return '/';
  }
}

export function canAccessBackofficePath(role: AppRole, pathname: string) {
  if (pathname.startsWith('/mnemos')) {
    return role === 'MNEMOS';
  }
  if (pathname.startsWith('/admin')) {
    return role === 'ADMIN' || role === 'ADMIN_SALES' || role === 'MNEMOS';
  }
  if (pathname.startsWith('/organisme')) {
    return role === 'ORGANISATEUR' || role === 'MNEMOS';
  }
  if (pathname.startsWith('/partenaire')) {
    return role === 'PARTENAIRE' || role === 'MNEMOS';
  }
  return true;
}

export function hasRequiredRole(actualRole: AppRole, requiredRole: AuthenticatedAppRole) {
  switch (requiredRole) {
    case 'MNEMOS':
      return actualRole === 'MNEMOS';
    case 'ADMIN':
      return actualRole === 'ADMIN' || actualRole === 'MNEMOS';
    case 'ADMIN_SALES':
      return actualRole === 'ADMIN_SALES' || actualRole === 'ADMIN' || actualRole === 'MNEMOS';
    case 'ORGANISATEUR':
      return actualRole === 'ORGANISATEUR' || actualRole === 'MNEMOS';
    case 'PARTENAIRE':
      return actualRole === 'PARTENAIRE' || actualRole === 'MNEMOS';
    case 'CLIENT':
      return actualRole === 'CLIENT';
    default:
      return false;
  }
}
