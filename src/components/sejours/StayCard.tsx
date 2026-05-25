'use client';

import { OrganizerStayPreviewCard } from '@/components/organisateurs/OrganizerStayPreviewCard';
import { getMockImageUrl, mockImages } from '@/lib/mockImages';
import { staySessionsAppearFullyBooked } from '@/lib/stay-catalog-availability';
import { resolveStaySeasonPicto } from '@/lib/organizer-profile-options';
import type { Stay } from '@/types/stay';

interface StayCardProps {
  stay: Stay;
}

export function StayCard({ stay }: StayCardProps) {
  const season = resolveStaySeasonPicto(stay.seasonName || stay.period[0] || null);
  const isFullyBooked = staySessionsAppearFullyBooked(stay.bookingOptions?.sessions);

  return (
    <div className="flex justify-center">
      <OrganizerStayPreviewCard
        title={stay.title}
        summary={stay.summary}
        description={stay.description}
        locationLabel={stay.displayLocation || stay.location || stay.region || 'Lieu à préciser'}
        ageRangeLabel={stay.ageRange || 'Tous âges'}
        seasonIconSrc={season.iconPath}
        seasonBadge={season.badgeText}
        durationLabel={stay.duration || 'Durée à venir'}
        priceFromEuros={stay.priceFrom}
        coverUrl={stay.coverImage || getMockImageUrl(mockImages.sejours.fallbackCover, 1200, 80)}
        href={`/sejours/${stay.canonicalSlug}`}
        organizerLogoUrl={stay.organizer.logoUrl ?? null}
        organizerName={stay.organizer.name}
        isFullyBooked={isFullyBooked}
      />
    </div>
  );
}
