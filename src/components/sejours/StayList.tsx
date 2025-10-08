'use client';

import { Stay } from '@/types/stay';
import { StayCard } from '@/components/sejours/StayCard';

interface StayListProps {
  stays: Stay[];
}

export function StayList({ stays }: StayListProps) {
  if (stays.length === 0) {
    return (
      <div className="rounded-xl border border-dashed border-slate-300 bg-white p-12 text-center text-sm text-slate-500">
        Aucun séjour ne correspond à vos critères pour le moment. Essayez d’élargir votre recherche ou revenez plus
        tard : de nouvelles offres arrivent chaque semaine.
      </div>
    );
  }

  return (
    <div className="grid gap-4">
      {stays.map((stay) => (
        <StayCard key={stay.id} stay={stay} />
      ))}
    </div>
  );
}
