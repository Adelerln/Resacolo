'use client';

import { useState, useTransition } from 'react';
import { Heart } from 'lucide-react';
import clsx from 'clsx';
import { useFavorites } from '@/components/favorites/FavoritesProvider';

type FavoriteToggleButtonProps = {
  stayId: string;
  className?: string;
  iconClassName?: string;
  showLabel?: boolean;
};

export function FavoriteToggleButton({
  stayId,
  className,
  iconClassName,
  showLabel = false
}: FavoriteToggleButtonProps) {
  const [message, setMessage] = useState<string | null>(null);
  const [isTransitionPending, startTransition] = useTransition();
  const { isFavorite, isPending, toggleFavorite } = useFavorites();
  const favorite = isFavorite(stayId);
  const pending = isPending(stayId) || isTransitionPending;

  return (
    <button
      type="button"
      onClick={() => {
        setMessage(null);
        startTransition(async () => {
          const result = await toggleFavorite(stayId);
          if (!result.isAuthenticated) {
            setMessage('Connectez-vous pour gérer vos favoris.');
          }
        });
      }}
      aria-pressed={favorite}
      aria-label={favorite ? 'Retirer des favoris' : 'Ajouter aux favoris'}
      title={message ?? (favorite ? 'Retirer des favoris' : 'Ajouter aux favoris')}
      className={clsx(
        showLabel
          ? 'inline-flex items-center gap-2 rounded-full border px-4 py-2 text-sm font-semibold transition'
          : 'inline-flex h-11 w-11 items-center justify-center rounded-full border transition',
        favorite
          ? 'border-rose-200 bg-rose-50 text-rose-500 hover:bg-rose-100'
          : 'border-slate-200 bg-white/95 text-slate-500 hover:border-rose-200 hover:text-rose-500',
        pending && 'cursor-wait opacity-70',
        className
      )}
      disabled={pending}
    >
      <Heart className={clsx('h-5 w-5', favorite && 'fill-current', iconClassName)} aria-hidden />
      {showLabel ? <span>{favorite ? 'Retirer des favoris' : 'Ajouter aux favoris'}</span> : null}
    </button>
  );
}
