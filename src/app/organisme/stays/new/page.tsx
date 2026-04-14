import Link from 'next/link';
import ErrorToast from '@/components/common/ErrorToast';
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
  const { selectedOrganizer, selectedOrganizerId } = await resolveOrganizerSelection(
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
        <p className="text-sm text-slate-600">
          {selectedOrganizer
            ? `Choisis comment créer un séjour pour ${selectedOrganizer.name}.`
            : 'Choisis comment créer un séjour.'}
        </p>
      </div>

      <div className="max-w-xl rounded-2xl border border-slate-200 bg-white p-5">
        <h2 className="text-lg font-semibold text-slate-900">Saisie manuelle</h2>
        <p className="mt-2 text-sm leading-6 text-slate-600">
          Crée un séjour à la main, champ par champ, si tu veux garder la main sur toute la fiche
          dès le départ. Par défaut, la fiche est créée en <span className="font-semibold">brouillon</span> jusqu’à
          ce que tu la passes en publié.
        </p>
        <div className="mt-5">
          <Link
            href={withOrganizerQuery('/organisme/sejours/new/manual', organizerId)}
            className="inline-flex min-h-[44px] items-center justify-center rounded-lg bg-emerald-600 px-4 py-2 text-sm font-semibold text-white"
          >
            Commencer la saisie manuelle
          </Link>
        </div>
      </div>

      <section id="assistant-ia" className="space-y-4">
        <div className="rounded-2xl border border-slate-200 bg-white p-4 sm:p-6">
          <h2 className="text-lg font-semibold text-slate-900">Pré-remplissage depuis une URL</h2>
          <p className="mt-1 text-sm text-slate-600">
            Collez l&apos;URL d&apos;une fiche séjour existante pour préparer un brouillon automatiquement
            à l&apos;étape suivante.
          </p>
          <form
            action="/api/import-stay"
            method="post"
            className="mt-4 space-y-4"
          >
            <div className="grid gap-3 sm:grid-cols-[minmax(0,1fr)_320px] sm:items-end">
              <label className="block text-sm font-medium text-slate-700">
                URL de la fiche séjour
                <input
                  name="sourceUrl"
                  type="url"
                  placeholder="https://exemple.com/fiche-sejour"
                  className="mt-1 w-full rounded-lg border border-slate-200 px-3 py-2"
                  required
                />
              </label>
              <label className="block text-sm font-medium text-slate-700">
                Hébergement à rattacher
                <select
                  name="selectedAccommodationId"
                  className="mt-1 w-full rounded-lg border border-slate-200 px-3 py-2"
                  defaultValue=""
                >
                  <option value="">Créer un nouvel hébergement depuis l&apos;import</option>
                  {accommodationOptions.map((accommodation) => (
                    <option key={accommodation.id} value={accommodation.id}>
                      {accommodation.label}
                    </option>
                  ))}
                </select>
              </label>
            </div>
            <p className="text-xs leading-5 text-slate-500">
              Si tu choisis un hébergement existant, l&apos;IA n&apos;extrait pas de nouvel
              hébergement et le séjour importé sera rattaché directement à celui-ci.
            </p>
            <input type="hidden" name="organizerId" value={organizerId ?? ''} />
            <div>
              <button
                type="submit"
                className="h-10 rounded-lg bg-emerald-600 px-4 text-sm font-semibold text-white"
              >
                Pré-remplir
              </button>
            </div>
          </form>
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
          <h3 className="text-base font-semibold text-slate-900">Enrichissement IA d&apos;un draft</h3>
          <p className="mt-1 text-sm text-slate-600">
            Lancez une étape complémentaire d&apos;extraction IA sur un draft existant. Cette étape
            enrichit uniquement <code>stay_drafts</code> et ne publie rien dans les tables live.
          </p>
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
            <label className="inline-flex items-center gap-2 text-sm text-slate-700 sm:pb-2">
              <input
                type="checkbox"
                name="force"
                value="true"
                className="h-4 w-4 rounded border-slate-300"
              />
              Forcer l&apos;écrasement (test)
            </label>
            <button
              type="submit"
              className="h-10 rounded-lg bg-slate-900 px-4 text-sm font-semibold text-white"
            >
              Enrichir avec IA
            </button>
          </form>
          {aiParam === 'success' && aiDraftIdParam && (
            <p className="mt-4 rounded-lg border border-emerald-200 bg-emerald-50 px-3 py-2 text-sm text-emerald-800">
              Enrichissement IA terminé avec succès. ID du draft :{' '}
              <span className="font-semibold">{aiDraftIdParam}</span>.{' '}
              <Link
                href={withOrganizerQuery(`/organisme/sejours/drafts/${aiDraftIdParam}`, organizerId)}
                className="font-semibold underline"
              >
                Ouvrir la review
              </Link>
            </p>
          )}
        </div>
      </section>
    </div>
  );
}
