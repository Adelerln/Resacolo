'use client';

import Link from 'next/link';
import { withOrganizerQuery } from '@/lib/organizers';

type NewStayChoiceModalTriggerProps = {
  organizerId: string | null;
  hasCgv?: boolean;
};

export default function NewStayChoiceModalTrigger({
  organizerId,
  hasCgv = true
}: NewStayChoiceModalTriggerProps) {
  if (!hasCgv) {
    return (
      <Link
        href={withOrganizerQuery('/organisme/organisateur', organizerId)}
        className="organizer-btn-primary"
        title="Déposez d’abord vos CGV (PDF) sur votre fiche organisateur"
      >
        Déposer les CGV pour ajouter un séjour
      </Link>
    );
  }

  return (
    <Link
      href={withOrganizerQuery('/organisme/sejours/new', organizerId)}
      className="organizer-btn-primary"
    >
      Nouveau séjour
    </Link>
  );
}
