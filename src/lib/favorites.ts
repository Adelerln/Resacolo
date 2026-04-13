'use client';

import { tryGetBrowserSupabaseClient } from '@/lib/supabase/browser';

async function getFavoritesAuthHeaders() {
  const supabase = tryGetBrowserSupabaseClient();
  if (!supabase) return null;
  const {
    data: { session }
  } = await supabase.auth.getSession();

  if (!session?.access_token) return null;

  return {
    Authorization: `Bearer ${session.access_token}`,
    'Content-Type': 'application/json'
  };
}

export async function getFavorites() {
  const headers = await getFavoritesAuthHeaders();
  if (!headers) {
    return { isAuthenticated: false, stayIds: [] as string[] };
  }

  const response = await fetch('/api/favorites', {
    method: 'GET',
    headers: {
      Authorization: headers.Authorization
    },
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
  const headers = await getFavoritesAuthHeaders();
  if (!headers) {
    return { ok: false, isAuthenticated: false };
  }

  const response = await fetch('/api/favorites', {
    method: 'POST',
    headers,
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
  const headers = await getFavoritesAuthHeaders();
  if (!headers) {
    return { ok: false, isAuthenticated: false };
  }

  const response = await fetch('/api/favorites', {
    method: 'DELETE',
    headers,
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
