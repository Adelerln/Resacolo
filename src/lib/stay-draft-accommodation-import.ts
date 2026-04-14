import { ACCOMMODATION_TYPE_OPTIONS } from '@/lib/accommodation-types';
import type { AccommodationLocationMode } from '@/lib/accommodation-location';
import { repairAccommodationImportLocation } from '@/lib/french-department-codes';

const ALLOWED_TYPES = new Set<string>(ACCOMMODATION_TYPE_OPTIONS);

export function defaultAccommodationImportRecord(): Record<string, unknown> {
  return {
    title: '',
    description: '',
    accommodation_types: [] as string[],
    location_mode: null as AccommodationLocationMode | null,
    location_city: '',
    location_department_code: '',
    location_country: '',
    itinerant_zone: '',
    bed_info: '',
    bathroom_info: '',
    catering_info: '',
    pmr_accessible: false
  };
}

export function mergeAccommodationImportRecord(
  base: Record<string, unknown>,
  patch: Record<string, unknown> | null | undefined
): Record<string, unknown> {
  if (!patch || typeof patch !== 'object') return { ...base };
  const next = { ...base, ...patch };
  if (!Array.isArray(next.accommodation_types)) {
    next.accommodation_types = [];
  }
  if (next.pmr_accessible === undefined) {
    next.pmr_accessible = false;
  }
  return repairAccommodationImportLocation(next);
}

export function normalizeAccommodationTypeToken(raw: string): string | null {
  const s = raw.trim().toLowerCase();
  if (ALLOWED_TYPES.has(s)) return s;
  const compact = s.replace(/['’]/g, "'").replace(/\s+/g, ' ');
  if (ALLOWED_TYPES.has(compact)) return compact;
  if (compact.includes('gîte')) return 'gite';
  if (compact === 'famille accueil' || compact.includes("famille d'accueil")) return "famille d'accueil";
  return null;
}

export function normalizeLocationMode(value: unknown): AccommodationLocationMode | null {
  const s = typeof value === 'string' ? value.trim().toLowerCase() : '';
  if (s === 'france' || s === 'abroad' || s === 'itinerant') return s;
  return null;
}
