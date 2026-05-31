import { getServerSupabaseClient } from '@/lib/supabase/server';
import type { CartItem } from '@/types/cart';
import type { CheckoutContact, CheckoutParticipant, CheckoutPricing } from '@/types/checkout';
import type { Json } from '@/types/supabase';

function toJson(value: unknown): Json {
  if (value == null) return null;
  if (typeof value === 'string' || typeof value === 'number' || typeof value === 'boolean') {
    return value;
  }
  if (Array.isArray(value)) {
    return value.map((item) => toJson(item));
  }
  if (typeof value === 'object') {
    const entries = Object.entries(value as Record<string, unknown>).map(([key, nested]) => [key, toJson(nested)]);
    return Object.fromEntries(entries) as Json;
  }
  return String(value);
}

export async function saveCheckoutCartSnapshot(input: {
  checkoutId: string;
  clientUserId?: string | null;
  organizerId?: string | null;
  items?: CartItem[];
  contact?: CheckoutContact | null;
  participants?: CheckoutParticipant[] | null;
  pricing?: CheckoutPricing | null;
  lastStep: 'session' | 'contact' | 'participants' | 'recap' | 'payment';
}) {
  const supabase = getServerSupabaseClient();
  const now = new Date().toISOString();

  const payload = {
    id: input.checkoutId,
    client_user_id: input.clientUserId ?? null,
    organizer_id: input.organizerId ?? null,
    last_step: input.lastStep,
    items_snapshot: toJson(input.items ?? []),
    contact_snapshot: toJson(input.contact ?? null),
    participants_snapshot: toJson(input.participants ?? null),
    pricing_snapshot: toJson(input.pricing ?? null),
    status: 'ACTIVE',
    updated_at: now
  };

  const { error } = await supabase.from('checkout_carts').upsert(payload, { onConflict: 'id' });
  if (error) {
    console.warn('checkout_carts upsert failed:', error.message);
  }
}

export async function markCheckoutCartConverted(checkoutId: string, orderId: string) {
  const supabase = getServerSupabaseClient();
  const { error } = await supabase
    .from('checkout_carts')
    .update({
      status: 'CONVERTED',
      converted_order_id: orderId,
      last_step: 'payment'
    })
    .eq('id', checkoutId);

  if (error) {
    console.warn('checkout_carts convert failed:', error.message);
  }
}
