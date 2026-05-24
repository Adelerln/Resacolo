import type { SupabaseClient } from '@supabase/supabase-js';
import { getServerSupabaseClient } from '@/lib/supabase/server';
import type { Database } from '@/types/supabase';

export type AppRole = 'ANONYME' | 'CLIENT' | 'ORGANISATEUR' | 'PARTENAIRE' | 'ADMIN' | 'MNEMOS';
export type AuthenticatedAppRole = Exclude<AppRole, 'ANONYME'>;

export type ResolvedRoleContext = {
  role: AuthenticatedAppRole;
  staffRoles: string[];
  organizerIds: string[];
  collectivityIds: string[];
  organizerRolesById: Record<string, string>;
  collectivityRolesById: Record<string, string>;
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

function mapStaffRole(staffRoles: string[]): AuthenticatedAppRole | null {
  const normalizedRoles = staffRoles.map(normalizeRoleValue).filter(Boolean);
  if (normalizedRoles.some((role) => role.includes('MNEMOS'))) {
    return 'MNEMOS';
  }
  if (
    normalizedRoles.some(
      (role) => role === 'ADMIN' || role.includes('PLATFORM_ADMIN') || role.includes('SUPPORT')
    )
  ) {
    return 'ADMIN';
  }
  return normalizedRoles.length > 0 ? 'ADMIN' : null;
}

export async function resolveRoleContextForUserId(
  userId: string,
  supabase: SupabaseClient<Database> = getServerSupabaseClient()
): Promise<ResolvedRoleContext> {
  const normalizedUserId = userId.trim();
  if (!normalizedUserId) {
    throw new Error('Identifiant utilisateur Supabase invalide.');
  }

  const [{ data: staffRows }, { data: organizerRows }, { data: collectivityRows }, { data: clientRow }] =
    await Promise.all([
      supabase.from('staff_users').select('role').eq('user_id', normalizedUserId),
      supabase.from('organizer_members').select('organizer_id,role').eq('user_id', normalizedUserId),
      supabase.from('collectivity_members').select('collectivity_id,role').eq('user_id', normalizedUserId),
      supabase.from('clients').select('user_id').eq('user_id', normalizedUserId).maybeSingle()
    ]);

  const staffRoles = (staffRows ?? []).map((row) => row.role).filter(Boolean);
  const organizerIds = Array.from(
    new Set((organizerRows ?? []).map((row) => row.organizer_id).filter(Boolean))
  );
  const partnerCollectivityIds = Array.from(
    new Set(
      (collectivityRows ?? [])
        .filter((row) => PARTNER_STAFF_ROLES.has(normalizeRoleValue(row.role)))
        .map((row) => row.collectivity_id)
        .filter(Boolean)
    )
  );
  const collectivityIds = Array.from(
    new Set(partnerCollectivityIds)
  );

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
      (collectivityRows ?? []).map((row) => [row.collectivity_id, row.role])
    ),
    isClient: Boolean(clientRow) || role === 'CLIENT'
  };
}

export function getHomePathForRole(role: AppRole) {
  switch (role) {
    case 'MNEMOS':
      return '/mnemos';
    case 'ADMIN':
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
    return role === 'ADMIN' || role === 'MNEMOS';
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
