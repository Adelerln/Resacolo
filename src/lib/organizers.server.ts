import { cache } from 'react';
import { cookies } from 'next/headers';

import {
  normalizeOrganizerAccessRole,
  type OrganizerAccessRole
} from '@/lib/organizer-access';
import { getServerSupabaseClient } from '@/lib/supabase/server';
import { ORGANIZER_COOKIE_NAME, type OrganizerOption, withOrganizerQuery } from '@/lib/organizers';

export { withOrganizerQuery };

const loadOrganizerOptions = cache(async (): Promise<OrganizerOption[]> => {
  const supabase = getServerSupabaseClient();
  const { data, error } = await supabase
    .from('organizers')
    .select('id,name')
    .order('name', { ascending: true });

  if (error) {
    // Pré-rendu / CI : fetch vers Supabase peut échouer sans bloquer le build (liste vide).
    console.warn('Supabase (organizers) indisponible :', error.message);
    return [];
  }

  return (data ?? []).map((organizer) => ({
    id: organizer.id,
    name: organizer.name
  }));
});

export async function getOrganizerOptions() {
  return loadOrganizerOptions();
}

async function loadOrganizerOptionsByIds(organizerIds: string[]): Promise<OrganizerOption[]> {
  if (organizerIds.length === 0) return [];

  const supabase = getServerSupabaseClient();
  const { data, error } = await supabase
    .from('organizers')
    .select('id,name')
    .in('id', organizerIds)
    .order('name', { ascending: true });

  if (error) {
    console.warn('Supabase (organizers filtered) indisponible :', error.message);
    return [];
  }

  return (data ?? []).map((organizer) => ({
    id: organizer.id,
    name: organizer.name
  }));
}

async function loadOrganizerAccessByUserId(appUserId: string): Promise<Map<string, OrganizerAccessRole>> {
  const supabase = getServerSupabaseClient();
  const { data, error } = await supabase
    .from('organizer_backoffice_access')
    .select('organizer_id,role')
    .eq('app_user_id', appUserId)
    .is('revoked_at', null);

  if (error) {
    console.warn('Supabase (organizer_backoffice_access) indisponible :', error.message);
    return new Map();
  }

  const map = new Map<string, OrganizerAccessRole>();
  for (const row of data ?? []) {
    map.set(row.organizer_id, normalizeOrganizerAccessRole(row.role));
  }
  return map;
}

export type ResolveOrganizerSelectionOptions = {
  enforceBackofficeAccess?: boolean;
  appUserId?: string | null;
};

export async function resolveOrganizerSelection(
  requestedOrganizerId?: string | string[],
  fallbackOrganizerId?: string | null,
  options?: ResolveOrganizerSelectionOptions
) {
  const enforceBackofficeAccess = Boolean(options?.enforceBackofficeAccess);
  const appUserId = options?.appUserId?.trim() ?? '';
  const accessByOrganizerId = enforceBackofficeAccess && appUserId
    ? await loadOrganizerAccessByUserId(appUserId)
    : new Map<string, OrganizerAccessRole>();

  const organizers = enforceBackofficeAccess
    ? await loadOrganizerOptionsByIds(Array.from(accessByOrganizerId.keys()))
    : await getOrganizerOptions();
  const cookieStore = await cookies();
  const organizerIdFromCookie = cookieStore.get(ORGANIZER_COOKIE_NAME)?.value ?? null;
  const normalizedRequestedId = Array.isArray(requestedOrganizerId)
    ? requestedOrganizerId[0]
    : requestedOrganizerId;

  const selectedOrganizer =
    organizers.find((organizer) => organizer.id === normalizedRequestedId) ??
    organizers.find((organizer) => organizer.id === fallbackOrganizerId) ??
    organizers.find((organizer) => organizer.id === organizerIdFromCookie) ??
    organizers[0] ??
    null;

  return {
    organizers,
    selectedOrganizer,
    selectedOrganizerId: selectedOrganizer?.id ?? null,
    selectedAccessRole: selectedOrganizer ? accessByOrganizerId.get(selectedOrganizer.id) ?? null : null,
    accessByOrganizerId
  };
}
