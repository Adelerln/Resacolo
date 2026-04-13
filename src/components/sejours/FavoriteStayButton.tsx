'use client';

import { useCallback, useEffect, useState } from 'react';
import { Heart } from 'lucide-react';
import {
  isFavoriteStay,
  STAY_FAVORITES_STORAGE_KEY,
  STAY_FAVORITES_UPDATED_EVENT,
  toggleFavoriteStay
} from '@/lib/stay-favorites';

type FavoriteStayButtonProps = {
  stayId: string;
  className?: string;
  stopPropagation?: boolean;
  iconClassName?: string;
};

export function FavoriteStayButton({
  stayId,
  className,
  stopPropagation = false,
  iconClassName
}: FavoriteStayButtonProps) {
  const [isFavorite, setIsFavorite] = useState(false);

  const refreshFavoriteState = useCallback(() => {
    setIsFavorite(isFavoriteStay(stayId));
  }, [stayId]);

  useEffect(() => {
    refreshFavoriteState();
  }, [refreshFavoriteState]);

  useEffect(() => {
    const handleStorage = (event: StorageEvent) => {
      if (event.key && event.key !== STAY_FAVORITES_STORAGE_KEY) return;
      refreshFavoriteState();
    };

    const handleFavoritesUpdated = () => {
      refreshFavoriteState();
    };

    window.addEventListener('storage', handleStorage);
    window.addEventListener(STAY_FAVORITES_UPDATED_EVENT, handleFavoritesUpdated);

    return () => {
      window.removeEventListener('storage', handleStorage);
      window.removeEventListener(STAY_FAVORITES_UPDATED_EVENT, handleFavoritesUpdated);
    };
  }, [refreshFavoriteState]);

  const handleClick = (event: React.MouseEvent<HTMLButtonElement>) => {
    if (stopPropagation) {
      event.preventDefault();
      event.stopPropagation();
    }

    setIsFavorite(toggleFavoriteStay(stayId));
  };

  return (
    <button
      type="button"
      onClick={handleClick}
      aria-label={isFavorite ? 'Retirer des favoris' : 'Ajouter aux favoris'}
      aria-pressed={isFavorite}
      className={`inline-flex h-10 w-10 items-center justify-center rounded-full border border-orange-200 bg-white/95 shadow-sm transition hover:border-orange-300 hover:bg-orange-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-orange-400/60 ${className ?? ''}`}
    >
      <Heart
        className={`h-5 w-5 transition ${
          isFavorite ? 'fill-orange-500 text-orange-500' : 'text-orange-500'
        } ${iconClassName ?? ''}`}
      />
    </button>
  );
}
