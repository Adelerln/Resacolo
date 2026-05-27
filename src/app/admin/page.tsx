import Link from 'next/link';
import { requireAdminSection } from '@/lib/auth/require';
import { getServerSupabaseClient } from '@/lib/supabase/server';

const SEASON_ORDER_STATUSES = new Set(['VALIDATED', 'BOOKED', 'PAID', 'CONFIRMED']);
const RESERVATION_SEASON_LABELS = ['Hiver', 'Printemps', 'Été', 'Automne', "Fin d'année"] as const;

type ReservationSeasonLabel = (typeof RESERVATION_SEASON_LABELS)[number];
type AdminKpiCardTone = 'default' | 'lightGray' | 'winter' | 'spring' | 'summer' | 'autumn' | 'yearEnd';
type ReservationSeasonCard = {
  season: ReservationSeasonLabel;
  year: number;
  startsAt: Date;
};

const RESERVATION_SEASON_STARTS: Record<ReservationSeasonLabel, { month: number; day: number }> = {
  Hiver: { month: 1, day: 20 },
  Printemps: { month: 3, day: 20 },
  Été: { month: 6, day: 20 },
  Automne: { month: 10, day: 1 },
  "Fin d'année": { month: 12, day: 15 }
};

const RESERVATION_SEASON_TONES: Record<ReservationSeasonLabel, AdminKpiCardTone> = {
  Hiver: 'winter',
  Printemps: 'spring',
  Été: 'summer',
  Automne: 'autumn',
  "Fin d'année": 'yearEnd'
};

const KPI_TONE_CLASSES: Record<AdminKpiCardTone, { card: string; label: string; value: string; helper: string }> = {
  default: {
    card: 'border-slate-200 bg-white',
    label: '',
    value: 'text-slate-900',
    helper: 'text-slate-500'
  },
  lightGray: {
    card: 'border-slate-200 bg-slate-100',
    label: '',
    value: 'text-slate-900',
    helper: 'text-slate-500'
  },
  winter: {
    card: 'border-blue-900 bg-blue-900',
    label: 'text-white/75',
    value: 'text-white',
    helper: 'text-white/70'
  },
  spring: {
    card: 'border-emerald-600 bg-emerald-600',
    label: 'text-white/80',
    value: 'text-white',
    helper: 'text-white/75'
  },
  summer: {
    card: 'border-amber-600 bg-amber-600',
    label: 'text-white/85',
    value: 'text-white',
    helper: 'text-white/80'
  },
  autumn: {
    card: 'border-rose-800 bg-rose-800',
    label: 'text-white/80',
    value: 'text-white',
    helper: 'text-white/75'
  },
  yearEnd: {
    card: 'border-teal-700 bg-teal-700',
    label: 'text-white/80',
    value: 'text-white',
    helper: 'text-white/75'
  }
};

function AdminKpiCard({
  label,
  value,
  helper,
  tone = 'default',
  labelSecondLine,
  href
}: {
  label: string;
  value: number;
  helper?: string;
  tone?: AdminKpiCardTone;
  labelSecondLine?: string;
  href?: string;
}) {
  const toneClasses = KPI_TONE_CLASSES[tone];
  const card = (
    <article
      className={`flex h-full flex-col rounded-2xl border p-4 ${toneClasses.card} ${
        href ? 'transition-transform hover:scale-[1.01]' : ''
      }`}
    >
      <p className={`admin-kpi-label flex min-h-10 flex-col items-start gap-0.5 ${toneClasses.label}`}>
        <span className="block leading-tight">{label}</span>
        {labelSecondLine ? <span className="block leading-tight">{labelSecondLine}</span> : null}
      </p>
      <p className={`mt-2 text-2xl font-semibold tabular-nums ${toneClasses.value}`}>{value}</p>
      {helper ? <p className={`mt-1 text-xs ${toneClasses.helper}`}>{helper}</p> : null}
    </article>
  );

  if (!href) return card;

  return (
    <Link href={href} prefetch={false} className="block h-full">
      {card}
    </Link>
  );
}

function formatValidatedReservationsHelper(count: number) {
  return count > 1 ? 'réservations validées' : 'réservation validée';
}

