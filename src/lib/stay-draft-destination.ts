import { normalizeStayDestination, normalizeStayDestinationCountries, normalizeStayDestinationType } from '@/lib/stay-destination';

type RawPayload = Record<string, unknown>;

function asString(value: unknown) {
  return typeof value === 'string' ? value.trim() : '';
}

export function readDraftDestinationFields(rawPayload: RawPayload) {
  return normalizeStayDestination({
    destinationType: asString(rawPayload.destination_type) || null,
    destinationCity: asString(rawPayload.destination_city) || null,
    destinationPostalCode: asString(rawPayload.destination_postal_code) || null,
    destinationDepartmentCode: asString(rawPayload.destination_department_code) || null,
    destinationRegion: asString(rawPayload.destination_region) || null,
    destinationCountry: asString(rawPayload.destination_country) || null,
    destinationItineraryLabel: asString(rawPayload.destination_itinerary_label) || null,
    destinationCountries: normalizeStayDestinationCountries(rawPayload.destination_countries)
  });
}

export function writeDraftDestinationFields(
  rawPayload: RawPayload,
  destination: {
    destination_type?: string | null;
    destination_city?: string | null;
    destination_postal_code?: string | null;
    destination_department_code?: string | null;
    destination_region?: string | null;
    destination_country?: string | null;
    destination_itinerary_label?: string | null;
    destination_countries?: string[] | null;
  }
) {
  const normalized = normalizeStayDestination({
    destinationType: destination.destination_type,
    destinationCity: destination.destination_city,
    destinationPostalCode: destination.destination_postal_code,
    destinationDepartmentCode: destination.destination_department_code,
    destinationRegion: destination.destination_region,
    destinationCountry: destination.destination_country,
    destinationItineraryLabel: destination.destination_itinerary_label,
    destinationCountries: destination.destination_countries ?? []
  });

  return {
    ...rawPayload,
    destination_type: normalizeStayDestinationType(normalized.destinationType) ?? null,
    destination_city: normalized.destinationCity,
    destination_postal_code: normalized.destinationPostalCode,
    destination_department_code: normalized.destinationDepartmentCode,
    destination_region: normalized.destinationRegion,
    destination_country: normalized.destinationCountry,
    destination_itinerary_label: normalized.destinationItineraryLabel,
    destination_countries:
      normalized.destinationCountries.length > 0 ? normalized.destinationCountries : null
  };
}
