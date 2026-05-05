import Link from 'next/link';
import OrganizerPageHeader from '@/components/organisme/OrganizerPageHeader';
import OrganizerReservationDetailsModal from '@/components/organisme/OrganizerReservationDetailsModal';
import { canAccessOrganizerSection } from '@/lib/organizer-access';
import { requireOrganizerPageAccess } from '@/lib/organizer-backoffice-access.server';
import { withOrganizerQuery } from '@/lib/organizers.server';
import { getServerSupabaseClient } from '@/lib/supabase/server';
import type { Database } from '@/types/supabase';

type PageProps = {
  searchParams?: Promise<{
    organizerId?: string | string[];
  }>;
};

type OrderStatus = Database['public']['Enums']['order_status'];
type ClientProfileReservationDetails = Pick<
  Database['public']['Tables']['client_profiles']['Row'],
  | 'user_id'
  | 'parent1_email'
  | 'parent1_phone'
  | 'parent2_phone'
  | 'payment_mode'
  | 'vacaf_number'
  | 'address_line1'
  | 'address_line2'
  | 'postal_code'
  | 'city'
  | 'country'
  | 'has_separate_billing_address'
  | 'billing_address_line1'
  | 'billing_address_line2'
  | 'billing_postal_code'
  | 'billing_city'
  | 'billing_country'
>;

const PAYMENT_MODE_LABELS: Record<string, string> = {
  FULL: 'Paiement de la totalité en CB',
  DEPOSIT_200: "Paiement d'un acompte (200 €) en CB",
  CV_CONNECT: 'Paiement en ANCV Connect',
  CV_PAPER: 'Paiement en ANCV papier',
  DEFERRED: 'Paiement différé'
};

function formatDate(value: string | null | undefined) {
  if (!value) return '-';
  return new Date(value).toLocaleDateString('fr-FR');
}

function formatDateRange(startDate: string | null | undefined, endDate: string | null | undefined) {
  if (!startDate && !endDate) return '-';
  if (startDate && endDate) return `${formatDate(startDate)} - ${formatDate(endDate)}`;
  return formatDate(startDate ?? endDate);
}

function formatEuroFromCents(value: number | null | undefined, currency = 'EUR') {
  if (value == null || !Number.isFinite(value)) return '-';
  return new Intl.NumberFormat('fr-FR', {
    style: 'currency',
    currency,
    minimumFractionDigits: 2,
    maximumFractionDigits: 2
  }).format(value / 100);
}

