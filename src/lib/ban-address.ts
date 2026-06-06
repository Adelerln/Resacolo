export type CityAddressSelection = {
  city: string;
  postalCode: string | null;
  department: string | null;
  region: string | null;
  country: string | null;
};

type BanAddressProperties = {
  city?: string;
  name?: string;
  label?: string;
  postcode?: string;
  context?: string;
};

export function parseBanMunicipalitySelection(
  properties: BanAddressProperties | undefined | null
): CityAddressSelection | null {
  if (!properties) return null;

  const city =
    properties.city?.trim() ||
    properties.name?.trim() ||
    properties.label?.split(',')[0]?.trim() ||
    null;
  if (!city) return null;

  const contextParts = (properties.context ?? '')
    .split(',')
    .map((part) => part.trim())
    .filter(Boolean);

  const departmentCode = contextParts[0] ?? null;
  const departmentName = contextParts[1] ?? null;
  const region = contextParts[2] ?? null;

  return {
    city,
    postalCode: properties.postcode?.trim() || null,
    department: departmentName || departmentCode,
    region,
    country: 'France'
  };
}
