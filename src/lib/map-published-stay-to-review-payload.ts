import { mergeDraftExtraOptionsJson } from '@/lib/stay-draft-extra-options-split';
import { collapseTransportDraftOptionsJson } from '@/lib/stay-draft-transport-display';
import { normalizeImportedImageUrlList, normalizeImportedVideoUrlList } from '@/lib/stay-draft-url-extract';
import { sanitizeSeoPrimaryKeyword } from '@/lib/stay-seo';
import { normalizeStayDraftCategories } from '@/lib/stay-categories';
import type { Database } from '@/types/supabase';
import type { StayDraftReviewPayload } from '@/types/stay-draft-review';

type StayRow = Database['public']['Tables']['stays']['Row'];

type SessionRow = {
  id: string;
  start_date: string;
  end_date: string;
  capacity_total: number;
  capacity_reserved: number;
  status: string;
  session_prices:
    | { amount_cents: number; currency: string }
    | { amount_cents: number; currency: string }[]
    | null;
};

type ExtraRow = { id: string; label: string; amount_cents: number; position: number };
type InsuranceRow = {
  id: string;
  label: string;
  amount_cents: number | null;
  percent_value: number | null;
  pricing_mode: string;
};
type TransportRow = {
  id: string;
  departure_city: string | null;
  return_city: string | null;
  amount_cents: number;
};
type MediaRow = { id: string; url: string; position: number | null; media_type: string | null };

function sessionPriceEuros(session: SessionRow): number | null {
  const sp = session.session_prices;
  if (!sp) return null;
  const cents = Array.isArray(sp) ? sp[0]?.amount_cents : sp.amount_cents;
  if (cents == null || !Number.isFinite(cents)) return null;
  return cents / 100;
}

function reservedCountForSession(
  session: SessionRow,
  reservedMap: Map<string, number>
): number {
  return reservedMap.get(session.id) ?? session.capacity_reserved ?? 0;
}

/**
 * Construit le payload « relecture » à partir d’un séjour publié et de ses lignes liées.
 */
export function mapPublishedStayToReviewPayload(input: {
  stay: StayRow;
  sessions: SessionRow[];
  reservedSessionCounts: Map<string, number>;
  extraOptions: ExtraRow[];
  insuranceOptions: InsuranceRow[];
  transportOptions: TransportRow[];
  media: MediaRow[];
}): StayDraftReviewPayload {
  const { stay, sessions, reservedSessionCounts, extraOptions, insuranceOptions, transportOptions, media } =
    input;

  const sessionsJson: Array<Record<string, unknown>> = sessions.map((s) => {
    const reserved = reservedCountForSession(s, reservedSessionCounts);
    const remaining = Math.max(0, s.capacity_total - reserved);
    const price = sessionPriceEuros(s);
    return {
      start_date: s.start_date,
      end_date: s.end_date,
      remaining_places: remaining,
      price: price ?? '',
      currency: 'EUR',
      availability: remaining <= 0 ? 'full' : 'available'
    };
  });

  const extraRows: Array<Record<string, unknown>> = extraOptions.map((o) => ({
    label: o.label,
    price: o.amount_cents / 100,
    currency: 'EUR',
    description: null
  }));

  const insuranceRows: Array<Record<string, unknown>> = insuranceOptions.map((o) => {
    const mode = (o.pricing_mode ?? '').toUpperCase() === 'PERCENT' ? 'PERCENT' : 'FIXED';
    if (mode === 'PERCENT') {
      return {
        label: o.label,
        pricing_mode: 'PERCENT',
        percent_value: o.percent_value,
        price: null,
        currency: 'EUR',
        description: null,
        option_kind: 'insurance'
      };
    }
    return {
      label: o.label,
      pricing_mode: 'FIXED',
      price: o.amount_cents != null ? o.amount_cents / 100 : null,
      percent_value: null,
      currency: 'EUR',
      description: null,
      option_kind: 'insurance'
    };
  });

  const mergedExtras = mergeDraftExtraOptionsJson(extraRows, insuranceRows);

  const transportDraftRows: Array<Record<string, unknown>> = transportOptions.map((row) => {
    const displayCity =
      [row.departure_city, row.return_city].filter(Boolean).join(' → ') ||
      row.departure_city ||
      row.return_city ||
      'Transport';
    return {
      label: displayCity.trim(),
      price: row.amount_cents / 100,
      currency: 'EUR',
      excluded_session_keys: [] as string[]
    };
  });

  const transportCollapsed = collapseTransportDraftOptionsJson(transportDraftRows);

  const imageUrls = normalizeImportedImageUrlList(
    media.filter((m) => (m.media_type ?? '').toLowerCase() !== 'video').map((m) => m.url)
  );
  const videoUrls = normalizeImportedVideoUrlList(
    media.filter((m) => (m.media_type ?? '').toLowerCase() === 'video').map((m) => m.url)
  );

  const categories = normalizeStayDraftCategories(stay.categories ?? []).categories;

  return {
    title: stay.title ?? '',
    summary: stay.summary ?? '',
    location_text: stay.location_text ?? '',
    region_text: stay.region_text ?? '',
    description: stay.description ?? '',
    program_text: stay.program_text ?? '',
    supervision_text: stay.supervision_text ?? '',
    transport_text: stay.transport_text ?? '',
    transport_mode: stay.transport_mode ?? '',
    categories,
    ages: Array.isArray(stay.ages) ? stay.ages : [],
    sessions_json: sessionsJson,
    extra_options_json: mergedExtras,
    transport_options_json: transportCollapsed,
    accommodations_json: null,
    images: imageUrls,
    video_urls: videoUrls,
    seo_primary_keyword: sanitizeSeoPrimaryKeyword(stay.seo_primary_keyword ?? ''),
    seo_secondary_keywords: stay.seo_secondary_keywords ?? [],
    seo_target_city: stay.seo_target_city ?? '',
    seo_target_region: stay.seo_target_region ?? '',
    seo_search_intents: stay.seo_search_intents ?? [],
    seo_title: stay.seo_title ?? '',
    seo_meta_description: stay.seo_meta_description ?? '',
    seo_intro_text: stay.seo_intro_text ?? '',
    seo_h1_variant: stay.seo_h1_variant ?? '',
    seo_internal_link_anchor_suggestions: stay.seo_internal_link_anchor_suggestions ?? [],
    seo_slug_candidate: stay.seo_slug_candidate ?? '',
    seo_score: stay.seo_score != null && Number.isFinite(stay.seo_score) ? stay.seo_score : null,
    seo_checks: (Array.isArray(stay.seo_checks) ? stay.seo_checks : []) as StayDraftReviewPayload['seo_checks'],
    seo_generated_at: stay.seo_generated_at,
    seo_generation_source: stay.seo_generation_source,
    partner_discount_percent:
      stay.partner_discount_percent != null && Number.isFinite(stay.partner_discount_percent)
        ? stay.partner_discount_percent
        : null,
    activities_text: stay.activities_text ?? '',
    required_documents_text: stay.required_documents_text ?? ''
  };
}
