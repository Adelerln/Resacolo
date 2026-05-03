import Link from 'next/link';
import { redirect } from 'next/navigation';
import ErrorToast from '@/components/common/ErrorToast';
import DraftReferenceCopyField from '@/components/organisme/DraftReferenceCopyField';
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
          <h2 className="organizer-section-title">1. Pré-remplissage depuis une URL</h2>
          <ImportStayPrefillForm organizerId={organizerId} accommodationOptions={accommodationOptions} />
          {prefillParam === 'created' && draftIdParam && (
            <div className="mt-4 rounded-lg border border-emerald-200 bg-emerald-50 px-3 py-3 text-sm text-emerald-800">
              <p>Import lancé. Le brouillon a été créé et continue de se remplir en arrière-plan.</p>
              <DraftReferenceCopyField
                value={draftIdParam}
                labelClassName="mt-2 text-xs font-semibold uppercase tracking-wide text-emerald-700"
                codeClassName="text-emerald-900"
                buttonClassName="border-emerald-300 text-emerald-900 hover:bg-emerald-100"
              />
              <p className="mt-2">
                <Link
                  href={withOrganizerQuery(`/organisme/sejours/drafts/${draftIdParam}`, organizerId)}
                  className="font-semibold underline"
                >
                  Ouvrir le brouillon
                </Link>
              </p>
            </div>
          )}
          {prefillParam === 'existing' && draftIdParam && (
            <div className="mt-4 rounded-lg border border-amber-200 bg-amber-50 px-3 py-3 text-sm text-amber-800">
              <p>Un brouillon existait déjà pour cette URL. Le brouillon existant a été réutilisé.</p>
              <DraftReferenceCopyField
                value={draftIdParam}
                labelClassName="mt-2 text-xs font-semibold uppercase tracking-wide text-amber-700"
                codeClassName="text-amber-900"
                buttonClassName="border-amber-300 text-amber-900 hover:bg-amber-100"
              />
              <p className="mt-2">
                <Link
                  href={withOrganizerQuery(`/organisme/sejours/drafts/${draftIdParam}`, organizerId)}
                  className="font-semibold underline"
                >
                  Ouvrir ce brouillon
                </Link>
              </p>
            </div>
          )}
          {prefillParam === 'restarted' && draftIdParam && (
            <div className="mt-4 rounded-lg border border-amber-200 bg-amber-50 px-3 py-3 text-sm text-amber-800">
              <p>
                Un brouillon en échec existait déjà pour cette URL. L&apos;import a été relancé sur ce
                même brouillon.
              </p>
              <DraftReferenceCopyField
                value={draftIdParam}
                labelClassName="mt-2 text-xs font-semibold uppercase tracking-wide text-amber-700"
                codeClassName="text-amber-900"
                buttonClassName="border-amber-300 text-amber-900 hover:bg-amber-100"
              />
              <p className="mt-2">
                <Link
                  href={withOrganizerQuery(`/organisme/sejours/drafts/${draftIdParam}`, organizerId)}
                  className="font-semibold underline"
                >
                  Ouvrir le brouillon
                </Link>
              </p>
            </div>
          )}
        </div>

        <div className="organizer-card p-4 sm:p-6">
          <h3 className="organizer-section-title">2. Enrichissement par Intelligence Artificielle</h3>
          <StayDraftEnrichLauncher
            organizerId={organizerId}
            initialDraftId={draftIdParam ?? ''}
            aiDraftId={aiDraftIdParam ?? ''}
            aiSuccess={aiParam === 'success'}
          />
        </div>
      </section>
    </div>
  );
}
