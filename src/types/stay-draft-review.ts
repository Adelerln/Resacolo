export type StayDraftReviewPayload = {
  title: string;
  summary: string;
  location_text: string;
  region_text: string;
  description: string;
  program_text: string;
  supervision_text: string;
  transport_text: string;
  transport_mode: string;
  categories: string[];
  ages: number[];
  sessions_json: Array<Record<string, unknown>>;
  extra_options_json: Array<Record<string, unknown>>;
  transport_options_json: Array<Record<string, unknown>>;
  accommodations_json: Record<string, unknown> | null;
  images: string[];
  video_urls: string[];
};

export type StayDraftReviewFieldErrorKey =
  | 'title'
  | 'summary'
  | 'location_text'
  | 'region_text'
  | 'description'
  | 'program_text'
  | 'supervision_text'
  | 'transport_text'
  | 'transport_mode'
  | 'categories'
  | 'ages'
  | 'sessions_json'
  | 'extra_options_json'
  | 'transport_options_json'
  | 'accommodations_json'
  | 'images'
  | 'video_urls'
  | 'form';

export type StayDraftReviewFieldErrors = Partial<Record<StayDraftReviewFieldErrorKey, string>>;
