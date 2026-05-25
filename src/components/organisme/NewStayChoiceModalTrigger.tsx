'use client';

import Link from 'next/link';
import { withOrganizerQuery } from '@/lib/organizers';

type NewStayChoiceModalTriggerProps = {
  organizerId: string | null;
};

export default function NewStayChoiceModalTrigger({
  organizerId
}: NewStayChoiceModalTriggerProps) {
  return (
    <Link
      href={withOrganizerQuery('/organisme/sejours/new', organizerId)}
      className="organizer-btn-primary"
    >
      Nouveau séjour
    </Link>
  );
}
