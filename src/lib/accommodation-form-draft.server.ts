import { cookies } from 'next/headers';
import { buildAccessibilityInfoFromForm } from '@/lib/accommodation-location';

export const ACCOMMODATION_FORM_DRAFT_COOKIE = 'resacolo_accommodation_form_draft';

export type AccommodationFormDraftValues = {
  name?: string | null;
  accommodation_type?: string | null;
  location_mode?: string | null;
  itinerant_zone?: string | null;
  description?: string | null;
  bed_info?: string | null;
  bathroom_info?: string | null;
  catering_info?: string | null;
  accessibility_info?: string | null;
  address_text?: string | null;
  postal_code?: string | null;
  city?: string | null;
  department_code?: string | null;
  region_text?: string | null;
  country?: string | null;
  center_latitude?: string | null;
  center_longitude?: string | null;
  media_urls?: string[] | null;
  map_iframe_html?: string | null;
};

function readString(formData: FormData, key: string) {
  return String(formData.get(key) ?? '');
}

function parseMediaUrls(raw: FormDataEntryValue | null): string[] {
  const text = String(raw ?? '').trim();
  if (!text) return [];
  try {
    const parsed = JSON.parse(text) as unknown;
    if (Array.isArray(parsed)) {
      return parsed.map((item) => String(item ?? '').trim()).filter(Boolean);
    }
  } catch {
    // fall through
  }
  return text
    .split(/\n|,/)
    .map((item) => item.trim())
    .filter(Boolean);
}

export function buildAccommodationFormDraftFromFormData(
  formData: FormData
): AccommodationFormDraftValues {
  return {
    name: readString(formData, 'name'),
    accommodation_type: readString(formData, 'accommodation_type'),
    location_mode: readString(formData, 'location_mode'),
    itinerant_zone: readString(formData, 'itinerant_zone'),
    description: readString(formData, 'description'),
    bed_info: readString(formData, 'bed_info'),
    bathroom_info: readString(formData, 'bathroom_info'),
    catering_info: readString(formData, 'catering_info'),
    accessibility_info: buildAccessibilityInfoFromForm(formData),
    address_text: readString(formData, 'address_text'),
    postal_code: readString(formData, 'postal_code'),
    city: readString(formData, 'city'),
    department_code: readString(formData, 'department_code'),
    region_text: readString(formData, 'region_text'),
    country: readString(formData, 'country'),
    center_latitude: readString(formData, 'center_latitude'),
    center_longitude: readString(formData, 'center_longitude'),
    media_urls: parseMediaUrls(formData.get('media_urls')),
    map_iframe_html: readString(formData, 'map_iframe_html')
  };
}

export async function stashAccommodationFormDraft(formData: FormData) {
  const draft = buildAccommodationFormDraftFromFormData(formData);
  const serialized = JSON.stringify(draft);
  // Cookie ~4 Ko : tronquer les champs longs si besoin pour éviter un échec silencieux.
  const safe =
    serialized.length > 3500
      ? JSON.stringify({
          ...draft,
          description: (draft.description ?? '').slice(0, 800),
          map_iframe_html: (draft.map_iframe_html ?? '').slice(0, 1200),
          bed_info: (draft.bed_info ?? '').slice(0, 400),
          bathroom_info: (draft.bathroom_info ?? '').slice(0, 400),
          catering_info: (draft.catering_info ?? '').slice(0, 400),
          accessibility_info: (draft.accessibility_info ?? '').slice(0, 400)
        })
      : serialized;

  const cookieStore = await cookies();
  cookieStore.set(ACCOMMODATION_FORM_DRAFT_COOKIE, safe, {
    httpOnly: true,
    sameSite: 'lax',
    path: '/',
    maxAge: 60 * 30,
    secure: process.env.NODE_ENV === 'production'
  });
}

export async function consumeAccommodationFormDraft(): Promise<AccommodationFormDraftValues | null> {
  const cookieStore = await cookies();
  const raw = cookieStore.get(ACCOMMODATION_FORM_DRAFT_COOKIE)?.value;
  if (!raw) return null;

  cookieStore.delete(ACCOMMODATION_FORM_DRAFT_COOKIE);

  try {
    const parsed = JSON.parse(raw) as AccommodationFormDraftValues;
    if (!parsed || typeof parsed !== 'object') return null;
    return parsed;
  } catch {
    return null;
  }
}

export const INVALID_MAP_IFRAME_WARNING =
  'Hébergement enregistré, mais le code iframe Google Maps était invalide et n’a pas été conservé. Utilisez un embed https://www.google.com/maps/.../embed.';