function utcDay(date: Date) {
  return new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate()));
}

function seasonStartDate(season: ReservationSeasonLabel, year: number) {
  const start = RESERVATION_SEASON_STARTS[season];
  return new Date(Date.UTC(year, start.month - 1, start.day));
}

function getUpcomingReservationSeasonCards(today: Date): ReservationSeasonCard[] {
  const todayUtc = utcDay(today);
  const currentYear = todayUtc.getUTCFullYear();

  return RESERVATION_SEASON_LABELS.map((season) => {
    let year = currentYear;
    let startsAt = seasonStartDate(season, year);

    if (startsAt.getTime() <= todayUtc.getTime()) {
      year += 1;
      startsAt = seasonStartDate(season, year);
    }

    return { season, year, startsAt };
  }).sort((left, right) => left.startsAt.getTime() - right.startsAt.getTime());
}

function reservationSeasonKey(season: ReservationSeasonLabel, year: number) {
  return `${season}:${year}`;
}

function reservationSeasonOccurrenceFromSessionDate(value: string | null | undefined) {
  if (!value) return null;
  const parsed = new Date(`${value}T00:00:00Z`);
  if (!Number.isFinite(parsed.getTime())) return null;

  const year = parsed.getUTCFullYear();
  const month = parsed.getUTCMonth() + 1;
  const day = parsed.getUTCDate();

  if (month === 12 || (month === 1 && day <= 15)) {
    return { season: "Fin d'année" as const, year: month === 1 ? year - 1 : year };
  }
  if (month === 1 || month === 2 || (month === 3 && day <= 15)) {
    return { season: 'Hiver' as const, year };
  }
  if (month === 3 || month === 4 || (month === 5 && day <= 10)) {
    return { season: 'Printemps' as const, year };
  }
  if (month === 5 || month === 6 || month === 7 || month === 8 || (month === 9 && day <= 10)) {
    return { season: 'Été' as const, year };
  }
  if (month === 9 || month === 10 || (month === 11 && day <= 10)) {
    return { season: 'Automne' as const, year };
  }
  return { season: "Fin d'année" as const, year };
}

export const dynamic = 'force-dynamic';
export const revalidate = 0;

