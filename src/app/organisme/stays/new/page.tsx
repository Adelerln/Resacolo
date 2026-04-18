import Link from 'next/link';
import ErrorToast from '@/components/common/ErrorToast';
import ImportStayPrefillForm from '@/components/organisme/ImportStayPrefillForm';
import StayDraftEnrichLauncher from '@/components/organisme/StayDraftEnrichLauncher';
import { formatAccommodationType } from '@/lib/accommodation-types';
import { extractAccommodationLocationMeta } from '@/lib/accommodation-location';
import { requireRole } from '@/lib/auth/require';
import { resolveOrganizerSelection, withOrganizerQuery } from '@/lib/organizers.server';
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

export default async function NewStayChoicePage({ searchParams }: PageProps) {
  const resolvedSearchParams = searchParams ? await searchParams : undefined;
  const session = await requireRole('ORGANISATEUR');
  const supabase = getServerSupabaseClient();
  const { selectedOrganizerId } = await resolveOrganizerSelection(
    resolvedSearchParams?.organizerId,
    session.tenantId ?? null
  );
  const organizerId = selectedOrganizerId;
  const errorParam = formatRedirectValue(resolvedSearchParams?.error);
  const prefillParam = formatRedirectValue(resolvedSearchParams?.prefill);
  const draftIdParam = formatRedirectValue(resolvedSearchParams?.draftId);
  const aiParam = formatRedirectValue(resolvedSearchParams?.ai);
  const aiDraftIdParam = formatRedirectValue(resolvedSearchParams?.aiDraftId);
  const { data: existingAccommodations } = selectedOrganizerId
    ? await supabase
        .from('accommodations')
        .select('id,name,accommodation_type,description,status')
        .eq('organizer_id', selectedOrganizerId)
        .neq('status', 'ARCHIVED')
        .order('name', { ascending: true })
    : { data: [] };
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

      <div>
        <h1 className="text-2xl font-semibold text-slate-900">Nouveau séjour</h1>
      </div>

      <section id="assistant-ia" className="space-y-4">
        <div className="rounded-2xl border border-slate-200 bg-white p-4 sm:p-6">
          <h2 className="text-lg font-semibold text-slate-900">1. Pré-remplissage depuis une URL</h2>
          <p className="mt-1 text-sm text-slate-600">
            Collez l&apos;URL d&apos;une fiche séjour existante.
          </p>
          <ImportStayPrefillForm
            organizerId={organizerId ?? ''}
            accommodationOptions={accommodationOptions}
          />
          {prefillParam === 'created' && draftIdParam && (
            <p className="mt-4 rounded-lg border border-emerald-200 bg-emerald-50 px-3 py-2 text-sm text-emerald-800">
              Import lancé. Le brouillon a été créé et continue de se remplir en arrière-plan. ID du
              draft :{' '}
              <span className="font-semibold">{draftIdParam}</span>.{' '}
              <Link
                href={withOrganizerQuery(`/organisme/sejours/drafts/${draftIdParam}`, organizerId)}
                className="font-semibold underline"
              >
                Ouvrir la review
              </Link>
            </p>
          )}
        </div>

        <div className="rounded-2xl border border-slate-200 bg-white p-4 sm:p-6">
          <h3 className="text-lg font-semibold text-slate-900">2. Enrichissement IA d&apos;un draft</h3>
          <StayDraftEnrichLauncher
            organizerId={organizerId ?? ''}
            initialDraftId={draftIdParam ?? ''}
            aiDraftId={aiDraftIdParam ?? ''}
            aiSuccess={aiParam === 'success'}
          />
        </div>
      </section>
    </div>
  );
}
