import { redirect } from 'next/navigation';
import {
  ORGANIZER_CGV_REQUIRED_MESSAGE,
  organizerHasUploadedCgv
} from '@/lib/organizer-cgv';
import { withOrganizerQuery } from '@/lib/organizers.server';
import { getServerSupabaseClient } from '@/lib/supabase/server';

export async function requireOrganizerCgvForStayCreation(organizerId: string) {
  const supabase = getServerSupabaseClient();
  const hasCgv = await organizerHasUploadedCgv(supabase, organizerId);
  if (hasCgv) return;

  redirect(
    withOrganizerQuery(
      `/organisme/organisateur?error=${encodeURIComponent(ORGANIZER_CGV_REQUIRED_MESSAGE)}`,
      organizerId
    )
  );
}