function participantSummary(count: number) {
  return count > 1 ? `${count} participants` : `${count} participant`;
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

function formatText(value: string | null | undefined, fallback = 'Non renseigné') {
  const trimmed = String(value ?? '').trim();
  return trimmed || fallback;
}

function formatAddress(parts: Array<string | null | undefined>, fallback = 'Non renseignée') {
  const formatted = parts.map((value) => String(value ?? '').trim()).filter(Boolean).join(', ');
  return formatted || fallback;
}

export const dynamic = 'force-dynamic';
export const revalidate = 0;

export default async function OrganizerRequestsPage({ searchParams }: PageProps) {
  const resolvedSearchParams = searchParams ? await searchParams : undefined;
  const { selectedOrganizerId, accessRole } = await requireOrganizerPageAccess({
    requestedOrganizerId: resolvedSearchParams?.organizerId,
    requiredSection: 'reservations'
  });
  const canAccessStays = canAccessOrganizerSection(accessRole, 'stays');
  const supabase = getServerSupabaseClient();

  const { data: staysRaw } = await supabase
    .from('stays')
    .select('id,title')
    .eq('organizer_id', selectedOrganizerId);

  const stays = staysRaw ?? [];
  const stayIds = stays.map((stay) => stay.id);

  const { data: sessionsRaw } = stayIds.length
    ? await supabase
        .from('sessions')
        .select('id,start_date,end_date,stay_id')
        .in('stay_id', stayIds)
    : { data: [] };

  const sessions = sessionsRaw ?? [];
  const sessionIds = sessions.map((session) => session.id);

  const { data: orderItemsRaw } = sessionIds.length
    ? await supabase
        .from('order_items')
        .select('order_id,session_id,child_first_name,child_last_name')
        .in('session_id', sessionIds)
    : { data: [] };

  const orderItems = orderItemsRaw ?? [];
  const orderIds = Array.from(new Set(orderItems.map((item) => item.order_id).filter(Boolean)));

  const { data: ordersRaw } = orderIds.length
    ? await supabase
        .from('orders')
        .select('id,status,created_at,client_user_id,collectivity_id')
        .in('id', orderIds)
        .neq('status', 'CART')
        .order('created_at', { ascending: false })
    : { data: [] };

  const orders = ordersRaw ?? [];
  const clientUserIds = Array.from(
    new Set(orders.map((order) => order.client_user_id).filter((value): value is string => Boolean(value)))
  );
  const collectivityIds = Array.from(
    new Set(orders.map((order) => order.collectivity_id).filter((value): value is string => Boolean(value)))
  );

  const [{ data: clientsRaw }, { data: collectivitiesRaw }] = await Promise.all([
    clientUserIds.length
      ? supabase.from('clients').select('user_id,full_name').in('user_id', clientUserIds)
      : Promise.resolve({ data: [] }),
    collectivityIds.length
      ? supabase.from('collectivities').select('id,name').in('id', collectivityIds)
      : Promise.resolve({ data: [] })
  ]);

  const { data: paymentsRaw } = orderIds.length
    ? await supabase
        .from('payments')
        .select('order_id,amount_cents,currency,created_at')
        .in('order_id', orderIds)
        .order('created_at', { ascending: false })
    : { data: [] };

  const { data: profilesRaw } = clientUserIds.length
    ? await supabase
        .from('client_profiles')
        .select(
          [
            'user_id',
            'parent1_email',
            'parent1_phone',
            'parent2_phone',
            'payment_mode',
            'vacaf_number',
            'address_line1',
            'address_line2',
            'postal_code',
            'city',
            'country',
            'has_separate_billing_address',
            'billing_address_line1',
            'billing_address_line2',
            'billing_postal_code',
            'billing_city',
            'billing_country'
          ].join(',')
        )
        .in('user_id', clientUserIds)
    : { data: [] };
  const profiles = ((profilesRaw ?? []) as unknown) as ClientProfileReservationDetails[];

  const itemsByOrderId = new Map<string, typeof orderItems>();
  for (const item of orderItems) {
    const existing = itemsByOrderId.get(item.order_id) ?? [];
    existing.push(item);
    itemsByOrderId.set(item.order_id, existing);
  }

  const sessionsById = new Map(sessions.map((session) => [session.id, session]));
  const staysById = new Map(stays.map((stay) => [stay.id, stay]));
  const clientsByUserId = new Map((clientsRaw ?? []).map((client) => [client.user_id, client.full_name]));
  const profilesByUserId = new Map(profiles.map((profile) => [profile.user_id, profile]));
  const paymentsByOrderId = new Map<string, { amount_cents: number; currency: string }>();
  for (const payment of paymentsRaw ?? []) {
    if (!paymentsByOrderId.has(payment.order_id)) {
      paymentsByOrderId.set(payment.order_id, {
        amount_cents: payment.amount_cents,
        currency: payment.currency
      });
    }
  }
  const collectivitiesById = new Map(
    (collectivitiesRaw ?? []).map((collectivity) => [collectivity.id, collectivity.name])
  );

  const reservations = orders.map((order) => {
    const items = itemsByOrderId.get(order.id) ?? [];
    const firstItem = items[0];
    const session = firstItem?.session_id ? sessionsById.get(firstItem.session_id) : null;
    const stay = session?.stay_id ? staysById.get(session.stay_id) : null;
    const profile = order.client_user_id ? profilesByUserId.get(order.client_user_id) : null;
    const payment = paymentsByOrderId.get(order.id);
    const participantNames = items
      .map((item) => [item.child_first_name, item.child_last_name].filter(Boolean).join(' ').trim())
      .filter(Boolean);

    return {
      id: order.id,
      stayTitle: stay?.title ?? 'Séjour inconnu',
      sessionLabel: formatDateRange(session?.start_date, session?.end_date),
      clientName: clientsByUserId.get(order.client_user_id) ?? participantNames[0] ?? 'Client inconnu',
      participantName: participantNames[0] ?? 'Participant inconnu',
      participantCount: items.length,
      amountLabel: formatEuroFromCents(payment?.amount_cents, payment?.currency ?? 'EUR'),
      collectivityName: order.collectivity_id
        ? collectivitiesById.get(order.collectivity_id) ?? 'Collectivité inconnue'
        : 'Famille directe',
      status: order.status,
      details: {
        id: order.id,
        clientName: clientsByUserId.get(order.client_user_id) ?? participantNames[0] ?? 'Client inconnu',
        participantName: participantNames[0] ?? 'Participant inconnu',
        paymentModeLabel: PAYMENT_MODE_LABELS[profile?.payment_mode ?? ''] ?? 'Non renseigné',
        cafLabel: formatText(profile?.vacaf_number),
        ancvConnectLabel: profile?.payment_mode === 'CV_CONNECT' ? 'Oui' : 'Non',
        email: formatText(profile?.parent1_email),
        primaryPhone: formatText(profile?.parent1_phone),
        secondaryPhone: formatText(profile?.parent2_phone),
        postalAddress: formatAddress([
          profile?.address_line1,
          profile?.address_line2,
          profile?.postal_code,
          profile?.city,
          profile?.country
        ]),
        billingAddress: profile?.has_separate_billing_address
          ? formatAddress([
              profile?.billing_address_line1,
              profile?.billing_address_line2,
              profile?.billing_postal_code,
              profile?.billing_city,
              profile?.billing_country
            ])
          : formatAddress([
              profile?.address_line1,
              profile?.address_line2,
              profile?.postal_code,
              profile?.city,
              profile?.country
            ])
      }
    };
  });

  return (
    <div className="space-y-6">
      <OrganizerPageHeader
        title="Réservations"
        subtitle="Suivez les réservations liées à votre organisme."
      />
      <div className="organizer-table-shell">
        <div className="overflow-x-auto">
          <table className="organizer-table min-w-[1120px] w-full table-fixed">
            <thead>
              <tr>
                <th className="px-4 py-3">Client</th>
                <th className="px-4 py-3">Séjour</th>
                <th className="px-4 py-3">Session</th>
                <th className="px-4 py-3">Enfant</th>
                <th className="px-4 py-3">Statut</th>
                <th className="px-4 py-3">Collectivité</th>
                <th className="px-4 py-3 text-right">Montant</th>
                <th className="w-[140px] px-4 py-3 text-right">Détails</th>
              </tr>
            </thead>
            <tbody>
              {reservations.map((reservation) => (
                <tr key={reservation.id} className="border-t border-slate-100 align-top">
                  <td className="px-4 py-3">
                    <div className="text-slate-900">{reservation.clientName}</div>
                  </td>
                  <td className="px-4 py-3 font-medium text-slate-900">{reservation.stayTitle}</td>
                  <td className="px-4 py-3 text-slate-600">{reservation.sessionLabel}</td>
                  <td className="px-4 py-3">
                    <div className="text-slate-900">{reservation.participantName}</div>
                    <div className="mt-1 text-xs text-slate-500">
                      {reservation.participantCount > 0
                        ? participantSummary(reservation.participantCount)
                        : 'Participant inconnu'}
                    </div>
                  </td>
                  <td className="px-4 py-3">
                    <span
                      className={`inline-flex rounded-full px-2.5 py-1 text-xs font-semibold ${orderStatusBadgeClassName(
                        reservation.status
                      )}`}
                    >
                      {orderStatusLabel(reservation.status)}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-slate-600">{reservation.collectivityName}</td>
                  <td className="px-4 py-3 text-right font-medium text-slate-900">{reservation.amountLabel}</td>
                  <td className="w-[140px] px-4 py-3 text-right">
                    <OrganizerReservationDetailsModal reservation={reservation.details} />
                  </td>
                </tr>
              ))}
              {reservations.length === 0 && (
                <tr>
                  <td className="px-4 py-8 text-slate-500" colSpan={8}>
                    <p>Aucune réservation liée à cet organisme pour le moment.</p>
                    {canAccessStays ? (
                      <p className="mt-2 text-sm">
                        <Link
                          href={withOrganizerQuery('/organisme/sejours', selectedOrganizerId)}
                          className="font-semibold text-emerald-700 underline"
                        >
                          Vérifier les séjours publiés
                        </Link>
                      </p>
                    ) : null}
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
