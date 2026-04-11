import type { CartItem } from '@/types/cart';
import type { CheckoutContact, CheckoutParticipant, CheckoutPricing } from '@/types/checkout';

async function fetchJson<T>(url: string, init?: RequestInit): Promise<T> {
  const response = await fetch(url, {
    ...init,
    headers: {
      'Content-Type': 'application/json',
      ...(init?.headers ?? {})
    }
  });

  const data = (await response.json().catch(() => ({}))) as { error?: string } & T;

  if (!response.ok) {
    throw new Error(data.error ?? 'Une erreur est survenue.');
  }

  return data;
}

export async function createCheckoutSession(items: CartItem[]) {
  return fetchJson<{ checkoutId: string; pricing: CheckoutPricing }>('/api/checkout/session', {
    method: 'POST',
    body: JSON.stringify({ items })
  });
}

export async function validateCheckoutContact(checkoutId: string, contact: CheckoutContact) {
  return fetchJson<{ contact: CheckoutContact }>(`/api/checkout/session/${checkoutId}/contact`, {
    method: 'PATCH',
    body: JSON.stringify({ contact })
  });
}

export async function validateCheckoutParticipants(
  checkoutId: string,
  participants: CheckoutParticipant[]
) {
  return fetchJson<{ participants: CheckoutParticipant[] }>(`/api/checkout/session/${checkoutId}/participants`, {
    method: 'PATCH',
    body: JSON.stringify({ participants })
  });
}

export async function repriceCheckout(checkoutId: string, items: CartItem[]) {
  return fetchJson<{ pricing: CheckoutPricing }>(`/api/checkout/session/${checkoutId}/reprice`, {
    method: 'POST',
    body: JSON.stringify({ items })
  });
}

export async function createPaymentIntent(input: {
  checkoutId: string;
  items: CartItem[];
  contact: CheckoutContact;
  participants: CheckoutParticipant[];
}) {
  return fetchJson<{
    orderId: string;
    paymentId: string;
    pricing: CheckoutPricing;
    monetico: {
      reference: string;
      transactionId: string;
      paymentUrl: string;
      testMode: true;
    };
  }>(`/api/checkout/session/${input.checkoutId}/payment-intent`, {
    method: 'POST',
    body: JSON.stringify({
      items: input.items,
      contact: input.contact,
      participants: input.participants
    })
  });
}

export async function confirmPaymentManually(input: {
  checkoutId: string;
  orderId: string;
  paymentId: string;
}) {
  return fetchJson<{ orderId: string; status: string }>(`/api/checkout/session/${input.checkoutId}/confirm`, {
    method: 'POST',
    body: JSON.stringify({ orderId: input.orderId, paymentId: input.paymentId })
  });
}

export async function getOrderStatus(orderId: string) {
  return fetchJson<{
    orderId: string;
    status: string;
    paidAt: string | null;
    paymentStatus: string | null;
    totalCents: number;
    currency: string;
  }>(`/api/orders/${orderId}`, {
    method: 'GET',
    cache: 'no-store'
  });
}
