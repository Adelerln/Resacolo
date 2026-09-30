import Link from 'next/link';
import OrganizerPageHeader from '@/components/organisme/OrganizerPageHeader';
import OrganizerReservationDetailsModal from '@/components/organisme/OrganizerReservationDetailsModal';
import { OrganizerCancellationForm } from '@/components/organisme/OrganizerCancellationForm';
import { canAccessOrganizerSection } from '@/lib/organizer-access';
import { requireOrganizerPageAccess } from '@/lib/organizer-backoffice-access.server';
import {
  computeRemainingBalanceCents,
  formatOrderReservationCode,
  isAwaitingAidResolution,
  isPartnerFullCoverageAmounts,
  orderStatusBadgeClassName,
  orderStatusLabel,
  resolveDisplayedPaymentModeLabel,
  resolveEffectiveOrderStatus
} from '@/lib/order-workflow';
import { computePartnerContributionSnapshotCents } from '@/lib/partner-offers';
import { withOrganizerQuery } from '@/lib/organizers.server';
import { isMissingAnyColumnError } from '@/lib/supabase-schema-errors';
import { getServerSupabaseClient } from '@/lib/supabase/server';
import { parentStatusLabel } from '@/lib/account-preferences';
import { formatVacafNumberWithDepartment } from '@/lib/vacaf-number';
import { resolveOrganizerCoverageRequestAction } from '@/app/organisme/reservations/resolve-request-actions';
import type { ParentStatus } from '@/types/family-profile';
import type { Database } from '@/types/supabase';

type PageProps = {
  searchParams?: Promise<{
    organizerId?: string | string[];
    error?: string | string[];
    cancelled?: string | string[];
    coverageSaved?: string | string[];
    coverageOrderId?: string | string[];
  }>;
};

type ClientProfileReservationDetails = Pick<
  Database['public']['Tables']['client_profiles']['Row'],
  | 'user_id'
  | 'parent1_first_name'
  | 'parent1_last_name'
  | 'parent1_email'
  | 'parent1_phone'
  | 'parent1_status'
  | 'parent1_status_other'
  | 'parent2_name'
  | 'parent2_email'
  | 'parent2_phone'
  | 'parent2_status'
  | 'parent2_status_other'
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

