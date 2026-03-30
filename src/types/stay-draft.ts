export type StayDraftStatus = 'pending' | 'ready' | 'failed';

export interface StayDraft {
  id: string;
  organizer_id: string;
  source_url: string;
  title: string | null;
  description: string | null;
  image: string | null;
  raw_text: string | null;
  age_min: number | null;
  age_max: number | null;
  price_from: number | null;
  duration_days: number | null;
  raw_payload: Record<string, unknown> | null;
  status: StayDraftStatus;
  created_at: string;
}
