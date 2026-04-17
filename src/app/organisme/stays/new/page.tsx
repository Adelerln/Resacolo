import Link from 'next/link';
import { redirect } from 'next/navigation';
import ErrorToast from '@/components/common/ErrorToast';
import ImportStayPrefillForm from '@/components/organisme/ImportStayPrefillForm';
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

  async function startManualDraft(formData: FormData) {
    'use server';
    const requestedOrganizerId = String(formData.get('organizerId') ?? '').trim();
    const session = await requireRole('ORGANISATEUR');
    const supabase = getServerSupabaseClient();
    const { selectedOrganizerId: actionOrganizerId } = await resolveOrganizerSelection(
      requestedOrganizerId || undefined,
      session.tenantId ?? null
    );

    if (!actionOrganizerId) {
      redirect('/organisme/sejours?error=Aucun%20organisateur%20disponible.');
    }

    const manualSourceUrl = `https://resacolo.com/creation-manuelle/${crypto.randomUUID()}`;
    const { data: insertedDraft, error: insertError } = await supabase
      .from('stay_drafts')
      .insert({
        organizer_id: actionOrganizerId,
        source_url: manualSourceUrl,
        status: 'pending',
        raw_payload: {
          manual_entry: true,
          created_via: 'manual-flow',
          created_at: new Date().toISOString()
        }
      })
      .select('id')
      .single();

    if (insertError || !insertedDraft) {
      redirect(
        withOrganizerQuery(
          `/organisme/sejours/new?error=${encodeURIComponent(insertError?.message ?? 'Impossible de créer le brouillon manuel.')}`,
          actionOrganizerId
        )
      );
    }

    redirect(withOrganizerQuery(`/organisme/sejours/drafts/${insertedDraft.id}`, actionOrganizerId));
  }

  return (
    <div className="space-y-6">
      {errorParam && <ErrorToast message={decodeURIComponent(errorParam)} />}

      <div>
        <h1 className="text-2xl font-semibold text-slate-900">Nouveau séjour</h1>
      </div>

      <section id="assistant-ia" className="space-y-4">
        <div className="px-4 sm:px-6">
          <form action={startManualDraft}>
            <input type="hidden" name="organizerId" value={organizerId ?? ''} />
            <button
              type="submit"
              className="inline-flex min-h-[44px] items-center justify-center rounded-lg bg-emerald-600 px-4 py-2 text-sm font-semibold text-white"
            >
              Commencer la saisie manuelle
            </button>
          </form>
        </div>

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
              Brouillon créé et pré-rempli avec succès. ID du draft :{' '}
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
          <form
            action="/api/stay-drafts/enrich"
            method="post"
            className="mt-4 flex flex-col gap-3 sm:flex-row sm:items-end"
          >
            <label className="block flex-1 text-sm font-medium text-slate-700">
              ID du draft
              <input
                name="draftId"
                type="text"
                placeholder="UUID du stay_draft"
                defaultValue={draftIdParam ?? aiDraftIdParam ?? ''}
                className="mt-1 w-full rounded-lg border border-slate-200 px-3 py-2"
                required
              />
            </label>
            <input type="hidden" name="organizerId" value={organizerId ?? ''} />
            <input type="hidden" name="force" value="true" />
            <button
              type="submit"
              className="h-10 rounded-lg bg-slate-900 px-4 text-sm font-semibold text-white"
            >
              Enrichir avec IA
            </button>
          </form>
          {aiParam === 'success' && aiDraftIdParam && (
            <div className="mt-4 rounded-xl border border-emerald-200 bg-emerald-50 px-4 py-4 text-emerald-900">
              <p className="text-lg font-semibold">
                Enrichissement IA terminé
              </p>
              <p className="mt-1 text-sm">
                ID du draft : <span className="font-semibold">{aiDraftIdParam}</span>
              </p>
              <Link
                href={withOrganizerQuery(`/organisme/sejours/drafts/${aiDraftIdParam}`, organizerId)}
                className="mt-3 inline-flex min-h-[44px] items-center justify-center rounded-lg bg-emerald-700 px-4 py-2 text-sm font-semibold text-white transition hover:bg-emerald-800"
              >
                Voir le résultat
              </Link>
            </div>
          )}
        </div>
      </section>
    </div>
  );
}
