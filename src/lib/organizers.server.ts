import { cache } from 'react';
import { cookies } from 'next/headers';

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

export async function resolveOrganizerSelection(
  requestedOrganizerId?: string | string[],
  fallbackOrganizerId?: string | null
) {
  const organizers = await getOrganizerOptions();
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
    selectedOrganizerId: selectedOrganizer?.id ?? null
  };
}

