import { formatAccommodationType } from '@/lib/accommodation-types';
import { extractAccommodationLocationMeta } from '@/lib/accommodation-location';

type AccommodationOptionSourceRow = {
  id: string;
  name: string;
  accommodation_type?: string | null;
  address_text?: string | null;
  postal_code?: string | null;
  city?: string | null;
  department_code?: string | null;
  region_text?: string | null;
  country?: string | null;
  description?: string | null;
};

export type OrganizerAccommodationOption = {
  id: string;
  name: string;
  accommodationType: string | null;
  label: string;
  meta: string | null;
  locationLabel: string | null;
  description: string | null;
  searchText: string;
};

function normalizeSearchPart(value: string | null | undefined): string {
  return String(value ?? '')
    .replace(/\s+/g, ' ')
    .trim();
}

export function buildOrganizerAccommodationOptions(
  rows: AccommodationOptionSourceRow[],
  organizerName?: string | null
): OrganizerAccommodationOption[] {
  return rows.map((row) => {
    const location = extractAccommodationLocationMeta(row.description, {
      addressText: row.address_text,
      postalCode: row.postal_code,
      city: row.city,
      departmentCode: row.department_code,
      regionText: row.region_text,
      country: row.country
    });
    const typeLabel = row.accommodation_type
      ? formatAccommodationType(row.accommodation_type)
      : null;
    const meta = [typeLabel, location.locationLabel].filter(Boolean).join(' · ') || null;

    return {
      id: row.id,
      name: row.name,
      accommodationType: row.accommodation_type ?? null,
      label: row.name,
      meta,
      locationLabel: location.locationLabel,
      description: row.description?.trim() || null,
      searchText: [
        row.name,
        typeLabel,
        location.locationLabel,
        row.city,
        row.region_text,
        row.country,
        organizerName
      ]
        .map((value) => normalizeSearchPart(value))
        .filter(Boolean)
        .join(' ')
    };
  });
}
