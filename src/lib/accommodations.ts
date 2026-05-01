import { getServerSupabaseClient } from '@/lib/supabase/server';

type DeleteAccommodationResult = {
  error?: string;
};

const HTTP_URL_PATTERN = /^https?:\/\//i;

export function parseAccommodationMediaUrls(value: FormDataEntryValue | null): string[] {
  return String(value ?? '')
    .split(/\r?\n/)
    .map((item) => item.trim())
    .filter((item) => item.length > 0 && HTTP_URL_PATTERN.test(item))
    .filter((item, index, array) => array.indexOf(item) === index);
}

export async function replaceAccommodationMedia(input: {
  accommodationId: string;
  urls: string[];
}) {
  const supabase = getServerSupabaseClient();

  const { error: deleteError } = await supabase
    .from('accommodation_media')
    .delete()
    .eq('accommodation_id', input.accommodationId);

  if (deleteError) {
    return { error: deleteError.message };
  }

  if (input.urls.length === 0) {
    return {};
  }

  const { error: insertError } = await supabase.from('accommodation_media').insert(
    input.urls.map((url, index) => ({
      accommodation_id: input.accommodationId,
      url,
      position: index
    }))
  );

  if (insertError) {
    return { error: insertError.message };
  }

  return {};
}

export async function deleteAccommodationForOrganizer(input: {
  accommodationId: string;
  organizerId: string;
}): Promise<DeleteAccommodationResult> {
  const supabase = getServerSupabaseClient();

  const { data: links, error: linksError } = await supabase
    .from('stay_accommodations')
    .select('stay_id')
    .eq('accommodation_id', input.accommodationId);

  if (linksError) {
    return { error: linksError.message };
  }

  const stayIds = Array.from(new Set((links ?? []).map((link) => link.stay_id)));

  if (stayIds.length > 0) {
    const { data: linkedStays, error: staysError } = await supabase
      .from('stays')
      .select('id,title,status')
      .eq('organizer_id', input.organizerId)
      .in('id', stayIds);

    if (staysError) {
      return { error: staysError.message };
    }

    const publishedStays = (linkedStays ?? []).filter((stay) => stay.status === 'PUBLISHED');
    if (publishedStays.length > 0) {
      return {
        error: `Suppression impossible : hébergement lié à un séjour publié (${publishedStays
          .map((stay) => stay.title)
          .join(', ')})`
      };
    }
  }

  const { error: mediaError } = await supabase
    .from('accommodation_media')
    .delete()
    .eq('accommodation_id', input.accommodationId);

  if (mediaError) {
    return { error: mediaError.message };
  }

  const { error: unlinkError } = await supabase
    .from('stay_accommodations')
    .delete()
    .eq('accommodation_id', input.accommodationId);

  if (unlinkError) {
    return { error: unlinkError.message };
  }

  const { error: deleteError } = await supabase
    .from('accommodations')
    .delete()
    .eq('id', input.accommodationId)
    .eq('organizer_id', input.organizerId);

  if (deleteError) {
    return { error: deleteError.message };
  }

  return {};
}
