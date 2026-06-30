import { enqueueStayImportForDraftRow } from '@/lib/stay-import-jobs';

type StayDraftRow = Record<string, unknown> & {
  id: string;
  source_url: string | null;
  sessions_json: unknown;
  raw_payload: unknown;
};

export async function runStayImportForDraftRow(
  draft: StayDraftRow,
  selectedOrganizerId: string
): Promise<'started' | 'already_running' | 'already_completed' | 'missing_source_url'> {
  return enqueueStayImportForDraftRow(draft, selectedOrganizerId);
}
