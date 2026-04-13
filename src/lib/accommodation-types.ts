export const ACCOMMODATION_TYPE_OPTIONS = [
  'centre',
  'auberge de jeunesse',
  'camping',
  "famille d'accueil",
  'gite',
  'mixte'
] as const;

export function formatAccommodationType(value?: string | null) {
  if (!value) return 'Non renseigné';
  if (value === 'gite') return 'Gîte';
  return value.charAt(0).toUpperCase() + value.slice(1);
}