export default async function AdminHome() {
  await requireAdminSection('dashboard');
  const supabase = getServerSupabaseClient();

  const [
    { data: staysRaw },
    { data: ordersRaw },
    { data: organizersRaw },
    { data: membersRaw },
    { data: sessionsRaw },
    { data: orderItemsRaw }
  ] = await Promise.all([
    supabase.from('stays').select('id,status'),
    supabase.from('orders').select('id,status'),
    supabase.from('organizer_admin_overview').select('id,profile_completeness_percent'),
    supabase.from('organizer_members').select('id'),
    supabase.from('sessions').select('id,start_date'),
    supabase.from('order_items').select('order_id,session_id')
  ]);

  const stays = staysRaw ?? [];
  const orders = ordersRaw ?? [];
  const organizers = organizersRaw ?? [];
  const members = membersRaw ?? [];
  const sessions = sessionsRaw ?? [];
  const orderItems = orderItemsRaw ?? [];
  const reservationSeasonCards = getUpcomingReservationSeasonCards(new Date());

  const totalStays = stays.length;
  const publishedStays = stays.filter((stay) => stay.status === 'PUBLISHED').length;
  const draftStays = stays.filter((stay) => stay.status === 'DRAFT').length;
  const hiddenOrArchivedStays = stays.filter(
    (stay) => stay.status === 'HIDDEN' || stay.status === 'ARCHIVED'
  ).length;
  const archivedStays = stays.filter((stay) => stay.status === 'ARCHIVED').length;

  const requestedOrders = orders.filter((order) => order.status === 'REQUESTED').length;
  const seasonOrderIds = new Set(
    orders.filter((order) => SEASON_ORDER_STATUSES.has(order.status)).map((order) => order.id)
  );
  const sessionStartDateById = new Map(sessions.map((session) => [session.id, session.start_date]));
  const orderIdsBySeasonYear = new Map<string, Set<string>>(
    reservationSeasonCards.map((card) => [reservationSeasonKey(card.season, card.year), new Set<string>()])
  );

  orderItems.forEach((item) => {
    if (!seasonOrderIds.has(item.order_id)) return;
    const occurrence = reservationSeasonOccurrenceFromSessionDate(sessionStartDateById.get(item.session_id));
    if (!occurrence) return;
    orderIdsBySeasonYear.get(reservationSeasonKey(occurrence.season, occurrence.year))?.add(item.order_id);
  });

  const lowProfileOrganizers = organizers.filter(
    (organizer) => Number(organizer.profile_completeness_percent ?? 0) < 70
  ).length;

  return (
    <div className="space-y-4">
      <div>
        <h1 className="admin-page-title">Dashboard admin</h1>
      </div>

      <section className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
        <AdminKpiCard label="Séjours publiés" value={publishedStays} />
        <AdminKpiCard label="Séjours en brouillon" value={draftStays} />
        <AdminKpiCard label="Séjours archivés et masqués" value={hiddenOrArchivedStays} />
        <AdminKpiCard label="Organismes" value={organizers.length} />
      </section>

      <section className="grid gap-4 md:grid-cols-2 xl:grid-cols-6">
        <AdminKpiCard
          label="Réservations"
          labelSecondLine="à traiter"
          value={requestedOrders}
          tone="lightGray"
          href="/admin/reservations?status=REQUESTED"
        />
        {reservationSeasonCards.map(({ season, year }) => {
          const count = orderIdsBySeasonYear.get(reservationSeasonKey(season, year))?.size ?? 0;

          return (
            <AdminKpiCard
              key={`${season}-${year}`}
              label="Réservations"
              labelSecondLine={`${season} ${year}`}
              value={count}
              helper={formatValidatedReservationsHelper(count)}
              tone={RESERVATION_SEASON_TONES[season]}
              href={`/admin/reservations?season=${encodeURIComponent(season)}&year=${year}`}
            />
          );
        })}
      </section>

      <section className="rounded-2xl border border-slate-200 bg-white p-6">
        <h2 className="admin-section-title">Actions rapides</h2>
        <div className="mt-4 grid gap-3 md:grid-cols-2">
          <Link
            href="/admin/sejours"
            prefetch={false}
            className="rounded-xl border border-slate-200 px-4 py-3 text-sm font-semibold text-slate-700 hover:border-slate-300"
          >
            Gérer les <span className="rounded bg-orange-100 px-1">séjours</span> ({totalStays}, dont {archivedStays}{' '}
            archivés)
          </Link>
          <Link
            href="/admin/organizers"
            prefetch={false}
            className="rounded-xl border border-slate-200 px-4 py-3 text-sm font-semibold text-slate-700 hover:border-slate-300"
          >
            Gérer les <span className="rounded bg-orange-100 px-1">organismes</span> ({members.length} membres liés)
          </Link>
          <Link
            href="/admin/finances"
            prefetch={false}
            className="rounded-xl border border-slate-200 px-4 py-3 text-sm font-semibold text-slate-700 hover:border-slate-300"
          >
            Voir les <span className="rounded bg-orange-100 px-1">recettes</span>
          </Link>
          <Link
            href="/admin/utilisateurs"
            prefetch={false}
            className="rounded-xl border border-slate-200 px-4 py-3 text-sm font-semibold text-slate-700 hover:border-slate-300"
          >
            Gérer les <span className="rounded bg-orange-100 px-1">utilisateurs de back-office</span>
          </Link>
        </div>
      </section>

      <section className="rounded-2xl border border-slate-200 bg-white p-6">
        <h2 className="admin-section-title">Points d&apos;attention</h2>
        <div className="mt-4 grid gap-3 md:grid-cols-2">
          <div className="rounded-xl border border-slate-100 p-4 text-sm text-slate-600">
            {requestedOrders} réservation(s) en attente de traitement.
          </div>
          <div className="rounded-xl border border-slate-100 p-4 text-sm text-slate-600">
            {lowProfileOrganizers} organisme(s) avec une complétude profil inférieure à 70%.
          </div>
        </div>
      </section>
    </div>
  );
}
