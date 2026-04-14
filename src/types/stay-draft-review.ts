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
  seo_primary_keyword: string;
  seo_secondary_keywords: string[];
  seo_target_city: string;
  seo_target_region: string;
  seo_search_intents: string[];
  seo_title: string;
  seo_meta_description: string;
  seo_intro_text: string;
  seo_h1_variant: string;
  seo_internal_link_anchor_suggestions: string[];
  seo_slug_candidate: string;
  seo_score: number | null;
  seo_checks: Array<{
    code: string;
    level: 'ok' | 'warning' | 'info';
    message: string;
  }>;
  seo_generated_at?: string | null;
  seo_generation_source?: string | null;
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
  | 'seo_primary_keyword'
  | 'seo_secondary_keywords'
  | 'seo_target_city'
  | 'seo_target_region'
  | 'seo_search_intents'
  | 'seo_title'
  | 'seo_meta_description'
  | 'seo_intro_text'
  | 'seo_h1_variant'
  | 'seo_internal_link_anchor_suggestions'
  | 'seo_slug_candidate'
  | 'seo_score'
  | 'seo_checks'
  | 'video_urls'
  | 'form';

export type StayDraftReviewFieldErrors = Partial<Record<StayDraftReviewFieldErrorKey, string>>;
