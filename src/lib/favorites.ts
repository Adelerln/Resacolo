'use client';

export async function getFavorites() {
  const response = await fetch('/api/favorites', {
    method: 'GET',
    cache: 'no-store'
  });

  if (response.status === 401) {
    return { isAuthenticated: false, stayIds: [] as string[] };
  }

  if (!response.ok) {
    throw new Error('Impossible de charger les favoris.');
  }

  const payload = (await response.json()) as { stayIds?: string[] };
  return {
    isAuthenticated: true,
    stayIds: payload.stayIds ?? []
  };
}

export async function addFavorite(stayId: string) {
  const response = await fetch('/api/favorites', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ stay_id: stayId })
  });

  if (response.status === 401) {
    return { ok: false, isAuthenticated: false };
  }

  if (!response.ok) {
    throw new Error('Impossible d’ajouter ce séjour aux favoris.');
  }

  return { ok: true, isAuthenticated: true };
}

export async function removeFavorite(stayId: string) {
  const response = await fetch('/api/favorites', {
    method: 'DELETE',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ stay_id: stayId })
  });

  if (response.status === 401) {
    return { ok: false, isAuthenticated: false };
  }

  if (!response.ok) {
    throw new Error('Impossible de retirer ce séjour des favoris.');
  }

  return { ok: true, isAuthenticated: true };
}
