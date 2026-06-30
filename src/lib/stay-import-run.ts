import { runStayImportInBackground } from '@/lib/run-stay-import-background';
import {
  isStayImportAlreadyRunning,
  readStayImportAccommodationId,
  readStayImportIncludePricing,
  shouldKickOffStayImport
} from '@/lib/stay-import-progress';
import { getServerSupabaseClient } from '@/lib/supabase/server';

type StayDraftRow = Record<string, unknown> & {
  id: string;
  source_url: string | null;
  raw_payload: unknown;
};

export async function runStayImportForDraftRow(
  draft: StayDraftRow,
  selectedOrganizerId: string
): Promise<'started' | 'already_running' | 'already_completed' | 'missing_source_url'> {
  const rawPayload = draft.raw_payload;
  if (!shouldKickOffStayImport(rawPayload)) {
    if (isStayImportAlreadyRunning(rawPayload)) {
      return 'already_running';
    }
    return 'already_completed';
  }

  const sourceUrl = String(draft.source_url ?? '').trim();
  if (!sourceUrl) {
    return 'missing_source_url';
  }

  const accommodationId = readStayImportAccommodationId(rawPayload);
  let selectedAccommodation: { id: string; name: string } | null = null;

  if (accommodationId) {
    const supabase = getServerSupabaseClient();
    const { data: accommodation } = await supabase
      .from('accommodations')
      .select('id,name')
      .eq('id', accommodationId)
      .eq('organizer_id', selectedOrganizerId)
      .maybeSingle();
    if (accommodation) {
      selectedAccommodation = accommodation;
    }
  }

  await runStayImportInBackground({
    draftId: draft.id,
    sourceUrl,
    selectedOrganizerId,
    selectedAccommodation,
    includePricing: readStayImportIncludePricing(rawPayload),
    draftColumnKeys: Object.keys(draft)
  });

  return 'started';
}
