import Link from 'next/link';
import { redirect } from 'next/navigation';
import ErrorToast from '@/components/common/ErrorToast';
import ImportStayPrefillForm from '@/components/organisme/ImportStayPrefillForm';
import StayDraftEnrichLauncher from '@/components/organisme/StayDraftEnrichLauncher';
import OrganizerPageHeader from '@/components/organisme/OrganizerPageHeader';
import { formatAccommodationType } from '@/lib/accommodation-types';
import { extractAccommodationLocationMeta } from '@/lib/accommodation-location';
import { requireOrganizerPageAccess } from '@/lib/organizer-backoffice-access.server';
import { withOrganizerQuery } from '@/lib/organizers.server';
import { getServerSupabaseClient } from '@/lib/supabase/server';

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

export const dynamic = 'force-dynamic';
export const revalidate = 0;

export default async function NewStayUrlPage({ searchParams }: PageProps) {
  const resolvedSearchParams = searchParams ? await searchParams : undefined;
  const { selectedOrganizerId: organizerId } = await requireOrganizerPageAccess({
    requestedOrganizerId: resolvedSearchParams?.organizerId,
    requiredSection: 'stays'
  });

  if (!organizerId) {
    redirect('/organisme/sejours');
  }

  const supabase = getServerSupabaseClient();
  const errorParam = formatRedirectValue(resolvedSearchParams?.error);
  const prefillParam = formatRedirectValue(resolvedSearchParams?.prefill);
  const draftIdParam = formatRedirectValue(resolvedSearchParams?.draftId);
  const aiParam = formatRedirectValue(resolvedSearchParams?.ai);
  const aiDraftIdParam = formatRedirectValue(resolvedSearchParams?.aiDraftId);
  const initialImportAction =
    prefillParam === 'created' || prefillParam === 'existing' || prefillParam === 'restarted'
      ? prefillParam
      : undefined;
  const initialImportDraftId = draftIdParam?.trim() ? draftIdParam.trim() : '';
  const { data: existingAccommodations } = await supabase
    .from('accommodations')
    .select('id,name,accommodation_type,description,status')
    .eq('organizer_id', organizerId)
    .neq('status', 'ARCHIVED')
    .order('name', { ascending: true });
  const accommodationOptions = (existingAccommodations ?? []).map((accommodation) => {
    const location = extractAccommodationLocationMeta(accommodation.description);
    const primaryLabel = accommodation.accommodation_type
      ? `${formatAccommodationType(accommodation.accommodation_type)}${
          location.locationLabel ? ` (${location.locationLabel})` : ''
        }`
      : accommodation.name;

    return {
      id: accommodation.id,
      label: `${primaryLabel} · ${accommodation.name}`
    };
  });

  return (
    <div className="space-y-6">
      {errorParam && <ErrorToast message={decodeURIComponent(errorParam)} />}

      <OrganizerPageHeader
        title="Nouveau séjour"
        actions={(
          <Link
            href={withOrganizerQuery('/organisme/sejours/new', organizerId)}
            className="organizer-btn-secondary"
          >
            Changer de mode
          </Link>
        )}
      />

      <section id="assistant-ia" className="space-y-4">
        <div className="organizer-card p-4 sm:p-6">
          <h2 className="organizer-section-title">Import via URL</h2>
          <ImportStayPrefillForm
            organizerId={organizerId}
            accommodationOptions={accommodationOptions}
            initialDraftId={initialImportDraftId}
            initialImportAction={initialImportAction}
          />
          <StayDraftEnrichLauncher
            organizerId={organizerId}
            initialDraftId={initialImportDraftId}
            aiDraftId={aiDraftIdParam ?? ''}
            aiSuccess={aiParam === 'success'}
            showOnlyWhenDraftReady
          />
        </div>
      </section>
    </div>
  );
}
