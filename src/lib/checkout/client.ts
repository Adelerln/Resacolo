import type { CartItem } from '@/types/cart';
import type { CheckoutContact, CheckoutParticipant, CheckoutPricing } from '@/types/checkout';

function readApiFailureMessage(status: number, data: Record<string, unknown>): string {
  const fromError = data.error;
  if (typeof fromError === 'string' && fromError.trim()) return fromError.trim();
  const fromMessage = data.message;
  if (typeof fromMessage === 'string' && fromMessage.trim()) return fromMessage.trim();
  if (status >= 500) {
    if (process.env.NODE_ENV === 'development') {
      return `Erreur serveur (HTTP ${status}) — voir le terminal « next dev ». En local le checkout sans API est actif par défaut ; si tu vois ce message, recharge la page ou vérifie que tu n’as pas NEXT_PUBLIC_DEV_BYPASS_CHECKOUT=0.`;
    }
    return 'Le service est momentanément indisponible. Réessayez dans quelques instants ou contactez le support.';
  }
  return `La requête n’a pas pu aboutir (${status}).`;
}

async function fetchJson<T>(url: string, init?: RequestInit): Promise<T> {
  const response = await fetch(url, {
    ...init,
    headers: {
      'Content-Type': 'application/json',
      ...(init?.headers ?? {})
    }
  });

  const raw = await response.text();
  let data = {} as Record<string, unknown> & T;
  if (raw) {
    try {
      data = JSON.parse(raw) as Record<string, unknown> & T;
    } catch {
      if (!response.ok) {
        throw new Error(readApiFailureMessage(response.status, {}));
      }
      throw new Error('Réponse serveur invalide.');
    }
  }

  if (!response.ok) {
    throw new Error(readApiFailureMessage(response.status, data));
  }

  return data as T;
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

export async function registerCheckoutClientAccount(input: {
  firstName: string;
  lastName: string;
  email: string;
  password: string;
}) {
  return fetchJson<{ ok: true; user: { id: string; email: string; name: string | null } }>(
    '/api/auth/register-client',
    {
      method: 'POST',
      body: JSON.stringify(input)
    }
  );
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
