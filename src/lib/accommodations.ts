import { getServerSupabaseClient } from '@/lib/supabase/server';

type DeleteAccommodationResult = {
  error?: string;
};

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
