import { redirect } from 'next/navigation';
import ErrorToast from '@/components/common/ErrorToast';
import NewStayEntryChoiceOverlay from '@/components/organisme/NewStayEntryChoiceOverlay';
import { requireOrganizerPageAccess } from '@/lib/organizer-backoffice-access.server';
import { withOrganizerQuery } from '@/lib/organizers.server';

type PageProps = {
  searchParams?: Promise<{
    organizerId?: string | string[];
    error?: string | string[];
    prefill?: string | string[];
    draftId?: string | string[];
    ai?: string | string[];
    aiDraftId?: string | string[];
  }>;
};

function formatRedirectValue(value?: string | string[]) {
  return Array.isArray(value) ? value[0] : value;
}

export default async function NewStayChoicePage({ searchParams }: PageProps) {
  const resolvedSearchParams = searchParams ? await searchParams : undefined;
  const { selectedOrganizerId: organizerId } = await requireOrganizerPageAccess({
    requestedOrganizerId: resolvedSearchParams?.organizerId,
    requiredSection: 'stays'
  });

  if (!organizerId) {
    redirect('/organisme/sejours');
  }

  const errorParam = formatRedirectValue(resolvedSearchParams?.error);
  const prefillParam = formatRedirectValue(resolvedSearchParams?.prefill);
  const draftIdParam = formatRedirectValue(resolvedSearchParams?.draftId);
  const aiParam = formatRedirectValue(resolvedSearchParams?.ai);
  const aiDraftIdParam = formatRedirectValue(resolvedSearchParams?.aiDraftId);
  const shouldRedirectToUrlStep = Boolean(
    prefillParam?.trim() || draftIdParam?.trim() || aiParam?.trim() || aiDraftIdParam?.trim()
  );

  if (shouldRedirectToUrlStep) {
    const params = new URLSearchParams();
    if (errorParam?.trim()) params.set('error', errorParam.trim());
    if (prefillParam?.trim()) params.set('prefill', prefillParam.trim());
    if (draftIdParam?.trim()) params.set('draftId', draftIdParam.trim());
    if (aiParam?.trim()) params.set('ai', aiParam.trim());
    if (aiDraftIdParam?.trim()) params.set('aiDraftId', aiDraftIdParam.trim());

    redirect(
      withOrganizerQuery(
        params.toString() ? `/organisme/sejours/new/url?${params.toString()}` : '/organisme/sejours/new/url',
        organizerId
      )
    );
  }

  return (
    <div className="relative min-h-[60vh]">
      {errorParam && <ErrorToast message={decodeURIComponent(errorParam)} />}
      <NewStayEntryChoiceOverlay organizerId={organizerId} />
    </div>
  );
}
