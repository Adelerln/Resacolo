import Link from 'next/link';
import { redirect } from 'next/navigation';
import { revalidatePath } from 'next/cache';
import OrganizerPageHeader from '@/components/organisme/OrganizerPageHeader';
import OrganizerReservationDetailsModal from '@/components/organisme/OrganizerReservationDetailsModal';
import { OrganizerCancellationForm } from '@/components/organisme/OrganizerCancellationForm';
import { canAccessOrganizerSection } from '@/lib/organizer-access';
import { requireOrganizerPageAccess } from '@/lib/organizer-backoffice-access.server';
import {
  formatOrderReservationCode,
  orderStatusBadgeClassName,
  orderStatusLabel,
  parseAmountEurosToCents,
  resolveStatusAfterRequestResolution
} from '@/lib/order-workflow';
import { computePartnerContributionSnapshotCents } from '@/lib/partner-offers';
import { withOrganizerQuery } from '@/lib/organizers.server';
import { isMissingAnyColumnError } from '@/lib/supabase-schema-errors';
import { getServerSupabaseClient } from '@/lib/supabase/server';
import { formatVacafNumberWithDepartment } from '@/lib/vacaf-number';
import type { Database } from '@/types/supabase';

type PageProps = {
  searchParams?: Promise<{
    organizerId?: string | string[];
    error?: string | string[];
    cancelled?: string | string[];
  }>;
};

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

function parsePaymentModeFromPayload(rawPayload: unknown) {
  if (!rawPayload || typeof rawPayload !== 'object' || Array.isArray(rawPayload)) return 'FULL';
  const contact = (rawPayload as Record<string, unknown>).contact;
  if (!contact || typeof contact !== 'object' || Array.isArray(contact)) return 'FULL';
  const paymentMode = (contact as Record<string, unknown>).paymentMode;
  if (typeof paymentMode === 'string' && paymentMode in PAYMENT_MODE_LABELS) {
    return paymentMode;
  }
  return 'FULL';
}

function parseContactStringFromPayload(rawPayload: unknown, key: string) {
  if (!rawPayload || typeof rawPayload !== 'object' || Array.isArray(rawPayload)) return null;
  const contact = (rawPayload as Record<string, unknown>).contact;
  if (!contact || typeof contact !== 'object' || Array.isArray(contact)) return null;
  const value = (contact as Record<string, unknown>)[key];
  if (typeof value !== 'string') return null;
  const trimmed = value.trim();
  return trimmed || null;
}

function firstNonEmpty(...values: Array<string | null | undefined>) {
  for (const value of values) {
    const trimmed = String(value ?? '').trim();
    if (trimmed) return trimmed;
  }
  return null;
}

