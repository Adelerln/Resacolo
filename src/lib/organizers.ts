import { cache } from 'react';
import { getServerSupabaseClient } from '@/lib/supabase/server';

export type OrganizerOption = {
  id: string;
  name: string;
};

const loadOrganizerOptions = cache(async (): Promise<OrganizerOption[]> => {
  const supabase = getServerSupabaseClient();
  const { data, error } = await supabase
    .from('organizers')
    .select('id,name')
    .order('name', { ascending: true });

  if (error) {
    console.error('Erreur Supabase (organizers)', error.message);
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
  const normalizedRequestedId = Array.isArray(requestedOrganizerId)
    ? requestedOrganizerId[0]
    : requestedOrganizerId;

  const selectedOrganizer =
    organizers.find((organizer) => organizer.id === normalizedRequestedId) ??
    organizers.find((organizer) => organizer.id === fallbackOrganizerId) ??
    organizers[0] ??
    null;

  return {
    organizers,
    selectedOrganizer,
    selectedOrganizerId: selectedOrganizer?.id ?? null
  };
}

export function withOrganizerQuery(path: string, organizerId?: string | null) {
  if (!organizerId) return path;
  const separator = path.includes('?') ? '&' : '?';
  return `${path}${separator}organizerId=${encodeURIComponent(organizerId)}`;
}
