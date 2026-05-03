import Link from 'next/link';
import { redirect } from 'next/navigation';
import { requireRole } from '@/lib/auth/require';
import { getServerSupabaseClient } from '@/lib/supabase/server';
import type { Database } from '@/types/supabase';

type SearchParams = Promise<{ status?: string; season?: string }>;
type OrderStatus = Database['public']['Enums']['order_status'];
type OrderUpdate = Database['public']['Tables']['orders']['Update'];

const ADMIN_ORDER_STATUSES: OrderStatus[] = [
  'REQUESTED',
  'VALIDATED',
  'BOOKED',
  'PAID',
  'CONFIRMED',
  'CANCELLED'
];

function normalizeSeasonLabel(seasonName: string | null | undefined) {
  return (seasonName ?? '')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase();
}

function formatDate(value: string | null | undefined) {
  if (!value) return '-';
  return new Date(value).toLocaleDateString('fr-FR');
}

function formatDateRange(startDate: string | null | undefined, endDate: string | null | undefined) {
  if (!startDate && !endDate) return '-';
  if (startDate && endDate) return `${formatDate(startDate)} - ${formatDate(endDate)}`;
  return formatDate(startDate ?? endDate);
}

function orderStatusLabel(status: OrderStatus | string | null | undefined) {
  switch (status) {
    case 'REQUESTED':
      return 'Demandée';
    case 'VALIDATED':
      return 'Validée';
    case 'BOOKED':
      return 'Réservée';
    case 'PAID':
      return 'Payée';
    case 'CONFIRMED':
      return 'Confirmée';
    case 'CANCELLED':
      return 'Annulée';
    case 'CART':
      return 'Panier';
    default:
      return status ?? '-';
  }
}

function orderStatusBadgeClassName(status: OrderStatus | string | null | undefined) {
  switch (status) {
    case 'REQUESTED':
      return 'bg-amber-100 text-amber-900';
    case 'VALIDATED':
      return 'bg-sky-100 text-sky-900';
    case 'BOOKED':
      return 'bg-indigo-100 text-indigo-900';
    case 'PAID':
      return 'bg-emerald-100 text-emerald-900';
    case 'CONFIRMED':
      return 'bg-emerald-200 text-emerald-950';
    case 'CANCELLED':
      return 'bg-rose-100 text-rose-900';
    default:
      return 'bg-slate-100 text-slate-700';
  }
}

function participantSummary(count: number) {
  return count > 1 ? `${count} participants` : `${count} participant`;
}

function buildOrderStatusUpdate(
  current: {
    requested_at: string | null;
    validated_at: string | null;
    booked_at: string | null;
    paid_at: string | null;
  },
  nextStatus: OrderStatus
): OrderUpdate {
  const now = new Date().toISOString();
  const update: OrderUpdate = {
    status: nextStatus,
    cancelled_at: nextStatus === 'CANCELLED' ? now : null
  };

  if (nextStatus === 'REQUESTED') {
    update.requested_at = current.requested_at ?? now;
    return update;
  }

  if (nextStatus === 'VALIDATED') {
    update.requested_at = current.requested_at ?? now;
    update.validated_at = current.validated_at ?? now;
    return update;
  }

  if (nextStatus === 'BOOKED') {
    update.requested_at = current.requested_at ?? now;
    update.validated_at = current.validated_at ?? now;
    update.booked_at = current.booked_at ?? now;
    return update;
  }

  if (nextStatus === 'PAID' || nextStatus === 'CONFIRMED') {
    update.requested_at = current.requested_at ?? now;
    update.validated_at = current.validated_at ?? now;
    update.booked_at = current.booked_at ?? now;
    update.paid_at = current.paid_at ?? now;
    return update;
  }

  return update;
}

export const dynamic = 'force-dynamic';
export const revalidate = 0;

