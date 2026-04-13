import type { CartItem } from '@/types/cart';
import type { CheckoutPricing, CheckoutPricingItem } from '@/types/checkout';

/**
 * Contourne les appels checkout (session, tarif, inscription, paiement) côté client.
 * - `NEXT_PUBLIC_DEV_BYPASS_CHECKOUT=0` : toujours désactivé (tests API en local).
 * - `NEXT_PUBLIC_DEV_BYPASS_CHECKOUT=1` : toujours activé.
 * - Sinon : activé automatiquement en `next dev` (NODE_ENV === 'development').
 */
export function isDevBypassCheckout(): boolean {
  if (process.env.NEXT_PUBLIC_DEV_BYPASS_CHECKOUT === '0') {
    return false;
  }
  if (process.env.NEXT_PUBLIC_DEV_BYPASS_CHECKOUT === '1') {
    return true;
  }
  return process.env.NODE_ENV === 'development';
}

const DEV_SESSION_PLACEHOLDER = '00000000-0000-0000-0000-000000000001';

export function buildDevMockPricing(items: CartItem[]): CheckoutPricing {
  const pricingItems: CheckoutPricingItem[] = [];
  let totalCents = 0;

  for (const item of items) {
    const base =
      item.unitPrice != null && Number.isFinite(item.unitPrice) && item.unitPrice > 0
        ? Math.round(item.unitPrice * 100)
        : 50_00;
    totalCents += base;
    pricingItems.push({
      cartItemId: item.id,
      stayTitle: item.title,
      sessionId: item.selection.sessionId ?? DEV_SESSION_PLACEHOLDER,
      organizerId: item.organizerId,
      sessionStartDate: null,
      sessionEndDate: null,
      basePriceCents: base,
      transportPriceCents: 0,
      transportLabel: null,
      insurancePriceCents: 0,
      insuranceLabel: null,
      extraOptionPriceCents: 0,
      optionsPriceCents: 0,
      totalPriceCents: base,
      transportOptionId: null,
      insuranceOptionId: null,
      extraOptionId: null,
      extraOptionLabel: null
    });
  }

  return { items: pricingItems, totalCents, currency: 'EUR' };
}