function parseVacafDepartmentFromPayload(rawPayload: unknown, organizerId?: string | null) {
  const fromContact = parseContactStringFromPayload(rawPayload, 'vacafDepartmentCode');
  if (fromContact) return fromContact;
  if (!rawPayload || typeof rawPayload !== 'object' || Array.isArray(rawPayload)) return null;
  const contact = (rawPayload as Record<string, unknown>).contact;
  if (!contact || typeof contact !== 'object' || Array.isArray(contact)) return null;
  const selections = (contact as Record<string, unknown>).organizerSelections;
  if (!selections || typeof selections !== 'object' || Array.isArray(selections)) return null;
  if (organizerId) {
    const selection = (selections as Record<string, unknown>)[organizerId];
    if (selection && typeof selection === 'object' && !Array.isArray(selection)) {
      const code = (selection as Record<string, unknown>).vacafDepartmentCode;
      if (typeof code === 'string' && code.trim()) return code.trim();
    }
  }
  for (const selection of Object.values(selections as Record<string, unknown>)) {
    if (!selection || typeof selection !== 'object' || Array.isArray(selection)) continue;
    const code = (selection as Record<string, unknown>).vacafDepartmentCode;
    if (typeof code === 'string' && code.trim()) return code.trim();
  }
  return null;
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

  async function resolveRequest(formData: FormData) {
    'use server';

    const requestedOrganizerId = String(formData.get('organizer_id') ?? '').trim();
    const organizerAccess = await requireOrganizerPageAccess({
      requestedOrganizerId,
      requiredSection: 'reservations'
    });
    const organizerId = organizerAccess.selectedOrganizerId;
    const orderId = String(formData.get('order_id') ?? '').trim();
    const requestKind = String(formData.get('request_kind') ?? '').trim();
    const amountCents = parseAmountEurosToCents(String(formData.get('resolved_amount_euros') ?? ''));

    if (!organizerId || !orderId || (requestKind !== 'VACAF' && requestKind !== 'ANCV_CONNECT')) {
      redirect(withOrganizerQuery('/organisme/reservations', organizerId));
    }

    const supabase = getServerSupabaseClient();
    const { data: orderRow, error: orderError } = await supabase
      .from('orders')
      .select('id,status,request_kind,vacaf_number_snapshot,ancv_connect_matricule,external_aid_cents,external_paid_cents')
      .eq('id', orderId)
      .maybeSingle();

    let resolvedOrder = orderRow;
    if (orderError && isMissingAnyColumnError(orderError, ['vacaf_number_snapshot', 'ancv_connect_matricule'])) {
      const { data: legacyOrder } = await supabase
        .from('orders')
        .select('id,status,request_kind,external_aid_cents,external_paid_cents')
        .eq('id', orderId)
        .maybeSingle();
      resolvedOrder = legacyOrder
        ? {
            ...legacyOrder,
            vacaf_number_snapshot: null,
            ancv_connect_matricule: null
          }
        : null;
    } else if (orderError || !orderRow) {
      redirect(withOrganizerQuery('/organisme/reservations', organizerId));
    }

    if (!resolvedOrder) {
      redirect(withOrganizerQuery('/organisme/reservations', organizerId));
    }

    const hasVacafSnapshot = Boolean(String(resolvedOrder.vacaf_number_snapshot ?? '').trim());
    const hasAncvMatricule = Boolean(String(resolvedOrder.ancv_connect_matricule ?? '').trim());
    const canResolveVacaf =
      requestKind === 'VACAF' &&
      (resolvedOrder.request_kind === 'VACAF' || hasVacafSnapshot || resolvedOrder.request_kind == null);
    const canResolveAncv =
      requestKind === 'ANCV_CONNECT' &&
      (resolvedOrder.request_kind === 'ANCV_CONNECT' || hasAncvMatricule || resolvedOrder.request_kind == null);

    if (!canResolveVacaf && !canResolveAncv) {
      redirect(withOrganizerQuery('/organisme/reservations', organizerId));
    }

    if (amountCents <= 0) {
      redirect(
        withOrganizerQuery(
          `/organisme/reservations?error=${encodeURIComponent('Indiquez un montant de prise en charge valide.')}`,
          organizerId
        )
      );
    }

    const orderRowForResolution = resolvedOrder;

    const { data: orderItemsRaw, error: itemsError } = await supabase
      .from('order_items')
      .select('id,total_price_cents,session_id')
      .eq('order_id', orderId);

    if (itemsError || !orderItemsRaw || orderItemsRaw.length === 0) {
      redirect(withOrganizerQuery('/organisme/reservations', organizerId));
    }
    const orderItems = orderItemsRaw;

    const sessionIds = Array.from(new Set(orderItems.map((item) => item.session_id).filter(Boolean)));
    const { data: sessions } = sessionIds.length
      ? await supabase.from('sessions').select('id,stay_id').in('id', sessionIds)
      : { data: [] };
    const stayIds = Array.from(new Set((sessions ?? []).map((item) => item.stay_id).filter(Boolean)));
    const { data: stays } = stayIds.length
      ? await supabase.from('stays').select('id,organizer_id').in('id', stayIds)
      : { data: [] };

    if ((stays ?? []).some((stay) => stay.organizer_id !== organizerId)) {
      redirect(withOrganizerQuery('/organisme/reservations', organizerId));
    }

    const { data: successfulPayments } = await supabase
      .from('payments')
      .select('amount_cents,status')
      .eq('order_id', orderId)
      .eq('status', 'SUCCEEDED');
    const onlinePaidCents = (successfulPayments ?? []).reduce((sum, payment) => sum + (payment.amount_cents ?? 0), 0);
    const totalCents = orderItems.reduce((sum, item) => sum + (item.total_price_cents ?? 0), 0);
    const orderItemIds = orderItems.map((item) => item.id);
    const { data: contributionRows } = orderItemIds.length
      ? await supabase
          .from('collectivity_contributions')
          .select('order_item_id,mode,fixed_cents,percent_value,cap_cents')
          .in('order_item_id', orderItemIds)
          .eq('status', 'APPROVED')
      : { data: [] };
    const contributionByOrderItemId = new Map((contributionRows ?? []).map((row) => [row.order_item_id, row]));
    const partnerContributionCents = orderItems.reduce((sum, item) => {
      const contribution = contributionByOrderItemId.get(item.id);
      if (!contribution) return sum;
      return (
        sum +
        computePartnerContributionSnapshotCents({
          mode: contribution.mode,
          totalCents: item.total_price_cents ?? 0,
          percentValue: contribution.percent_value,
          fixedCents: contribution.fixed_cents,
          capCents: contribution.cap_cents
        })
      );
    }, 0);
    const familyPayableTotalCents = Math.max(0, totalCents - partnerContributionCents);
    const nextExternalAidCents = requestKind === 'VACAF' ? amountCents : orderRowForResolution.external_aid_cents ?? 0;
    const nextExternalPaidCents = requestKind === 'ANCV_CONNECT' ? amountCents : orderRowForResolution.external_paid_cents ?? 0;
    const nextStatus = resolveStatusAfterRequestResolution({
      totalCents: familyPayableTotalCents,
      externalAidCents: nextExternalAidCents,
      externalPaidCents: nextExternalPaidCents,
      onlinePaidCents
    });
    const now = new Date().toISOString();

    const { error: updateError } = await supabase
      .from('orders')
      .update({
        request_kind: requestKind,
        external_aid_cents: nextExternalAidCents,
        external_paid_cents: nextExternalPaidCents,
        request_resolved_at: now,
        status: nextStatus,
        paid_at: nextStatus === 'PAID' ? now : null,
        partially_paid_at: nextStatus === 'PARTIALLY_PAID' ? now : null
      })
      .eq('id', orderId);

    if (updateError) {
      redirect(
        withOrganizerQuery(
          `/organisme/reservations?error=${encodeURIComponent(updateError.message)}`,
          organizerId
        )
      );
    }

    if (nextStatus === 'PAID') {
      try {
        const { ensureClientTravelInvoiceForOrder } = await import('@/lib/client-travel-invoice.server');
        await ensureClientTravelInvoiceForOrder(orderId);
      } catch (invoiceError) {
        console.error('organisme/reservations: génération facture client échouée', invoiceError);
      }
    }

    revalidatePath(withOrganizerQuery('/organisme/reservations', organizerId));
    redirect(withOrganizerQuery('/organisme/reservations', organizerId));
  }

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
  const sessionsById = new Map(sessions.map((session) => [session.id, session]));
  const staysById = new Map(stays.map((stay) => [stay.id, stay]));
  const sessionIds = sessions.map((session) => session.id);

  type OrderItemRow = {
    order_id: string;
    session_id: string | null;
    child_first_name: string | null;
    child_last_name: string | null;
    total_price_cents: number | null;
  };

  const orderItemsByKey = new Map<string, OrderItemRow>();
  function addOrderItems(rows: OrderItemRow[] | null | undefined) {
    for (const row of rows ?? []) {
      if (!row.order_id) continue;
      const key = `${row.order_id}:${row.session_id ?? ''}:${row.child_first_name ?? ''}:${row.child_last_name ?? ''}:${row.total_price_cents ?? 0}`;
      orderItemsByKey.set(key, row);
    }
  }

  // 1) Lignes explicitement rattachées à l’organisme
  const byOrganizerResult = await supabase
    .from('order_items')
    .select('order_id,session_id,child_first_name,child_last_name,total_price_cents')
    .eq('organizer_id', selectedOrganizerId);
  if (byOrganizerResult.error) {
    console.error('organisme/reservations: order_items by organizer_id', byOrganizerResult.error);
  } else {
    addOrderItems(byOrganizerResult.data);
  }

  // 2) Lignes via sessions des séjours de l’organisme (filet de sécurité si organizer_id absent / faux)
  if (sessionIds.length > 0) {
    const bySessionResult = await supabase
      .from('order_items')
      .select('order_id,session_id,child_first_name,child_last_name,total_price_cents')
      .in('session_id', sessionIds);
    if (bySessionResult.error) {
      console.error('organisme/reservations: order_items by session_id', bySessionResult.error);
    } else {
      addOrderItems(bySessionResult.data);
    }
  }

  // 3) Commandes dont le paiement pointe encore vers cet organisme (payload checkout)
  const orderIdsFromPayments = new Set<string>();
  const paymentsByOrganizerFilter = await supabase
    .from('payments')
    .select('order_id')
    .filter('raw_payload->>organizerId', 'eq', selectedOrganizerId)
    .order('created_at', { ascending: false })
    .limit(300);

  if (!paymentsByOrganizerFilter.error && paymentsByOrganizerFilter.data?.length) {
    for (const payment of paymentsByOrganizerFilter.data) {
      if (payment.order_id) orderIdsFromPayments.add(payment.order_id);
    }
  } else if (paymentsByOrganizerFilter.error) {
    console.error('organisme/reservations: payments by organizerId filter', paymentsByOrganizerFilter.error);
  }

  const knownOrderIds = Array.from(
    new Set([
      ...Array.from(orderItemsByKey.values()).map((item) => item.order_id),
      ...Array.from(orderIdsFromPayments)
    ])
  );

  // Compléter les lignes manquantes pour les commandes trouvées seulement via payments
  const orderIdsMissingItems = knownOrderIds.filter(
    (orderId) => !Array.from(orderItemsByKey.values()).some((item) => item.order_id === orderId)
  );
  if (orderIdsMissingItems.length > 0) {
    const { data: missingItems, error: missingItemsError } = await supabase
      .from('order_items')
      .select('order_id,session_id,child_first_name,child_last_name,total_price_cents')
      .in('order_id', orderIdsMissingItems);
    if (missingItemsError) {
      console.error('organisme/reservations: order_items by order_id', missingItemsError);
    } else {
      addOrderItems(missingItems);
    }
  }

  const orderItems = Array.from(orderItemsByKey.values());
  const orderIds = Array.from(
    new Set([...orderItems.map((item) => item.order_id).filter(Boolean), ...knownOrderIds])
  );

  const ordersSelectFull =
    'id,status,created_at,cancellation_reason,client_user_id,collectivity_id,request_kind,vacaf_number_snapshot,ancv_connect_matricule,ancv_connect_requested_amount_cents,external_aid_cents,external_paid_cents';

  let orders: Array<{
    id: string;
    status: Database['public']['Enums']['order_status'];
    created_at: string;
    cancellation_reason: string | null;
    client_user_id: string | null;
    collectivity_id: string | null;
    request_kind: string | null;
    vacaf_number_snapshot: string | null;
    ancv_connect_matricule: string | null;
    ancv_connect_requested_amount_cents: number | null;
    external_aid_cents: number | null;
    external_paid_cents: number | null;
  }> = [];
  let ordersLoadError: string | null = null;

  if (orderIds.length > 0) {
    const ordersResult = await supabase
      .from('orders')
      .select(ordersSelectFull)
      .in('id', orderIds)
      .neq('status', 'CART')
      .order('created_at', { ascending: false });

    if (
      ordersResult.error &&
      isMissingAnyColumnError(ordersResult.error, [
        'request_kind',
        'vacaf_number_snapshot',
        'ancv_connect_matricule',
        'ancv_connect_requested_amount_cents',
        'external_aid_cents',
        'external_paid_cents',
        'cancellation_reason'
      ])
    ) {
      const legacy = await supabase
        .from('orders')
        .select('id,status,created_at,client_user_id,collectivity_id')
        .in('id', orderIds)
        .neq('status', 'CART')
        .order('created_at', { ascending: false });
      if (legacy.error) {
        ordersLoadError = legacy.error.message;
        console.error('organisme/reservations: orders legacy', legacy.error);
      } else {
        orders = (legacy.data ?? []).map((order) => ({
          ...order,
          cancellation_reason: null,
          request_kind: null,
          vacaf_number_snapshot: null,
          ancv_connect_matricule: null,
          ancv_connect_requested_amount_cents: null,
          external_aid_cents: 0,
          external_paid_cents: 0
        }));
      }
    } else if (ordersResult.error) {
      ordersLoadError = ordersResult.error.message;
      console.error('organisme/reservations: orders', ordersResult.error);
    } else {
      orders = (ordersResult.data ?? []) as typeof orders;
    }
  }

  // Compléter sessions/séjours manquants pour l’affichage
  const missingSessionIds = Array.from(
    new Set(
      orderItems
        .map((item) => item.session_id)
        .filter((id): id is string => typeof id === 'string' && id.length > 0 && !sessionsById.has(id))
    )
  );
  if (missingSessionIds.length > 0) {
    const { data: extraSessions } = await supabase
      .from('sessions')
      .select('id,start_date,end_date,stay_id')
      .in('id', missingSessionIds);
    for (const session of extraSessions ?? []) {
      sessionsById.set(session.id, session);
    }
    const missingStayIds = Array.from(
      new Set(
        (extraSessions ?? [])
          .map((session) => session.stay_id)
          .filter((id): id is string => Boolean(id) && !staysById.has(id))
      )
    );
    if (missingStayIds.length > 0) {
      const { data: extraStays } = await supabase.from('stays').select('id,title').in('id', missingStayIds);
      for (const stay of extraStays ?? []) {
        staysById.set(stay.id, stay);
      }
    }
  }

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
        .select('order_id,amount_cents,currency,created_at,raw_payload,status')
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

  const clientsByUserId = new Map((clientsRaw ?? []).map((client) => [client.user_id, client.full_name]));
  const profilesByUserId = new Map(profiles.map((profile) => [profile.user_id, profile]));
  const paymentsByOrderId = new Map<string, { amount_cents: number; currency: string; raw_payload: unknown; status: string }>();
  const onlinePaidCentsByOrderId = new Map<string, number>();
  for (const payment of paymentsRaw ?? []) {
    if (!paymentsByOrderId.has(payment.order_id)) {
      paymentsByOrderId.set(payment.order_id, {
        amount_cents: payment.amount_cents,
        currency: payment.currency,
        raw_payload: payment.raw_payload,
        status: payment.status
      });
    }
    if (payment.status === 'SUCCEEDED') {
      onlinePaidCentsByOrderId.set(
        payment.order_id,
        (onlinePaidCentsByOrderId.get(payment.order_id) ?? 0) + Math.max(0, payment.amount_cents ?? 0)
      );
    }
  }
  const collectivitiesById = new Map(
    (collectivitiesRaw ?? []).map((collectivity) => [collectivity.id, collectivity.name])
  );

  const reservations = orders
    .filter((order) => {
      const payment = paymentsByOrderId.get(order.id);
      if (order.status === 'FAILED' || (order.status === 'CANCELLED' && order.cancellation_reason === 'PAYMENT_FAILED')) {
        return false;
      }
      // Ne pas masquer une demande VACAF/ANCV si un paiement CB a échoué à côté.
      if (payment?.status === 'FAILED') {
        return order.status === 'REQUESTED' || Boolean(order.request_kind);
      }
      return true;
    })
    .map((order) => {
    const items = itemsByOrderId.get(order.id) ?? [];
    const firstItem = items[0];
    const session = firstItem?.session_id ? sessionsById.get(firstItem.session_id) : null;
    const stay = session?.stay_id ? staysById.get(session.stay_id) : null;
    const profile = order.client_user_id ? profilesByUserId.get(order.client_user_id) : null;
    const payment = paymentsByOrderId.get(order.id);
    const totalCents = items.reduce((sum, item) => sum + (item.total_price_cents ?? 0), 0);
    const participantNames = items
      .map((item) => [item.child_first_name, item.child_last_name].filter(Boolean).join(' ').trim())
      .filter(Boolean);
    const paymentMode = parsePaymentModeFromPayload(payment?.raw_payload);
    const cafNumberFromOrder = firstNonEmpty(
      order.vacaf_number_snapshot,
      parseContactStringFromPayload(payment?.raw_payload, 'vacafNumber')
    );
    const cafDepartmentCode = parseVacafDepartmentFromPayload(
      payment?.raw_payload,
      selectedOrganizerId
    );
    const cafNumber = firstNonEmpty(
      cafNumberFromOrder,
      order.request_kind === 'VACAF' ? profile?.vacaf_number : null
    );
    const cafNumberLabel = cafNumber
      ? formatVacafNumberWithDepartment(cafNumber, cafDepartmentCode)
      : null;
    const ancvConnectMatricule = firstNonEmpty(
      order.ancv_connect_matricule,
      parseContactStringFromPayload(payment?.raw_payload, 'ancvConnectMatricule')
    );
    const isAncvConnect =
      order.request_kind === 'ANCV_CONNECT' ||
      paymentMode === 'CV_CONNECT' ||
      Boolean(ancvConnectMatricule);
    const isVacafRequest = order.request_kind === 'VACAF' || Boolean(cafNumberFromOrder);
    const reservationCode = formatOrderReservationCode(order.id);
    const canEnterVacafCoverage =
      isVacafRequest &&
      order.status !== 'CANCELLED' &&
      order.status !== 'FAILED' &&
      order.status !== 'PAID';
    const canEnterAncvCoverage =
      isAncvConnect &&
      order.status !== 'CANCELLED' &&
      order.status !== 'FAILED' &&
      order.status !== 'PAID';
    const externalAidLabel =
      typeof order.external_aid_cents === 'number' && order.external_aid_cents > 0
        ? formatEuroFromCents(order.external_aid_cents, payment?.currency ?? 'EUR')
        : null;
    const externalPaidLabel =
      typeof order.external_paid_cents === 'number' && order.external_paid_cents > 0
        ? formatEuroFromCents(order.external_paid_cents, payment?.currency ?? 'EUR')
        : null;
    const ancvConnectRequestedAmountLabel =
      typeof order.ancv_connect_requested_amount_cents === 'number'
        ? formatEuroFromCents(order.ancv_connect_requested_amount_cents, payment?.currency ?? 'EUR')
        : firstNonEmpty(parseContactStringFromPayload(payment?.raw_payload, 'ancvConnectAmount'))
          ? `${firstNonEmpty(parseContactStringFromPayload(payment?.raw_payload, 'ancvConnectAmount'))} €`
          : null;

      return {
        id: order.id,
        reservationCode,
        stayTitle: stay?.title ?? 'Séjour inconnu',
        sessionLabel: formatDateRange(session?.start_date, session?.end_date),
        clientName:
          (order.client_user_id ? clientsByUserId.get(order.client_user_id) : undefined) ??
          participantNames[0] ??
          'Client inconnu',
        participantName: participantNames[0] ?? 'Participant inconnu',
        participantCount: items.length,
        amountLabel: formatEuroFromCents(totalCents, payment?.currency ?? 'EUR'),
        collectivityName: order.collectivity_id
          ? collectivitiesById.get(order.collectivity_id) ?? 'Collectivité inconnue'
          : 'Famille directe',
        status: order.status,
        cancellationReason: order.cancellation_reason,
        requestKind: order.request_kind,
        isVacafRequest,
        isAncvConnect,
        cafNumber: cafNumberLabel,
        requestReference: isVacafRequest
          ? cafNumberLabel
          : isAncvConnect
            ? ancvConnectMatricule
            : null,
        requestedAmountLabel: isAncvConnect ? ancvConnectRequestedAmountLabel : null,
        externalAidLabel,
        externalPaidLabel,
        canEnterVacafCoverage,
        canEnterAncvCoverage,
        totalCents,
        onlinePaidCents: onlinePaidCentsByOrderId.get(order.id) ?? 0,
        details: {
          id: order.id,
          reservationCode,
          clientName:
            (order.client_user_id ? clientsByUserId.get(order.client_user_id) : undefined) ??
            participantNames[0] ??
            'Client inconnu',
          participantName: participantNames[0] ?? 'Participant inconnu',
          paymentModeLabel: PAYMENT_MODE_LABELS[paymentMode] ?? 'Non renseigné',
          cafNumber: cafNumberLabel,
          ancvConnectMatricule: isAncvConnect ? ancvConnectMatricule : null,
          ancvConnectRequestedAmountLabel: isAncvConnect ? ancvConnectRequestedAmountLabel : null,
          externalAidLabel,
          externalPaidLabel,
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
              ]),
          coverageForm: canEnterVacafCoverage
            ? {
                organizerId: selectedOrganizerId,
                orderId: order.id,
                requestKind: 'VACAF' as const,
                referenceLabel: cafNumberLabel
                  ? `N° allocataire : ${cafNumberLabel}`
                  : 'Saisissez le montant CAF réellement appliqué.',
                amountPlaceholder: 'Montant de prise en charge CAF (€)',
                submitLabel: 'Enregistrer la prise en charge CAF',
                currentAmountLabel: externalAidLabel
              }
            : canEnterAncvCoverage
              ? {
                  organizerId: selectedOrganizerId,
                  orderId: order.id,
                  requestKind: 'ANCV_CONNECT' as const,
                  referenceLabel: ancvConnectMatricule
                    ? `Matricule : ${ancvConnectMatricule}${
                        ancvConnectRequestedAmountLabel ? ` · demandé ${ancvConnectRequestedAmountLabel}` : ''
                      }`
                    : 'Saisissez le montant ANCV Connect effectivement reçu.',
                  amountPlaceholder: 'Montant ANCV reçu (€)',
                  submitLabel: 'Enregistrer le montant ANCV',
                  currentAmountLabel: externalPaidLabel
                }
              : null
        }
      };
    });

  return (
    <div className="space-y-6">
      <OrganizerPageHeader
        title="Réservations"
        subtitle="Suivez les réservations liées à votre organisme."
      />
      {typeof resolvedSearchParams?.error === 'string' && resolvedSearchParams.error ? (
        <div className="rounded-xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-800">
          {resolvedSearchParams.error}
        </div>
      ) : null}
      {String(resolvedSearchParams?.cancelled ?? '') === '1' ? (
        <div className="rounded-xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-800">
          Demande d&apos;annulation / remboursement enregistrée.
        </div>
      ) : null}
      <div className="organizer-table-shell">
        <div className="overflow-x-auto">
          <table className="organizer-table min-w-[1200px] w-full table-fixed">
            <thead>
              <tr>
                <th className="px-4 py-3">Réf.</th>
                <th className="px-4 py-3">Client</th>
                <th className="px-4 py-3">Séjour</th>
                <th className="px-4 py-3">Session</th>
                <th className="px-4 py-3">Enfant</th>
                <th className="px-4 py-3">Statut</th>
                <th className="px-4 py-3">Traitement organisme</th>
                <th className="px-4 py-3">Collectivité</th>
                <th className="px-4 py-3 text-right">Montant</th>
                <th className="w-[140px] px-4 py-3 text-right">Détails</th>
              </tr>
            </thead>
            <tbody>
              {reservations.map((reservation) => (
                <tr key={reservation.id} className="border-t border-slate-100 align-top">
                  <td className="px-4 py-3">
                    <div className="font-mono text-sm font-semibold tracking-wide text-slate-900">
                      {reservation.reservationCode.replace(/^#/, '')}
                    </div>
                  </td>
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
                        reservation.status,
                        { cancellationReason: reservation.cancellationReason }
                      )}`}
                    >
                      {orderStatusLabel(reservation.status, {
                        cancellationReason: reservation.cancellationReason
                      })}
                    </span>
                  </td>
                  <td className="px-4 py-3">
                    {reservation.canEnterVacafCoverage ? (
                      <form action={resolveRequest} className="space-y-2">
                        <input type="hidden" name="organizer_id" value={selectedOrganizerId} />
                        <input type="hidden" name="order_id" value={reservation.id} />
                        <input type="hidden" name="request_kind" value="VACAF" />
                        {reservation.requestReference ? (
                          <div className="text-xs text-slate-500">
                            N° allocataire : {reservation.requestReference}
                          </div>
                        ) : null}
                        <input
                          name="resolved_amount_euros"
                          type="text"
                          inputMode="decimal"
                          placeholder="Montant CAF (€)"
                          className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm"
                        />
                        <button className="rounded-lg bg-slate-900 px-3 py-2 text-xs font-semibold text-white">
                          Enregistrer le montant CAF
                        </button>
                      </form>
                    ) : reservation.canEnterAncvCoverage ? (
                      <form action={resolveRequest} className="space-y-2">
                        <input type="hidden" name="organizer_id" value={selectedOrganizerId} />
                        <input type="hidden" name="order_id" value={reservation.id} />
                        <input type="hidden" name="request_kind" value="ANCV_CONNECT" />
                        <div className="text-xs text-slate-500">
                          {reservation.requestReference
                            ? `Matricule : ${reservation.requestReference}`
                            : 'ANCV Connect'}
                          {reservation.requestedAmountLabel ? ` · demandé ${reservation.requestedAmountLabel}` : ''}
                        </div>
                        <input
                          name="resolved_amount_euros"
                          type="text"
                          inputMode="decimal"
                          placeholder="Montant reçu (€)"
                          className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm"
                        />
                        <button className="rounded-lg bg-slate-900 px-3 py-2 text-xs font-semibold text-white">
                          Enregistrer le montant ANCV
                        </button>
                      </form>
                    ) : reservation.externalAidLabel || reservation.externalPaidLabel ? (
                      <div className="space-y-1 text-xs text-slate-600">
                        {reservation.externalAidLabel ? <div>CAF déduite : {reservation.externalAidLabel}</div> : null}
                        {reservation.externalPaidLabel ? <div>ANCV reçu : {reservation.externalPaidLabel}</div> : null}
                      </div>
                    ) : (
                      <span className="text-xs text-slate-400">—</span>
                    )}
                  </td>
                  <td className="px-4 py-3 text-slate-600">{reservation.collectivityName}</td>
                  <td className="px-4 py-3 text-right font-medium text-slate-900">{reservation.amountLabel}</td>
                  <td className="w-[140px] px-4 py-3 text-right">
                    <OrganizerReservationDetailsModal
                      reservation={reservation.details}
                      resolveAction={resolveRequest}
                    />
                    {reservation.status !== 'CANCELLED' && reservation.status !== 'FAILED' ? (
                      <OrganizerCancellationForm
                        organizerId={selectedOrganizerId}
                        orderId={reservation.id}
                        onlinePaidCents={reservation.onlinePaidCents}
                      />
                    ) : null}
                  </td>
                </tr>
              ))}
              {reservations.length === 0 && (
                <tr>
                  <td className="px-4 py-8 text-slate-500" colSpan={10}>
                    {ordersLoadError ? (
                      <p className="text-red-700">
                        Impossible de charger les réservations : {ordersLoadError}
                      </p>
                    ) : (
                      <p>Aucune réservation liée à cet organisme pour le moment.</p>
                    )}
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
