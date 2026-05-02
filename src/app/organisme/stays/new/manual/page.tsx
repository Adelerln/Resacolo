import { redirect } from 'next/navigation';
import { requireOrganizerPageAccess } from '@/lib/organizer-backoffice-access.server';
import { createManualDraftAndRedirect } from './actions';

type PageProps = {
  searchParams?: Promise<{
    organizerId?: string | string[];
  }>;
};

export default async function NewStayManualPage({ searchParams }: PageProps) {
  const resolvedSearchParams = searchParams ? await searchParams : undefined;
  const { selectedOrganizerId } = await requireOrganizerPageAccess({
    requestedOrganizerId: resolvedSearchParams?.organizerId,
    requiredSection: 'stays'
  });

  if (!selectedOrganizerId) {
    redirect('/organisme/sejours');
  }

  await createManualDraftAndRedirect(selectedOrganizerId);
}
