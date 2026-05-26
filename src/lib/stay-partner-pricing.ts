import { getServerSupabaseClient } from '@/lib/supabase/server';
import type { Stay, StaySessionOption } from '@/types/stay';

function normalizePartnerDiscountPercent(value: number | null | undefined) {
  if (typeof value !== 'number' || !Number.isFinite(value)) return null;
  if (value <= 0) return null;
  return Math.min(100, Math.max(0, value));
}

function roundEuros(value: number) {
  return Math.round(value * 100) / 100;
}

export function computePartnerDiscountedPrice(price: number | null | undefined, percent: number | null | undefined) {
  if (typeof price !== 'number' || !Number.isFinite(price) || price < 0) return null;
  const normalizedPercent = normalizePartnerDiscountPercent(percent);
  if (normalizedPercent == null) return null;
  return roundEuros(price * (1 - normalizedPercent / 100));
}

export function getStayDisplayedPrice(stay: Pick<Stay, 'partnerPriceFrom' | 'csePriceFrom' | 'priceFrom'>) {
  if (typeof stay.partnerPriceFrom === 'number' && Number.isFinite(stay.partnerPriceFrom)) {
    return stay.partnerPriceFrom;
  }
  if (typeof stay.csePriceFrom === 'number' && Number.isFinite(stay.csePriceFrom)) {
    return stay.csePriceFrom;
  }
  if (typeof stay.priceFrom === 'number' && Number.isFinite(stay.priceFrom)) {
    return stay.priceFrom;
  }
  return null;
}

export function getSessionDisplayedBasePrice(
  session: Pick<StaySessionOption, 'partnerDiscountedPrice' | 'familyCentsAfterAid' | 'price'> | null | undefined,
  stay: Pick<Stay, 'partnerPriceFrom' | 'csePriceFrom' | 'priceFrom'>
) {
  if (session?.partnerDiscountedPrice != null && Number.isFinite(session.partnerDiscountedPrice)) {
    return session.partnerDiscountedPrice;
  }
  if (session?.familyCentsAfterAid != null && Number.isFinite(session.familyCentsAfterAid)) {
    return session.familyCentsAfterAid / 100;
  }
  if (session?.price != null && Number.isFinite(session.price)) {
    return session.price;
  }
  return getStayDisplayedPrice(stay);
}

export async function userHasCollectivityAffiliation(userId: string) {
  const supabase = getServerSupabaseClient();
  const { data: client } = await supabase
    .from('clients')
    .select('collectivity_id')
    .eq('user_id', userId)
    .maybeSingle();

  return Boolean(client?.collectivity_id);
}

export function applyPartnerDiscountPricingToStay(stay: Stay): Stay {
  const normalizedPercent = normalizePartnerDiscountPercent(stay.partnerDiscountPercent);
  if (normalizedPercent == null) {
    return {
      ...stay,
      partnerDiscountPercent: null,
      partnerPriceFrom: null
    };
  }

  const sessions = stay.bookingOptions?.sessions ?? [];
  if (sessions.length === 0) {
    return {
      ...stay,
      partnerDiscountPercent: normalizedPercent,
      partnerPriceFrom: computePartnerDiscountedPrice(stay.priceFrom, normalizedPercent)
    };
  }

  const sessionsWithPartnerPricing = sessions.map((session) => ({
    ...session,
    partnerDiscountPercent: normalizedPercent,
    partnerDiscountedPrice: computePartnerDiscountedPrice(session.price, normalizedPercent)
  }));

  const openPartnerPrices = sessionsWithPartnerPricing
    .filter((session) => session.status === 'OPEN')
    .map((session) => session.partnerDiscountedPrice)
    .filter((price): price is number => typeof price === 'number' && Number.isFinite(price));
  const fallbackPartnerPrices = sessionsWithPartnerPricing
    .map((session) => session.partnerDiscountedPrice)
    .filter((price): price is number => typeof price === 'number' && Number.isFinite(price));

  return {
    ...stay,
    partnerDiscountPercent: normalizedPercent,
    partnerPriceFrom: openPartnerPrices.length
      ? Math.min(...openPartnerPrices)
      : fallbackPartnerPrices.length
        ? Math.min(...fallbackPartnerPrices)
        : computePartnerDiscountedPrice(stay.priceFrom, normalizedPercent),
    bookingOptions: stay.bookingOptions
      ? {
          ...stay.bookingOptions,
          sessions: sessionsWithPartnerPricing
        }
      : stay.bookingOptions
  };
}

export function applyPartnerDiscountPricingToStays(stays: Stay[]) {
  return stays.map((stay) => applyPartnerDiscountPricingToStay(stay));
}
