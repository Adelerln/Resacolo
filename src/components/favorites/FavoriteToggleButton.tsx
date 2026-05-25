'use client';

import { useState, useTransition } from 'react';
import Image from 'next/image';
import Link from 'next/link';
import { usePathname, useSearchParams } from 'next/navigation';
import { createPortal } from 'react-dom';
import clsx from 'clsx';
import { Heart } from 'lucide-react';
import { useFavorites } from '@/components/favorites/FavoritesProvider';

type FavoriteToggleButtonProps = {
  stayId: string;
  className?: string;
  iconClassName?: string;
  showLabel?: boolean;
  variant?: 'default' | 'overlay';
  inactiveLabel?: string;
  activeLabel?: string;
};

const FAVORITE_ICON_SRC = '/image/header/pictos_header/icon-favoris.png';

export function FavoriteToggleButton({
  stayId,
  className,
  iconClassName,
  showLabel = false,
  variant = 'default',
  inactiveLabel = 'Ajouter aux favoris',
  activeLabel = 'Retirer des favoris'
}: FavoriteToggleButtonProps) {
  const [showAuthModal, setShowAuthModal] = useState(false);
  const [isTransitionPending, startTransition] = useTransition();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const { isFavorite, isPending, toggleFavorite, isAuthenticated, isLoaded } = useFavorites();
  const favorite = isFavorite(stayId);
  const pending = isPending(stayId) || isTransitionPending;
  const currentUrl = `${pathname}${searchParams.toString() ? `?${searchParams.toString()}` : ''}`;
  const loginHref = `/login/familles?redirectTo=${encodeURIComponent(currentUrl)}`;
  const signupHref = `/login/familles/creer-compte?redirectTo=${encodeURIComponent(currentUrl)}`;
  const isOverlayVariant = variant === 'overlay';

  return (
    <>
      <button
        type="button"
        onClick={() => {
          if (isLoaded && !isAuthenticated) {
            setShowAuthModal(true);
            return;
          }
          startTransition(async () => {
            const result = await toggleFavorite(stayId);
            if (!result.isAuthenticated) {
              setShowAuthModal(true);
            }
          });
        }}
        aria-pressed={favorite}
        aria-label={favorite ? 'Retirer des favoris' : 'Ajouter aux favoris'}
        title={favorite ? 'Retirer des favoris' : 'Ajouter aux favoris'}
        className={clsx(
          isOverlayVariant
            ? 'inline-flex h-8 w-8 items-center justify-center border-0 bg-transparent p-0 shadow-none'
            : showLabel
            ? 'inline-flex items-center gap-2 rounded-full border px-4 py-2 text-sm font-semibold transition'
            : 'inline-flex h-11 w-11 items-center justify-center rounded-full border transition',
          isOverlayVariant
            ? 'transition-transform duration-200 hover:scale-105'
            : favorite
              ? 'border-accent-500 bg-accent-500 text-white'
              : 'border-slate-200 bg-white/95 text-slate-500 hover:border-accent-400',
          pending && 'cursor-wait opacity-70',
          className
        )}
        disabled={pending}
      >
        {isOverlayVariant ? (
          <Heart
            aria-hidden
            className={clsx(
              'h-6 w-6 drop-shadow-[0_2px_8px_rgba(15,23,42,0.55)] transition-transform',
              favorite ? 'scale-105 text-[#FA8500]' : 'text-white',
              iconClassName
            )}
            fill={favorite ? '#FA8500' : 'transparent'}
            strokeWidth={2.2}
          />
        ) : (
          <Image
            src={FAVORITE_ICON_SRC}
            alt=""
            width={18}
            height={18}
            className={clsx(
              'h-[18px] w-[18px] object-contain',
              favorite ? 'brightness-0 invert' : '',
              iconClassName
            )}
          />
        )}
        {showLabel ? <span>{favorite ? activeLabel : inactiveLabel}</span> : null}
      </button>

      {showAuthModal && typeof document !== 'undefined'
        ? createPortal(
            <div className="fixed inset-0 z-[200] flex items-center justify-center bg-slate-900/45 px-4">
              <div className="w-full max-w-md rounded-2xl bg-white p-6 shadow-xl">
                <div className="flex items-start justify-between gap-4">
                  <div>
                    <h3 className="text-lg font-semibold text-slate-900">
                      Connectez-vous pour enregistrer vos favoris
                    </h3>
                    <p className="mt-1 text-sm text-slate-600">
                      Vous devez vous connecter ou créer un compte pour ajouter des séjours en favoris.
                    </p>
                  </div>
                  <button
                    type="button"
                    className="rounded-lg border border-slate-200 px-2.5 py-1.5 text-xs font-semibold text-slate-700"
                    onClick={() => setShowAuthModal(false)}
                    aria-label="Fermer"
                  >
                    Fermer
                  </button>
                </div>

                <div className="mt-5 flex flex-col gap-2">
                  <Link
                    href={loginHref}
                    className="inline-flex min-h-[44px] items-center justify-center rounded-xl bg-slate-900 px-4 py-2 text-sm font-semibold text-white"
                    onClick={() => setShowAuthModal(false)}
                  >
                    Se connecter
                  </Link>
                  <Link
                    href={signupHref}
                    className="inline-flex min-h-[44px] items-center justify-center rounded-xl border border-slate-200 px-4 py-2 text-sm font-semibold text-slate-800"
                    onClick={() => setShowAuthModal(false)}
                  >
                    Créer un compte
                  </Link>
                </div>
              </div>
            </div>,
            document.body
          )
        : null}
    </>
  );
}
