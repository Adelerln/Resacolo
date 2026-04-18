import type {
  FamilyCheckoutSyncInput,
  FamilyParent2Patch,
  FamilyProfile,
  FamilyProfileSnapshot
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
