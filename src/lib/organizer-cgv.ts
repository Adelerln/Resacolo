import type { SupabaseClient } from '@supabase/supabase-js';
import type { Database } from '@/types/supabase';

const ORGANIZER_DOCS_BUCKET = 'organizer-docs';

function buildOrganizerFolder(organizerId: string) {
  return `organizers/${organizerId}`;
}

export async function findOrganizerCgvPath(
  supabase: SupabaseClient<Database>,
  organizerId: string
): Promise<string | null> {
  const folder = buildOrganizerFolder(organizerId);
  const { data, error } = await supabase.storage.from(ORGANIZER_DOCS_BUCKET).list(folder, {
    limit: 100
  });
  if (error || !data?.length) return null;

  const candidates = data
    .filter((file) => typeof file.name === 'string' && /^cgv\./i.test(file.name))
    .sort((a, b) => {
      const aTime = a.updated_at ? new Date(a.updated_at).getTime() : 0;
      const bTime = b.updated_at ? new Date(b.updated_at).getTime() : 0;
      return bTime - aTime;
    });

  const picked = candidates[0];
  if (!picked) return null;
  return `${folder}/${picked.name}`;
}

export async function createOrganizerCgvSignedUrl(
  supabase: SupabaseClient<Database>,
  organizerId: string,
  expiresInSeconds = 60 * 60
): Promise<string | null> {
  const path = await findOrganizerCgvPath(supabase, organizerId);
  if (!path) return null;
  const { data, error } = await supabase.storage
    .from(ORGANIZER_DOCS_BUCKET)
    .createSignedUrl(path, expiresInSeconds);
  if (error) return null;
  return data?.signedUrl ?? null;
}

