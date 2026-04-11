export type CartTransportMode =
  | 'Aller/Retour similaire'
  | 'Aller/Retour différencié'
  | 'Sans transport'
  | string;

export type CartItemSelection = {
  sessionId: string | null;
  transportMode: CartTransportMode;
  transportOptionId: string | null;
  departureTransportOptionId: string | null;
  returnTransportOptionId: string | null;
  departureCity: string | null;
  returnCity: string | null;
  insuranceOptionId: string | null;
  extraOptionId: string | null;
};

export type CartItem = {
  id: string;
  stayId: string;
  slug: string;
  title: string;
  organizerId: string;
  organizerName: string;
  location: string;
  duration: string;
  ageRange: string;
  coverImage?: string;
  unitPrice: number | null;
  selection: CartItemSelection;
  addedAt: string;
};

export function createCartItemId() {
  if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') {
    return crypto.randomUUID();
  }
  return `cart_${Date.now()}_${Math.random().toString(16).slice(2)}`;
}