function parseAncvPaperRequestedFromPayload(rawPayload: unknown, organizerId?: string | null) {
  if (!rawPayload || typeof rawPayload !== 'object' || Array.isArray(rawPayload)) return false;
  const contact = (rawPayload as Record<string, unknown>).contact;
  if (!contact || typeof contact !== 'object' || Array.isArray(contact)) return false;
  const contactRecord = contact as Record<string, unknown>;
  if (contactRecord.ancvPaperRequested === true || contactRecord.paymentMode === 'CV_PAPER') {
    return true;
  }
  const selections = contactRecord.organizerSelections;
  if (!selections || typeof selections !== 'object' || Array.isArray(selections)) return false;
  if (organizerId) {
    const selection = (selections as Record<string, unknown>)[organizerId];
    if (selection && typeof selection === 'object' && !Array.isArray(selection)) {
      const record = selection as Record<string, unknown>;
      return record.ancvPaperRequested === true || record.paymentMode === 'CV_PAPER';
    }
  }
  return Object.values(selections as Record<string, unknown>).some((selection) => {
    if (!selection || typeof selection !== 'object' || Array.isArray(selection)) return false;
    const record = selection as Record<string, unknown>;
    return record.ancvPaperRequested === true || record.paymentMode === 'CV_PAPER';
  });
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

function formatText(value: string | null | undefined, fallback = 'Non renseigné') {
  const trimmed = String(value ?? '').trim();
  return trimmed || fallback;
}

function formatAddress(parts: Array<string | null | undefined>, fallback = 'Non renseignée') {
  const formatted = parts.map((value) => String(value ?? '').trim()).filter(Boolean).join(', ');
  return formatted || fallback;
}

function splitPersonName(value: string | null | undefined) {
  const clean = String(value ?? '').trim();
  if (!clean) return { firstName: '', lastName: '' };
  const parts = clean.split(/\s+/).filter(Boolean);
  if (parts.length === 1) return { firstName: parts[0], lastName: '' };
  return { firstName: parts[0], lastName: parts.slice(1).join(' ') };
}

function formatParentRole(status: string | null | undefined, other: string | null | undefined) {
  const normalized = String(status ?? '').trim() as ParentStatus;
  if (!normalized) return '';
  return parentStatusLabel(normalized, other ?? undefined);
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
  const sessionsById = new Map(sessions.map((session) => [session.id, session]));
  const staysById = new Map(stays.map((stay) => [stay.id, stay]));
  const sessionIds = sessions.map((session) => session.id);

  type OrderItemRow = {
    id?: string;
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
      const key = row.id
        ? row.id
        : `${row.order_id}:${row.session_id ?? ''}:${row.child_first_name ?? ''}:${row.child_last_name ?? ''}:${row.total_price_cents ?? 0}`;
      orderItemsByKey.set(key, row);
    }
  }

  // 1) Lignes explicitement rattachées à l’organisme
  const byOrganizerResult = await supabase
    .from('order_items')
    .select('id,order_id,session_id,child_first_name,child_last_name,total_price_cents')
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
      .select('id,order_id,session_id,child_first_name,child_last_name,total_price_cents')
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
      .select('id,order_id,session_id,child_first_name,child_last_name,total_price_cents')
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
  const ordersSelectWithoutVacafSnapshots =
    'id,status,created_at,cancellation_reason,client_user_id,collectivity_id,request_kind,external_aid_cents,external_paid_cents';

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
        'vacaf_number_snapshot',
        'ancv_connect_matricule',
        'ancv_connect_requested_amount_cents'
      ])
    ) {
      // Colonnes snapshot CAF/ANCV absentes : on garde quand même external_aid_cents.
      const withoutSnapshots = await supabase
        .from('orders')
        .select(ordersSelectWithoutVacafSnapshots)
        .in('id', orderIds)
        .neq('status', 'CART')
        .order('created_at', { ascending: false });

      if (
        withoutSnapshots.error &&
        isMissingAnyColumnError(withoutSnapshots.error, [
          'request_kind',
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
      } else if (withoutSnapshots.error) {
        ordersLoadError = withoutSnapshots.error.message;
        console.error('organisme/reservations: orders without snapshots', withoutSnapshots.error);
      } else {
        orders = (withoutSnapshots.data ?? []).map((order) => ({
          ...order,
          cancellation_reason: (order as { cancellation_reason?: string | null }).cancellation_reason ?? null,
          vacaf_number_snapshot: null,
          ancv_connect_matricule: null,
          ancv_connect_requested_amount_cents: null,
          external_aid_cents: order.external_aid_cents ?? 0,
          external_paid_cents: order.external_paid_cents ?? 0
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
      ? supabase.from('collectivities').select('id,name,finance_mode').in('id', collectivityIds)
      : Promise.resolve({ data: [] })
  ]);

  const { data: paymentsRaw } = orderIds.length
    ? await supabase
        .from('payments')
        .select('order_id,amount_cents,currency,created_at,raw_payload,status')
        .in('order_id', orderIds)
        .order('created_at', { ascending: false })
    : { data: [] };

  const orderItemIds = orderItems.map((item) => item.id).filter((id): id is string => Boolean(id));
  const { data: contributionsRaw } = orderItemIds.length
    ? await supabase
        .from('collectivity_contributions')
        .select('order_item_id,mode,fixed_cents,percent_value,cap_cents,status,approved_by_user_id')
        .in('order_item_id', orderItemIds)
    : { data: [] };
  const contributionByOrderItemId = new Map(
    (contributionsRaw ?? [])
      .filter((row) => row.status !== 'REJECTED')
      .map((row) => [row.order_item_id, row])
  );

  const { data: profilesRaw } = clientUserIds.length
    ? await supabase
        .from('client_profiles')
        .select(
          [
            'user_id',
            'parent1_first_name',
            'parent1_last_name',
            'parent1_email',
            'parent1_phone',
            'parent1_status',
            'parent1_status_other',
            'parent2_name',
            'parent2_email',
            'parent2_phone',
            'parent2_status',
            'parent2_status_other',
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
    (collectivitiesRaw ?? []).map((collectivity) => [
      collectivity.id,
      {
        name: collectivity.name,
        financeMode: String((collectivity as { finance_mode?: string | null }).finance_mode ?? '')
      }
    ])
  );

  // Corrige les commandes CAF/ANCV encore sans montant mais passées trop tôt en « en attente de paiement ».
  const ordersNeedingStatusHeal = orders.filter((order) => {
    if (order.status !== 'PENDING_PAYMENT') return false;
    const payment = paymentsByOrderId.get(order.id);
    const paymentMode = parsePaymentModeFromPayload(payment?.raw_payload);
    const hasVacaf = order.request_kind === 'VACAF' || Boolean(String(order.vacaf_number_snapshot ?? '').trim());
    const hasAncv =
      order.request_kind === 'ANCV_CONNECT' ||
      Boolean(String(order.ancv_connect_matricule ?? '').trim()) ||
      paymentMode === 'CV_PAPER' ||
      parseAncvPaperRequestedFromPayload(payment?.raw_payload, selectedOrganizerId);
    return isAwaitingAidResolution({
      status: order.status,
      requestKind: order.request_kind,
      hasVacafNumber: hasVacaf,
      hasAncvConnect: hasAncv,
      externalAidCents: order.external_aid_cents,
      externalPaidCents: order.external_paid_cents
    });
  });
  if (ordersNeedingStatusHeal.length > 0) {
    const healIds = ordersNeedingStatusHeal.map((order) => order.id);
    await supabase.from('orders').update({ status: 'REQUESTED' }).in('id', healIds);
    for (const order of orders) {
      if (healIds.includes(order.id)) {
        order.status = 'REQUESTED';
      }
    }
  }

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
    const children = items.map((item) => ({
      firstName: String(item.child_first_name ?? '').trim(),
      lastName: String(item.child_last_name ?? '').trim()
    }));
    const participantNames = children
      .map((child) => [child.firstName, child.lastName].filter(Boolean).join(' ').trim())
      .filter(Boolean);
    const parent1FirstName = String(profile?.parent1_first_name ?? '').trim();
    const parent1LastName = String(profile?.parent1_last_name ?? '').trim();
    const parent1FromClient = splitPersonName(
      order.client_user_id ? clientsByUserId.get(order.client_user_id) : null
    );
    const parent2Identity = splitPersonName(profile?.parent2_name);
    const parent2Role = formatParentRole(profile?.parent2_status, profile?.parent2_status_other);
    const hasParent2 = Boolean(
      parent2Identity.firstName ||
        parent2Identity.lastName ||
        String(profile?.parent2_phone ?? '').trim() ||
        String(profile?.parent2_email ?? '').trim() ||
        parent2Role
    );
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
    const isAncvPaper =
      paymentMode === 'CV_PAPER' ||
      parseAncvPaperRequestedFromPayload(payment?.raw_payload, selectedOrganizerId);
    const isAncvRequest = isAncvConnect || isAncvPaper;
    const isVacafRequest = order.request_kind === 'VACAF' || Boolean(cafNumberFromOrder);
    const reservationCode = formatOrderReservationCode(order.id);
    const canEnterVacafCoverage =
      isVacafRequest &&
      order.status !== 'CANCELLED' &&
      order.status !== 'FAILED' &&
      order.status !== 'PAID';
    const canEnterAncvConnectCoverage =
      isAncvConnect &&
      order.status !== 'CANCELLED' &&
      order.status !== 'FAILED' &&
      order.status !== 'PAID';
    const canEnterAncvPaperCoverage =
      isAncvPaper &&
      order.status !== 'CANCELLED' &&
      order.status !== 'FAILED' &&
      order.status !== 'PAID';
    const canEnterAncvCoverage = canEnterAncvConnectCoverage || canEnterAncvPaperCoverage;
    const externalAidLabel =
      typeof order.external_aid_cents === 'number' && order.external_aid_cents > 0
        ? formatEuroFromCents(order.external_aid_cents, payment?.currency ?? 'EUR')
        : null;
    const externalPaidLabel =
      typeof order.external_paid_cents === 'number' && order.external_paid_cents > 0
        ? formatEuroFromCents(order.external_paid_cents, payment?.currency ?? 'EUR')
        : null;
    const onlinePaidCents = onlinePaidCentsByOrderId.get(order.id) ?? 0;
    const partnerContributionCents = items.reduce((sum, item) => {
      if (!item.id) return sum;
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
    const collectivityMeta = order.collectivity_id ? collectivitiesById.get(order.collectivity_id) : null;
    const collectivityName = collectivityMeta?.name ?? (order.collectivity_id ? 'Collectivité inconnue' : null);
    const notificationFlags =
      payment?.raw_payload &&
      typeof payment.raw_payload === 'object' &&
      !Array.isArray(payment.raw_payload)
        ? ((payment.raw_payload as { reservationNotification?: Record<string, unknown> })
            .reservationNotification ?? null)
        : null;
    const flaggedManualQuote = notificationFlags?.isPartnerManualQuote === true;
    const hasPartnerResolvedContribution = items.some((item) => {
      if (!item.id) return false;
      const contribution = contributionByOrderItemId.get(item.id);
      if (!contribution) return false;
      const cents = computePartnerContributionSnapshotCents({
        mode: contribution.mode,
        totalCents: item.total_price_cents ?? 0,
        percentValue: contribution.percent_value,
        fixedCents: contribution.fixed_cents,
        capCents: contribution.cap_cents
      });
      if (cents > 0) return true;
      return Boolean((contribution as { approved_by_user_id?: string | null }).approved_by_user_id);
    });
    const isPartnerManualQuotePending =
      Boolean(order.collectivity_id) &&
      (order.status === 'REQUESTED' || order.status === 'PENDING_PAYMENT') &&
      !hasPartnerResolvedContribution &&
      !isVacafRequest &&
      !isAncvRequest &&
      (flaggedManualQuote || collectivityMeta?.financeMode === 'MANUAL');
    const isPartnerFullCoverage =
      isPartnerFullCoverageAmounts({
        totalCents,
        partnerCents: partnerContributionCents
      }) ||
      (Boolean(order.collectivity_id) &&
        partnerContributionCents === 0 &&
        order.status === 'PAID' &&
        onlinePaidCents <= 0 &&
        (order.external_paid_cents ?? 0) <= 0 &&
        !isVacafRequest &&
        !isAncvRequest);
    const familyPayableCents = Math.max(0, totalCents - partnerContributionCents);
    const remainingBalanceCents = computeRemainingBalanceCents({
      totalCents: familyPayableCents,
      externalAidCents: order.external_aid_cents,
      externalPaidCents: order.external_paid_cents,
      onlinePaidCents
    });
    const remainingBalanceLabel =
      isPartnerManualQuotePending
        ? null
        : remainingBalanceCents > 0
          ? formatEuroFromCents(remainingBalanceCents, payment?.currency ?? 'EUR')
          : null;
    const needsVacafCoverageEntry = canEnterVacafCoverage && !externalAidLabel;
    const needsAncvCoverageEntry = canEnterAncvCoverage && !externalPaidLabel;
    const ancvConnectRequestedAmountLabel =
      typeof order.ancv_connect_requested_amount_cents === 'number'
        ? formatEuroFromCents(order.ancv_connect_requested_amount_cents, payment?.currency ?? 'EUR')
        : firstNonEmpty(parseContactStringFromPayload(payment?.raw_payload, 'ancvConnectAmount'))
          ? `${firstNonEmpty(parseContactStringFromPayload(payment?.raw_payload, 'ancvConnectAmount'))} €`
          : null;
    const ancvCoverageBreakdown = (() => {
      const payload = payment?.raw_payload;
      if (!payload || typeof payload !== 'object' || Array.isArray(payload)) {
        return { connectCents: 0, paperCents: 0 };
      }
      const breakdown = (payload as { ancvCoverageBreakdown?: unknown }).ancvCoverageBreakdown;
      if (!breakdown || typeof breakdown !== 'object' || Array.isArray(breakdown)) {
        return { connectCents: 0, paperCents: 0 };
      }
      const record = breakdown as { connectCents?: unknown; paperCents?: unknown };
      return {
        connectCents: Math.max(0, Math.round(Number(record.connectCents ?? 0)) || 0),
        paperCents: Math.max(0, Math.round(Number(record.paperCents ?? 0)) || 0)
      };
    })();
    const ancvConnectPaidLabel =
      ancvCoverageBreakdown.connectCents > 0
        ? formatEuroFromCents(ancvCoverageBreakdown.connectCents, payment?.currency ?? 'EUR')
        : isAncvConnect && !isAncvPaper && externalPaidLabel
          ? externalPaidLabel
          : null;
    const ancvPaperPaidLabel =
      ancvCoverageBreakdown.paperCents > 0
        ? formatEuroFromCents(ancvCoverageBreakdown.paperCents, payment?.currency ?? 'EUR')
        : isAncvPaper && !isAncvConnect && externalPaidLabel
          ? externalPaidLabel
          : null;
    const displayStatus =
      resolveEffectiveOrderStatus({
        status: order.status,
        requestKind: order.request_kind,
        hasVacafNumber: isVacafRequest,
        hasAncvConnect: isAncvRequest,
        externalAidCents: order.external_aid_cents,
        externalPaidCents: order.external_paid_cents
      }) ?? order.status;

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
        collectivityName: collectivityName ?? 'Famille directe',
        isPartnerFullCoverage,
        isPartnerManualQuotePending,
        status: displayStatus,
        cancellationReason: order.cancellation_reason,
        requestKind: order.request_kind,
        isVacafRequest,
        isAncvConnect,
        isAncvPaper,
        cafNumber: cafNumberLabel,
        requestReference: isVacafRequest
          ? cafNumberLabel
          : isAncvConnect
            ? ancvConnectMatricule
            : isAncvPaper
              ? 'ANCV papier'
              : null,
        requestedAmountLabel: isAncvConnect ? ancvConnectRequestedAmountLabel : null,
        externalAidLabel,
        externalPaidLabel,
        canEnterVacafCoverage,
        canEnterAncvCoverage,
        needsVacafCoverageEntry,
        needsAncvCoverageEntry,
        totalCents,
        onlinePaidCents,
        remainingBalanceCents,
        remainingBalanceLabel,
        details: {
          id: order.id,
          reservationCode,
          clientName:
            (order.client_user_id ? clientsByUserId.get(order.client_user_id) : undefined) ??
            participantNames[0] ??
            'Client inconnu',
          participantName: participantNames[0] ?? 'Participant inconnu',
          parent1FirstName: parent1FirstName || parent1FromClient.firstName,
          parent1LastName: parent1LastName || parent1FromClient.lastName,
          parent1Role: formatParentRole(profile?.parent1_status, profile?.parent1_status_other),
          parent2FirstName: parent2Identity.firstName,
          parent2LastName: parent2Identity.lastName,
          parent2Role,
          hasParent2,
          children,
          paymentModeLabel: resolveDisplayedPaymentModeLabel({
            paymentMode,
            totalCents,
            partnerCents: isPartnerFullCoverage
              ? Math.max(partnerContributionCents, totalCents)
              : partnerContributionCents,
            collectivityName,
            isPartnerManualQuotePending
          }),
          collectivityName,
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
          coverageForms: [
            ...(canEnterVacafCoverage
              ? [
                  {
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
                ]
              : []),
            ...(canEnterAncvConnectCoverage
              ? [
                  {
                    organizerId: selectedOrganizerId,
                    orderId: order.id,
                    requestKind: 'ANCV_CONNECT' as const,
                    title: 'Montant ANCV Connect reçu',
                    referenceLabel: ancvConnectMatricule
                      ? `Matricule : ${ancvConnectMatricule}${
                          ancvConnectRequestedAmountLabel
                            ? ` · demandé ${ancvConnectRequestedAmountLabel}`
                            : ''
                        }`
                      : 'Saisissez le montant ANCV Connect effectivement reçu.',
                    amountPlaceholder: 'Montant ANCV Connect reçu (€)',
                    submitLabel: 'Enregistrer le montant ANCV Connect',
                    currentAmountLabel: ancvConnectPaidLabel
                  }
                ]
              : []),
            ...(canEnterAncvPaperCoverage
              ? [
                  {
                    organizerId: selectedOrganizerId,
                    orderId: order.id,
                    requestKind: 'ANCV_PAPER' as const,
                    title: 'Montant ANCV papier reçu',
                    referenceLabel: 'Saisissez le montant ANCV papier effectivement reçu.',
                    amountPlaceholder: 'Montant ANCV papier reçu (€)',
                    submitLabel: 'Enregistrer le montant ANCV papier',
                    currentAmountLabel: ancvPaperPaidLabel
                  }
                ]
              : [])
          ]
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
      {String(resolvedSearchParams?.coverageSaved ?? '') === '1' ? (
        <div className="rounded-xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-800">
          Prise en charge enregistrée.
        </div>
      ) : null}
      <div className="organizer-table-shell overflow-hidden">
        <table className="organizer-table w-full">
          <thead>
            <tr>
              <th className="!px-4 !py-3 w-[18%]">Réservation</th>
              <th className="!px-4 !py-3 w-[18%]">Famille</th>
              <th className="!px-4 !py-3 w-[28%]">Séjour</th>
              <th className="!px-4 !py-3 w-[14%]">Statut</th>
              <th className="!px-4 !py-3 w-[12%]">Traitement</th>
              <th className="!px-4 !py-3 w-[10%] text-center">Actions</th>
            </tr>
          </thead>
          <tbody>
            {reservations.map((reservation) => {
              const traitementLines = (() => {
                const lines: string[] = [];
                if (reservation.externalAidLabel) {
                  lines.push(`CAF : ${reservation.externalAidLabel}`);
                } else if (reservation.isVacafRequest) {
                  lines.push(
                    reservation.cafNumber
                      ? `N° ${reservation.cafNumber}`
                      : reservation.requestReference
                        ? `N° ${reservation.requestReference}`
                        : 'Demande CAF'
                  );
                }
                if (reservation.externalPaidLabel) {
                  lines.push(`ANCV : ${reservation.externalPaidLabel}`);
                } else if (reservation.isAncvConnect || reservation.isAncvPaper) {
                  if (reservation.isAncvConnect) {
                    lines.push(
                      reservation.details.ancvConnectMatricule
                        ? `ANCV ${reservation.details.ancvConnectMatricule}`
                        : 'ANCV Connect'
                    );
                  }
                  if (reservation.isAncvPaper) {
                    lines.push('ANCV papier');
                  }
                }
                return lines;
              })();
              const statusLabel = orderStatusLabel(reservation.status, {
                cancellationReason: reservation.cancellationReason,
                isPartnerFullCoverage: reservation.isPartnerFullCoverage,
                isPartnerManualQuotePending: reservation.isPartnerManualQuotePending
              });
              const infoBadge =
                reservation.needsVacafCoverageEntry && reservation.needsAncvCoverageEntry
                  ? ('CAF_ANCV' as const)
                  : reservation.needsVacafCoverageEntry
                    ? ('CAF' as const)
                    : reservation.needsAncvCoverageEntry
                      ? ('ANCV' as const)
                      : null;

              return (
                <tr key={reservation.id} className="border-t border-slate-100 align-middle">
                  <td className="!px-4 !py-2.5">
                    <div className="font-mono text-sm font-semibold tracking-wide text-slate-900">
                      {reservation.reservationCode.replace(/^#/, '')}
                    </div>
                    <div className="mt-0.5 text-sm font-semibold tabular-nums text-slate-800">
                      {reservation.amountLabel}
                    </div>
                    <div className="text-xs text-slate-500">{reservation.collectivityName}</div>
                  </td>
                  <td className="!px-4 !py-2.5">
                    <div className="text-sm font-medium text-slate-900">{reservation.clientName}</div>
                    <div className="text-sm text-slate-600">
                      {reservation.participantName}
                      {reservation.participantCount > 1 ? (
                        <span className="text-slate-400"> · {reservation.participantCount}</span>
                      ) : null}
                    </div>
                  </td>
                  <td className="!px-4 !py-2.5">
                    <div className="text-sm font-medium leading-snug text-slate-900">
                      {reservation.stayTitle}
                    </div>
                    <div className="text-xs text-slate-500">{reservation.sessionLabel}</div>
                  </td>
                  <td className="!px-4 !py-2.5">
                    <span
                      className={`inline-flex rounded-full px-2.5 py-1 text-xs font-semibold ${orderStatusBadgeClassName(
                        reservation.status,
                        {
                          cancellationReason: reservation.cancellationReason,
                          isPartnerFullCoverage: reservation.isPartnerFullCoverage,
                          isPartnerManualQuotePending: reservation.isPartnerManualQuotePending
                        }
                      )}`}
                    >
                      {statusLabel}
                    </span>
                  </td>
                  <td className="!px-4 !py-2.5 text-sm text-slate-600">
                    {traitementLines.length > 0 ? (
                      <div className="space-y-0.5">
                        {traitementLines.map((line) => (
                          <div key={line}>{line}</div>
                        ))}
                      </div>
                    ) : (
                      <span className="text-slate-400">—</span>
                    )}
                    {reservation.status !== 'CANCELLED' && reservation.status !== 'FAILED' ? (
                      reservation.isPartnerManualQuotePending ? (
                        <div className="mt-0.5 text-xs font-medium text-amber-700">
                          Attente calcul prise en charge partenaire
                        </div>
                      ) : reservation.remainingBalanceLabel ? (
                        <div className="mt-0.5 text-xs font-medium text-amber-700">
                          Restant dû : {reservation.remainingBalanceLabel}
                        </div>
                      ) : (
                        <div className="mt-0.5 text-xs text-slate-500">Soldé</div>
                      )
                    ) : null}
                  </td>
                  <td className="!px-4 !py-2.5 text-center">
                    <div className="inline-flex flex-col items-center gap-0.5">
                      <OrganizerReservationDetailsModal
                        reservation={reservation.details}
                        resolveAction={resolveOrganizerCoverageRequestAction}
                        infoBadge={infoBadge}
                        initialOpen={
                          String(resolvedSearchParams?.coverageOrderId ?? '') === reservation.id
                        }
                      />
                      {reservation.status !== 'CANCELLED' && reservation.status !== 'FAILED' ? (
                        <OrganizerCancellationForm
                          organizerId={selectedOrganizerId}
                          orderId={reservation.id}
                          onlinePaidCents={reservation.onlinePaidCents}
                          compact
                        />
                      ) : null}
                    </div>
                  </td>
                </tr>
              );
            })}
            {reservations.length === 0 && (
              <tr>
                <td className="!px-4 py-8 text-slate-500" colSpan={6}>
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
  );
}
