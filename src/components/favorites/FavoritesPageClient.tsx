'use client';

import { useMemo } from 'react';
import Link from 'next/link';
import { Heart } from 'lucide-react';
import { FavoriteToggleButton } from '@/components/favorites/FavoriteToggleButton';
import { useFavorites } from '@/components/favorites/FavoritesProvider';
import { OrganizerStayPreviewCard } from '@/components/organisateurs/OrganizerStayPreviewCard';
import { getMockImageUrl, mockImages } from '@/lib/mockImages';
import { resolveStaySeasonPicto } from '@/lib/organizer-profile-options';
import type { Stay } from '@/types/stay';

export function FavoritesPageClient({ stays }: { stays: Stay[] }) {
  const { favoriteIdsArray, isLoaded, isAuthenticated } = useFavorites();

  const favoriteStays = useMemo(() => {
    const ids = new Set(favoriteIdsArray);
    return stays.filter((stay) => ids.has(stay.id));
  }, [favoriteIdsArray, stays]);

  return (
    <div className="section-container py-10 sm:py-14">
      <div className="flex items-start justify-between gap-4">
        <div>
          <p className="text-xs font-semibold uppercase tracking-[0.2em] text-slate-500">Compte</p>
          <h1 className="mt-2 font-display text-3xl font-bold text-slate-900 sm:text-4xl">
            Mes <span className="text-accent-500">favoris</span>
          </h1>
          <p className="mt-3 max-w-2xl text-sm text-slate-600 sm:text-base">
            Retrouvez tous vos séjours favoris !
          </p>
        </div>
        <Heart className="mt-1 h-8 w-8 text-accent-500" />
      </div>

      {!isLoaded ? (
        <div className="mt-8 rounded-3xl border border-slate-200 bg-white p-8 text-sm text-slate-500">
          Chargement des favoris...
        </div>
      ) : !isAuthenticated ? (
        <div className="mt-8 rounded-3xl border border-slate-200 bg-white p-8 text-sm text-slate-500">
          Connectez-vous avec votre compte client pour accéder à vos favoris.
        </div>
      ) : favoriteStays.length === 0 ? (
        <div className="mt-8 rounded-3xl border border-slate-200 bg-white p-8 text-sm text-slate-600">
          <p>
            Votre liste de favoris est vide, n&apos;hésitez pas à ajouter des séjours en consultant le catalogue.
          </p>
          <div className="mt-6">
            <Link href="/sejours" className="btn btn-primary btn-md inline-flex">
              Voir le catalogue des séjours
            </Link>
          </div>
        </div>
      ) : (
        <div className="mt-8 grid grid-cols-1 gap-8 sm:grid-cols-2 xl:grid-cols-3">
          {favoriteStays.map((stay) => {
            const season = resolveStaySeasonPicto(stay.seasonName || stay.period[0] || null);
            return (
              <div key={stay.id} className="flex justify-center">
                <OrganizerStayPreviewCard
                  title={stay.title}
                  summary={stay.summary}
                  description={stay.description}
                  locationLabel={stay.location || stay.region || 'Lieu à préciser'}
                  ageRangeLabel={stay.ageRange || 'Tous âges'}
                  seasonIconSrc={season.iconPath}
                  seasonBadge={season.badgeText}
                  durationLabel={stay.duration || 'Durée à venir'}
                  priceFromEuros={stay.priceFrom}
                  coverUrl={stay.coverImage || getMockImageUrl(mockImages.sejours.fallbackCover, 1200, 80)}
                  href={`/sejours/${stay.canonicalSlug}`}
                  organizerLogoUrl={stay.organizer.logoUrl ?? null}
                  organizerName={stay.organizer.name}
                  overlayAction={<FavoriteToggleButton stayId={stay.id} />}
                />
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
