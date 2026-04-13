export const STAY_FAVORITES_STORAGE_KEY = 'resacolo.favoriteStayIds';
export const STAY_FAVORITES_UPDATED_EVENT = 'resacolo:favorite-stays-updated';

function normalizeFavoriteStayIds(stayIds: string[]) {
  return Array.from(new Set(stayIds.map((stayId) => stayId.trim()).filter(Boolean)));
}

export function readFavoriteStayIds() {
  if (typeof window === 'undefined') {
    return [] as string[];
  }

  try {
    const rawValue = window.localStorage.getItem(STAY_FAVORITES_STORAGE_KEY);
    if (!rawValue) return [];

    const parsed = JSON.parse(rawValue);
    if (!Array.isArray(parsed)) return [];

    return normalizeFavoriteStayIds(parsed.filter((item): item is string => typeof item === 'string'));
  } catch {
    return [];
  }
}

export function saveFavoriteStayIds(stayIds: string[]) {
  if (typeof window === 'undefined') {
    return;
  }

  const normalizedIds = normalizeFavoriteStayIds(stayIds);

  try {
    window.localStorage.setItem(STAY_FAVORITES_STORAGE_KEY, JSON.stringify(normalizedIds));
  } catch {
    return;
  }

  window.dispatchEvent(
    new CustomEvent(STAY_FAVORITES_UPDATED_EVENT, {
      detail: normalizedIds
    })
  );
}

export function isFavoriteStay(stayId: string) {
  const normalizedStayId = stayId.trim();
  if (!normalizedStayId) return false;
  return readFavoriteStayIds().includes(normalizedStayId);
}

export function toggleFavoriteStay(stayId: string) {
  const normalizedStayId = stayId.trim();
  if (!normalizedStayId) return false;

  const currentFavorites = readFavoriteStayIds();
  const isAlreadyFavorite = currentFavorites.includes(normalizedStayId);
  const nextFavorites = isAlreadyFavorite
    ? currentFavorites.filter((id) => id !== normalizedStayId)
    : [...currentFavorites, normalizedStayId];

  saveFavoriteStayIds(nextFavorites);
  return !isAlreadyFavorite;
}
