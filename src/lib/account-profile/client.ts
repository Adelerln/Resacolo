import type {
  FamilyCheckoutSyncInput,
  FamilyParent2Patch,
  ParentStatus,
  FamilyProfile,
  FamilyProfileSnapshot,
  FamilyCseAffiliation,
  FamilyReservation
} from '@/types/family-profile';

function readFailureMessage(status: number, payload: Record<string, unknown>) {
  const errorValue = payload.error;
  if (typeof errorValue === 'string' && errorValue.trim()) {
    if (errorValue === 'AUTH_REQUIRED') {
      return 'Connexion famille requise.';
    }
    return errorValue.trim();
  }
  if (status >= 500) {
    return 'Le service profil est momentanément indisponible.';
  }
  return `La requête a échoué (${status}).`;
}

async function fetchJson<T>(url: string, init?: RequestInit): Promise<T> {
  const response = await fetch(url, {
    ...init,
    headers: {
      'Content-Type': 'application/json',
      ...(init?.headers ?? {})
    },
    cache: 'no-store'
  });

  const raw = await response.text();
  let payload: Record<string, unknown> = {};
  if (raw) {
    try {
      payload = JSON.parse(raw) as Record<string, unknown>;
    } catch {
      if (!response.ok) {
        throw new Error(`La requête a échoué (${response.status}).`);
      }
      throw new Error('Réponse serveur invalide.');
    }
  }

  if (!response.ok) {
    throw new Error(readFailureMessage(response.status, payload));
  }

  return payload as T;
}

export async function fetchFamilyProfileSnapshot() {
  return fetchJson<FamilyProfileSnapshot>('/api/account/profile', { method: 'GET' });
}

export async function syncFamilyProfileFromCheckout(input: FamilyCheckoutSyncInput) {
  return fetchJson<{ profile: FamilyProfile }>('/api/account/profile', {
    method: 'PATCH',
    body: JSON.stringify({
      source: 'checkout',
      contact: input.contact,
      participants: input.participants
    })
  });
}

export async function patchFamilyProfileParent2(input: FamilyParent2Patch) {
  return fetchJson<{ profile: FamilyProfile }>('/api/account/profile', {
    method: 'PATCH',
    body: JSON.stringify({
      source: 'mon-compte',
      parent2: input
    })
  });
}

export async function patchFamilyProfilePreferences(input: {
  parent1Name: string;
  parent1Status: ParentStatus;
  parent1StatusOther: string;
  parent1Email: string;
  parent1Phone: string;
  addressLine1: string;
  addressLine2: string;
  postalCode: string;
  city: string;
  country?: string;
  parent2Name: string;
  parent2Status: ParentStatus;
  parent2StatusOther: string;
  parent2Phone: string;
  parent2Email: string;
  parent2HasDifferentAddress: boolean;
  parent2AddressLine1: string;
  parent2AddressLine2: string;
  parent2PostalCode: string;
  parent2City: string;
}) {
  return fetchJson<{ profile: FamilyProfile }>('/api/account/profile', {
    method: 'PATCH',
    body: JSON.stringify({
      source: 'preferences',
      profile: input
    })
  });
}

export async function attachFamilyCseAffiliation(code: string) {
  return fetchJson<{
    profile: FamilyProfile;
    reservations: FamilyReservation[];
    cseAffiliation: FamilyCseAffiliation | null;
  }>('/api/account/profile', {
    method: 'PATCH',
    body: JSON.stringify({
      source: 'affiliation',
      action: 'attach',
      code
    })
  });
}

export async function detachFamilyCseAffiliation() {
  return fetchJson<{
    profile: FamilyProfile;
    reservations: FamilyReservation[];
    cseAffiliation: FamilyCseAffiliation | null;
  }>('/api/account/profile', {
    method: 'PATCH',
    body: JSON.stringify({
      source: 'affiliation',
      action: 'detach'
    })
  });
}

export async function createOrderBalancePaymentIntent(orderId: string) {
  return fetchJson<{
    orderId: string;
    paymentId: string;
    amountCents: number;
    currency: string;
    monetico: {
      mode: 'mock' | 'live';
      paymentUrl: string;
      formMethod: 'POST';
      formFields: Record<string, string>;
    };
  }>(`/api/orders/${orderId}/balance-payment-intent`, {
    method: 'POST'
  });
}
