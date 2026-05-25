'use client';

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode
} from 'react';
import { addFavorite, getFavorites, removeFavorite } from '@/lib/favorites';
import { tryGetBrowserSupabaseClient } from '@/lib/supabase/browser';

type FavoritesContextValue = {
  favoriteIds: Set<string>;
  favoriteIdsArray: string[];
  isLoaded: boolean;
  isAuthenticated: boolean;
  isPending: (stayId: string) => boolean;
  isFavorite: (stayId: string) => boolean;
  toggleFavorite: (stayId: string) => Promise<{ ok: boolean; isAuthenticated: boolean }>;
  refreshFavorites: () => Promise<void>;
};

const FavoritesContext = createContext<FavoritesContextValue | null>(null);

export function FavoritesProvider({ children }: { children: ReactNode }) {
  const [favoriteIdsArray, setFavoriteIdsArray] = useState<string[]>([]);
  const [isLoaded, setIsLoaded] = useState(false);
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [pendingIds, setPendingIds] = useState<string[]>([]);

  const favoriteIds = useMemo(() => new Set(favoriteIdsArray), [favoriteIdsArray]);

  const refreshFavorites = useCallback(async () => {
    try {
      const result = await getFavorites();
      setFavoriteIdsArray(result.stayIds);
      setIsAuthenticated(result.isAuthenticated);
    } catch {
      setFavoriteIdsArray([]);
      setIsAuthenticated(false);
    } finally {
      setIsLoaded(true);
    }
  }, []);

  useEffect(() => {
    void refreshFavorites();

    const supabase = tryGetBrowserSupabaseClient();
    if (!supabase) return;

    const {
      data: { subscription }
    } = supabase.auth.onAuthStateChange(() => {
      void refreshFavorites();
    });

    return () => subscription.unsubscribe();
  }, [refreshFavorites]);

  const toggleFavorite = useCallback(
    async (stayId: string) => {
      const wasFavorite = favoriteIds.has(stayId);

      setPendingIds((current) => (current.includes(stayId) ? current : [...current, stayId]));
      setFavoriteIdsArray((current) =>
        wasFavorite ? current.filter((id) => id !== stayId) : [...current, stayId]
      );

      try {
        const result = wasFavorite ? await removeFavorite(stayId) : await addFavorite(stayId);

        if (!result.ok) {
          setFavoriteIdsArray((current) =>
            wasFavorite ? [...current, stayId] : current.filter((id) => id !== stayId)
          );
          setIsAuthenticated(result.isAuthenticated);
          return result;
        }

        setIsAuthenticated(true);
        return result;
      } catch {
        setFavoriteIdsArray((current) =>
          wasFavorite ? [...current, stayId] : current.filter((id) => id !== stayId)
        );
        return { ok: false, isAuthenticated };
      } finally {
        setPendingIds((current) => current.filter((id) => id !== stayId));
      }
    },
    [favoriteIds, isAuthenticated]
  );

  const value = useMemo<FavoritesContextValue>(
    () => ({
      favoriteIds,
      favoriteIdsArray,
      isLoaded,
      isAuthenticated,
      isPending: (stayId) => pendingIds.includes(stayId),
      isFavorite: (stayId) => favoriteIds.has(stayId),
      toggleFavorite,
      refreshFavorites
    }),
    [favoriteIds, favoriteIdsArray, isLoaded, isAuthenticated, pendingIds, toggleFavorite, refreshFavorites]
  );

  return <FavoritesContext.Provider value={value}>{children}</FavoritesContext.Provider>;
}

export function useFavorites() {
  const context = useContext(FavoritesContext);
  if (!context) {
    throw new Error('useFavorites must be used within FavoritesProvider');
  }
  return context;
}
