import Link from 'next/link';
import { redirect } from 'next/navigation';
import ErrorToast from '@/components/common/ErrorToast';
import { requireRole } from '@/lib/auth/require';
import { resolveOrganizerSelection, withOrganizerQuery } from '@/lib/organizers.server';
import { getServerSupabaseClient } from '@/lib/supabase/server';

type PageProps = {
  searchParams?: Promise<{
    organizerId?: string | string[];
    error?: string | string[];
  }>;
};

function formatRedirectValue(value?: string | string[]) {
  return Array.isArray(value) ? value[0] : value;
}

/**
 * La saisie manuelle ouvre le même tunnel que la review d’un brouillon après import :
 * création d’un `stay_drafts` puis redirection vers `/organisme/sejours/drafts/[id]`.
 */
export default async function NewStayManualPage({ searchParams }: PageProps) {
  const resolvedSearchParams = searchParams ? await searchParams : undefined;
  const session = await requireRole('ORGANISATEUR');
  const { selectedOrganizer, selectedOrganizerId } = await resolveOrganizerSelection(
    resolvedSearchParams?.organizerId,
    session.tenantId ?? null
  );
  const errorParam = formatRedirectValue(resolvedSearchParams?.error);

  async function startManualDraft(formData: FormData) {
    'use server';
    const requestedOrganizerId = String(formData.get('organizerId') ?? '').trim();
    const sessionInner = await requireRole('ORGANISATEUR');
    const supabaseInner = getServerSupabaseClient();
    const { selectedOrganizerId: actionOrganizerId } = await resolveOrganizerSelection(
      requestedOrganizerId || undefined,
      sessionInner.tenantId ?? null
    );

    if (!actionOrganizerId) {
      redirect('/organisme/sejours?error=Aucun%20organisateur%20disponible.');
    }

    const manualSourceUrl = `https://resacolo.com/creation-manuelle/${crypto.randomUUID()}`;
    const { data: insertedDraft, error: insertError } = await supabaseInner
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
          `/organisme/sejours/new/manual?error=${encodeURIComponent(
            insertError?.message ?? 'Impossible de créer le brouillon manuel.'
          )}`,
          actionOrganizerId
        )
      );
    }

    redirect(withOrganizerQuery(`/organisme/sejours/drafts/${insertedDraft.id}`, actionOrganizerId));
  }

  if (!selectedOrganizerId) {
    redirect('/organisme/sejours');
  }

  return (
    <div className="space-y-6">
      {errorParam ? <ErrorToast message={decodeURIComponent(errorParam)} /> : null}

      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-2xl font-semibold text-slate-900">Saisie manuelle</h1>
          <p className="mt-1 text-sm text-slate-600">
            {selectedOrganizer
              ? `Tu vas utiliser le même éditeur que pour un séjour importé (étapes, champs, validation) — ${selectedOrganizer.name}.`
              : 'Tu vas utiliser le même éditeur que pour un séjour importé (étapes, champs, validation).'}
          </p>
        </div>
        <Link
          href={withOrganizerQuery('/organisme/sejours/new', selectedOrganizerId)}
          className="inline-flex min-h-[44px] shrink-0 items-center justify-center rounded-lg border border-slate-200 px-4 py-2 text-sm font-semibold text-slate-700"
        >
          Retour au choix
        </Link>
      </div>

      <form
        action={startManualDraft}
        className="rounded-2xl border border-slate-200 bg-white p-6 sm:p-8"
      >
        <input type="hidden" name="organizerId" value={selectedOrganizerId} />
        <p className="text-sm text-slate-600">
          Un brouillon vide est créé, puis tu es redirigé vers la relecture (tunnel identique à
          l&apos;après-import).
        </p>
        <button
          type="submit"
          className="mt-4 inline-flex min-h-[44px] items-center justify-center rounded-lg bg-emerald-600 px-5 py-2.5 text-sm font-semibold text-white"
        >
          Ouvrir l&apos;éditeur de brouillon
        </button>
      </form>
    </div>
  );
}
