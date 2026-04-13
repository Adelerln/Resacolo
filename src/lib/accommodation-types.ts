export const ACCOMMODATION_TYPE_OPTIONS = [
  'centre',
  'auberge de jeunesse',
  'camping',
  "famille d'accueil",
  'mixte'
] as const;

export function formatAccommodationType(value?: string | null) {
  if (!value) return 'Non renseigné';
  return value.charAt(0).toUpperCase() + value.slice(1);
}