export default async function AdminRequestsPage({ searchParams }: { searchParams?: SearchParams }) {
  await requireRole('ADMIN');

  const { status, season } = searchParams ? await searchParams : {};
  const normalizedSeasonFilter = normalizeSeasonLabel(season);
  const redirectTo = `/admin/reservations${
    status || season
      ? `?${new URLSearchParams({
          ...(status ? { status } : {}),
          ...(season ? { season } : {})
        }).toString()}`
      : ''
  }`;

  const supabase = getServerSupabaseClient();
  const { data: ordersRaw, error } = await supabase
    .from('orders')
    .select(
      'id,status,created_at,requested_at,validated_at,booked_at,paid_at,client_user_id,collectivity_id'
    )
    .neq('status', 'CART')
    .order('created_at', { ascending: false });

  const orders = ordersRaw ?? [];
  const orderIds = orders.map((order) => order.id);

  const { data: orderItemsRaw } = orderIds.length
    ? await supabase
        .from('order_items')
        .select('order_id,session_id,child_first_name,child_last_name')
        .in('order_id', orderIds)
    : { data: [] };

  const orderItems = orderItemsRaw ?? [];
  const sessionIds = Array.from(new Set(orderItems.map((item) => item.session_id).filter((value): value is string => Boolean(value))));
  const clientUserIds = Array.from(new Set(orders.map((order) => order.client_user_id).filter((value): value is string => Boolean(value))));
  const collectivityIds = Array.from(new Set(orders.map((order) => order.collectivity_id).filter((value): value is string => Boolean(value))));

  const [{ data: sessionsRaw }, { data: clientsRaw }, { data: collectivitiesRaw }] = await Promise.all([
    sessionIds.length
      ? supabase.from('sessions').select('id,start_date,end_date,stay_id').in('id', sessionIds)
      : Promise.resolve({ data: [] }),
    clientUserIds.length
      ? supabase.from('clients').select('user_id,full_name').in('user_id', clientUserIds)
      : Promise.resolve({ data: [] }),
    collectivityIds.length
      ? supabase.from('collectivities').select('id,name').in('id', collectivityIds)
      : Promise.resolve({ data: [] })
  ]);

  const sessions = sessionsRaw ?? [];
  const clients = clientsRaw ?? [];
  const collectivities = collectivitiesRaw ?? [];
  const stayIds = Array.from(new Set(sessions.map((session) => session.stay_id).filter(Boolean)));

  const { data: staysRaw } = stayIds.length
    ? await supabase.from('stays').select('id,title,season_id').in('id', stayIds)
    : { data: [] };

  const stays = staysRaw ?? [];
  const seasonIds = Array.from(new Set(stays.map((stay) => stay.season_id).filter(Boolean)));

  const { data: seasonsRaw } = seasonIds.length
    ? await supabase.from('seasons').select('id,name').in('id', seasonIds)
    : { data: [] };

  const seasons = seasonsRaw ?? [];
  const itemsByOrderId = new Map<string, typeof orderItems>();

  for (const item of orderItems) {
    const existing = itemsByOrderId.get(item.order_id) ?? [];
    existing.push(item);
    itemsByOrderId.set(item.order_id, existing);
  }

  const sessionsById = new Map(sessions.map((session) => [session.id, session]));
  const staysById = new Map(stays.map((stay) => [stay.id, stay]));
  const seasonsById = new Map(seasons.map((seasonItem) => [seasonItem.id, seasonItem.name]));
  const clientsByUserId = new Map(clients.map((client) => [client.user_id, client.full_name]));
  const collectivitiesById = new Map(
    collectivities.map((collectivity) => [collectivity.id, collectivity.name])
  );

  const reservations = orders
    .map((order) => {
      const items = itemsByOrderId.get(order.id) ?? [];
      const firstItem = items[0];
      const session = firstItem?.session_id ? sessionsById.get(firstItem.session_id) : null;
      const stay = session?.stay_id ? staysById.get(session.stay_id) : null;
      const seasonName = stay?.season_id ? seasonsById.get(stay.season_id) ?? null : null;
      const participantNames = items
        .map((item) => [item.child_first_name, item.child_last_name].filter(Boolean).join(' ').trim())
        .filter(Boolean);

      return {
        ...order,
        stayTitle: stay?.title ?? 'Séjour inconnu',
        sessionLabel: formatDateRange(session?.start_date, session?.end_date),
        seasonName,
        clientName: clientsByUserId.get(order.client_user_id) ?? participantNames[0] ?? 'Client inconnu',
        participantCount: items.length,
        collectivityName: order.collectivity_id
          ? collectivitiesById.get(order.collectivity_id) ?? 'Collectivité inconnue'
          : 'Famille directe'
      };
    })
    .filter((reservation) => {
      if (status && reservation.status !== status) return false;
      if (
        normalizedSeasonFilter &&
        normalizeSeasonLabel(reservation.seasonName) !== normalizedSeasonFilter
      ) {
        return false;
      }
      return true;
    });

  const activeFilters = [
    status ? `statut ${status}` : null,
    season ? `saison ${season}` : null
  ].filter(Boolean);

  async function updateStatus(formData: FormData) {
    'use server';

    const supabase = getServerSupabaseClient();
    const orderId = String(formData.get('orderId') ?? '');
    const nextStatus = String(formData.get('status') ?? '') as OrderStatus;
    const target = String(formData.get('redirectTo') || '/admin/reservations');

    if (!orderId || !ADMIN_ORDER_STATUSES.includes(nextStatus)) {
      redirect(target);
    }

    const { data: currentOrder } = await supabase
      .from('orders')
      .select('requested_at,validated_at,booked_at,paid_at')
      .eq('id', orderId)
      .maybeSingle();

    if (currentOrder) {
      await supabase
        .from('orders')
        .update(buildOrderStatusUpdate(currentOrder, nextStatus))
        .eq('id', orderId);
    }

    redirect(target);
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="admin-page-title">Toutes les réservations</h1>
        <p className="admin-page-subtitle mt-1">Suivi des commandes et de leur statut réel dans Supabase.</p>
      </div>
      {activeFilters.length ? (
        <div className="flex flex-wrap items-center gap-3 rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm text-slate-600">
          <span>Filtre actif : {activeFilters.join(' | ')}</span>
          <Link href="/admin/reservations" prefetch={false} className="font-semibold text-slate-900">
            Réinitialiser
          </Link>
        </div>
      ) : null}
      <div className="overflow-hidden rounded-2xl border border-slate-200 bg-white">
        <div className="overflow-x-auto">
          <table className="min-w-[1120px] w-full text-left text-sm">
            <thead className="bg-slate-50 text-xs uppercase text-slate-500">
              <tr>
                <th className="px-4 py-3">Séjour</th>
                <th className="px-4 py-3">Session</th>
                <th className="px-4 py-3">Client</th>
                <th className="px-4 py-3">Collectivité</th>
                <th className="px-4 py-3">Statut</th>
                <th className="px-4 py-3"></th>
              </tr>
            </thead>
            <tbody>
              {reservations.map((reservation) => (
                <tr key={reservation.id} className="border-t border-slate-100 align-top">
                  <td className="px-4 py-3">
                    <div className="font-medium text-slate-900">{reservation.stayTitle}</div>
                    <div className="mt-1 text-xs text-slate-500">{reservation.seasonName ?? '-'}</div>
                  </td>
                  <td className="px-4 py-3 text-slate-600">{reservation.sessionLabel}</td>
                  <td className="px-4 py-3">
                    <div className="text-slate-900">{reservation.clientName}</div>
                    <div className="mt-1 text-xs text-slate-500">
                      {reservation.participantCount > 0
                        ? participantSummary(reservation.participantCount)
                        : 'Participant inconnu'}
                    </div>
                  </td>
                  <td className="px-4 py-3 text-slate-600">{reservation.collectivityName}</td>
                  <td className="px-4 py-3">
                    <span
                      className={`inline-flex rounded-full px-2.5 py-1 text-xs font-semibold ${orderStatusBadgeClassName(
                        reservation.status
                      )}`}
                    >
                      {orderStatusLabel(reservation.status)}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-right">
                    <form action={updateStatus} className="flex items-center justify-end gap-2">
                      <input type="hidden" name="orderId" value={reservation.id} />
                      <input type="hidden" name="redirectTo" value={redirectTo} />
                      <select
                        name="status"
                        defaultValue={reservation.status}
                        className="rounded border border-slate-200 px-2 py-1 text-xs"
                      >
                        {ADMIN_ORDER_STATUSES.map((statusOption) => (
                          <option key={statusOption} value={statusOption}>
                            {orderStatusLabel(statusOption)}
                          </option>
                        ))}
                      </select>
                      <button className="rounded bg-emerald-600 px-2 py-1 text-xs font-semibold text-white">
                        OK
                      </button>
                    </form>
                  </td>
                </tr>
              ))}
              {reservations.length === 0 && (
                <tr>
                  <td className="px-4 py-6 text-slate-500" colSpan={6}>
                    {error?.message ? `Erreur: ${error.message}` : 'Aucune réservation pour ce filtre.'}
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
