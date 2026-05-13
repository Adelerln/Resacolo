export const ACCOMMODATION_TYPE_OPTIONS = [
  'centre',
  'auberge de jeunesse',
  'hotel',
  'camping',
  "famille d'accueil",
  'gite',
  'mixte'
] as const;

export function formatAccommodationType(value?: string | null) {
  if (!value) return 'Non renseigné';
  if (value === 'gite') return 'Gîte';
  if (value === 'hotel') return 'Hôtel';
  return value.charAt(0).toUpperCase() + value.slice(1);
}
