import Link from 'next/link';
import { redirect } from 'next/navigation';
import ErrorToast from '@/components/common/ErrorToast';
import SavedToast from '@/components/common/SavedToast';
import PublishedStaySessionsStep from '@/components/organisme/PublishedStaySessionsStep';
import { requireRole } from '@/lib/auth/require';
import { resolveOrganizerSelection, withOrganizerQuery } from '@/lib/organizers.server';
import { getReservedSessionCounts } from '@/lib/session-reservations';
import { getServerSupabaseClient } from '@/lib/supabase/server';
import { stayStatusLabel } from '@/lib/ui/labels';

type PageProps = {
  params: Promise<{ id: string }>;
  searchParams?: {
    organizerId?: string | string[];
    saved?: string | string[];
    error?: string | string[];
  };
};

export const dynamic = 'force-dynamic';
export const revalidate = 0;

export default async function OrganizerStayDetailPage({ params: paramsPromise, searchParams }: PageProps) {
  const params = await paramsPromise;
  const resolvedSearchParams = searchParams ? await searchParams : undefined;
  const session = await requireRole('ORGANISATEUR');
  const supabase = getServerSupabaseClient();
  const { selectedOrganizerId } = await resolveOrganizerSelection(
    resolvedSearchParams?.organizerId,
    session.tenantId ?? null
  );
  const savedParam = Array.isArray(resolvedSearchParams?.saved)
    ? resolvedSearchParams?.saved[0]
    : resolvedSearchParams?.saved;
  const errorParam = Array.isArray(resolvedSearchParams?.error)
    ? resolvedSearchParams?.error[0]
    : resolvedSearchParams?.error;
  const showSavedBanner = savedParam === '1';

  if (!selectedOrganizerId) {
    redirect('/organisme/sejours');
  }

  const { data: stay } = await supabase
    .from('stays')
    .select('*')
    .eq('id', params.id)
    .maybeSingle();

  if (!stay || stay.organizer_id !== selectedOrganizerId) {
    redirect(withOrganizerQuery('/organisme/sejours', selectedOrganizerId));
  }
  const currentStay = stay;

  const [{ data: seasonsRaw }, { data: sessionsRaw }] = await Promise.all([
    supabase.from('seasons').select('id,name').order('name', { ascending: true }),
    supabase
      .from('sessions')
      .select(
        'id,start_date,end_date,capacity_total,capacity_reserved,status,session_prices(amount_cents,currency)'
      )
      .eq('stay_id', currentStay.id)
      .order('start_date', { ascending: true })
  ]);

  const seasons = seasonsRaw ?? [];
  const sessions = sessionsRaw ?? [];
  const reservedSessionCounts = await getReservedSessionCounts(
    supabase,
    sessions.map((sessionItem) => sessionItem.id)
  );

  const editHref = withOrganizerQuery(`/organisme/stays/${currentStay.id}/edit`, selectedOrganizerId);

  return (
    <div className="space-y-6">
      {showSavedBanner && <SavedToast message="La fiche séjour a bien été enregistrée." />}
      {errorParam && <ErrorToast message={decodeURIComponent(errorParam)} />}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <h1 className="text-2xl font-semibold text-slate-900">{currentStay.title}</h1>
          <p className="text-sm text-slate-600">
            Saison: {seasons.find((season) => season.id === currentStay.season_id)?.name ?? '-'}
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <Link
            href={editHref}
            className="rounded-lg bg-emerald-600 px-4 py-2 text-sm font-semibold text-white shadow-sm transition hover:bg-emerald-700"
          >
            Modifier le séjour (tunnel)
          </Link>
          <span className="rounded-full bg-slate-100 px-3 py-1 text-xs font-semibold text-slate-600">
            {stayStatusLabel(currentStay.status)}
          </span>
        </div>
      </div>

      <div className="rounded-2xl border border-slate-200 bg-white p-4 sm:p-6">
        <PublishedStaySessionsStep
          stayId={currentStay.id}
          organizerId={selectedOrganizerId}
          returnTo="detail"
          sessions={sessions}
          reservedSessionCounts={reservedSessionCounts}
        />
      </div>

      <p className="text-center text-sm text-slate-500">
        Texte, médias, options, transports, SEO : utilisez le{' '}
        <Link href={editHref} className="font-medium text-emerald-700 underline">
          tunnel d&apos;édition
        </Link>
        .
      </p>
    </div>
  );
}
