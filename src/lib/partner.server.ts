import { getServerSupabaseClient } from '@/lib/supabase/server';
import {
  computeRemainingBalanceCents,
  inferOrderRequestKind,
  orderStatusLabel,
  reconcileOrderStatusWithBalance
} from '@/lib/order-workflow';
import {
  computePartnerContributionSnapshotCents,
  computePartnerFinanceSplit,
  normalizePartnerFinanceMode
} from '@/lib/partner-offers';
import { buildFeatureActivationMessage, isMissingAnyColumnError } from '@/lib/supabase-schema-errors';
import type { Database, Json } from '@/types/supabase';

type CollectivityRow = Database['public']['Tables']['collectivities']['Row'];
type CollectivityContactRow = Database['public']['Tables']['collectivity_contacts']['Row'];
type OrderItemRow = Pick<
  Database['public']['Tables']['order_items']['Row'],
  'id' | 'order_id' | 'session_id' | 'child_first_name' | 'child_last_name' | 'total_price_cents'
>;
type PartnerPaymentMode = 'FULL' | 'DEPOSIT_200' | 'CV_CONNECT' | 'CV_PAPER' | 'DEFERRED';

const PAYMENT_MODE_LABELS: Record<PartnerPaymentMode, string> = {
  FULL: 'Paiement de la totalité en CB',
  DEPOSIT_200: "Paiement d'un acompte (200 €) en CB",
  CV_CONNECT: 'Paiement en ANCV Connect',
  CV_PAPER: 'Paiement en ANCV papier',
  DEFERRED: 'Paiement différé'
};

function isCollectivityContactsTableMissingError(error: { message?: string; code?: string } | null | undefined) {
  const message = String(error?.message ?? '');
  return error?.code === 'PGRST205' || message.includes("Could not find the table 'public.collectivity_contacts'");
}

function buildClientDisplayName(profile: {
  parent1_first_name?: string | null;
  parent1_last_name?: string | null;
}) {
  return [profile.parent1_first_name, profile.parent1_last_name].filter(Boolean).join(' ').trim();
}

function resolveBeneficiaryFamilyName(
  profile:
    | {
        parent1_first_name?: string | null;
        parent1_last_name?: string | null;
      }
    | undefined,
  fullName: string | null | undefined
) {
  const fromProfile = profile?.parent1_last_name?.trim();
  if (fromProfile) return fromProfile;

  const clean = (fullName ?? '').trim();
  if (!clean) return '';

  const parts = clean.split(/\s+/).filter(Boolean);
  if (parts.length === 1) return parts[0];
  return parts.slice(1).join(' ');
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

function formatCurrencyFromCents(value: number | null | undefined, currency = 'EUR') {
  if (value == null || !Number.isFinite(value)) return '-';
  return new Intl.NumberFormat('fr-FR', {
    style: 'currency',
    currency,
    minimumFractionDigits: 2,
    maximumFractionDigits: 2
  }).format(value / 100);
}

function parsePaymentModeFromPayload(rawPayload: Json | null | undefined): PartnerPaymentMode {
  if (!rawPayload || typeof rawPayload !== 'object' || Array.isArray(rawPayload)) {
    return 'FULL';
  }

  const contact = (rawPayload as Record<string, unknown>).contact;
  if (!contact || typeof contact !== 'object' || Array.isArray(contact)) {
    return 'FULL';
  }

  const paymentMode = (contact as Record<string, unknown>).paymentMode;
  if (
    paymentMode === 'FULL' ||
    paymentMode === 'DEPOSIT_200' ||
    paymentMode === 'CV_CONNECT' ||
    paymentMode === 'CV_PAPER' ||
    paymentMode === 'DEFERRED'
  ) {
    return paymentMode;
  }

  return 'FULL';
}

function inferPartnerRequestKind(input: {
  requestKind: string | null | undefined;
  vacafNumberSnapshot: string | null | undefined;
  ancvConnectMatricule: string | null | undefined;
  paymentRawPayload: Record<string, unknown> | null;
}) {
  if (input.requestKind === 'VACAF' || input.requestKind === 'ANCV_CONNECT') {
    return input.requestKind;
  }
  if (String(input.vacafNumberSnapshot ?? '').trim()) {
    return 'VACAF' as const;
  }
  if (String(input.ancvConnectMatricule ?? '').trim()) {
    return 'ANCV_CONNECT' as const;
  }
  return inferOrderRequestKind({
    requestKind: input.requestKind,
    paymentRawPayload: input.paymentRawPayload
  });
}

function partnerReservationStatusLabel(
  status: Database['public']['Enums']['order_status'],
  requestKind: string | null | undefined,
  collectivityFinanceMode: string | null | undefined,
  hasContributionSnapshot: boolean,
  paymentMode: PartnerPaymentMode,
  externalPaidCents: number
) {
  const financeMode = normalizePartnerFinanceMode(collectivityFinanceMode);
  const hasOpenOrganizerPaperWorkflow =
    paymentMode === 'CV_PAPER' &&
    externalPaidCents <= 0 &&
    (status === 'REQUESTED' || status === 'PENDING_PAYMENT' || status === 'VALIDATED' || status === 'BOOKED');

  if (status === 'REQUESTED') {
    if (requestKind === 'VACAF') return 'En attente de traitement organisme (VACAF)';
    if (requestKind === 'ANCV_CONNECT') return 'En attente de traitement organisme (ANCV Connect)';
    if (hasOpenOrganizerPaperWorkflow) return 'En attente de traitement organisme (ANCV papier)';
    if (financeMode === 'MANUAL' && !hasContributionSnapshot) {
      return 'En attente de traitement partenaire';
    }
    return 'En attente de paiement famille';
  }

  if (status === 'PENDING_PAYMENT' || status === 'VALIDATED' || status === 'BOOKED') {
    if (hasOpenOrganizerPaperWorkflow) return 'En attente de traitement organisme (ANCV papier)';
    if (financeMode === 'MANUAL' && !hasContributionSnapshot) return 'En attente de traitement partenaire';
    return 'En attente de paiement famille';
  }
  if (status === 'PARTIALLY_PAID') return 'Paiement partiel reçu';
  if (status === 'PAID' || status === 'CONFIRMED') return 'Réservation payée';
  if (status === 'CANCELLED') return 'Réservation annulée';
  if (status === 'TRANSFERRED') return 'Réservation transférée';

  return orderStatusLabel(status);
}

function partnerReservationBadgeStatus(input: {
  status: Database['public']['Enums']['order_status'];
  statusLabel: string;
}) {
  if (input.statusLabel === 'En attente de paiement famille') {
    return 'PENDING_PAYMENT' as const;
  }
  if (input.statusLabel.startsWith('En attente de traitement')) {
    return 'REQUESTED' as const;
  }
  return input.status;
}

function describePartnerReservationPendingActions(input: {
  status: Database['public']['Enums']['order_status'];
  requestKind: string | null | undefined;
  clientContributionCents: number;
  collectivityFinanceMode: string | null | undefined;
  hasContributionSnapshot: boolean;
  paymentMode: PartnerPaymentMode;
  externalPaidCents: number;
}) {
  const actions: Array<{ actorLabel: string; description: string }> = [];
  const financeMode = normalizePartnerFinanceMode(input.collectivityFinanceMode);
  const isOpenWorkflow =
    input.status === 'REQUESTED' ||
    input.status === 'PENDING_PAYMENT' ||
    input.status === 'VALIDATED' ||
    input.status === 'BOOKED' ||
    input.status === 'PARTIALLY_PAID';
  const organizerPaperWorkflowOpen =
    input.paymentMode === 'CV_PAPER' &&
    input.externalPaidCents <= 0 &&
    (input.status === 'REQUESTED' ||
      input.status === 'PENDING_PAYMENT' ||
      input.status === 'VALIDATED' ||
      input.status === 'BOOKED');

  if (financeMode === 'MANUAL' && !input.hasContributionSnapshot && isOpenWorkflow) {
    actions.push({
      actorLabel: 'Partenaire',
      description: 'Indiquer le montant de prise en charge à appliquer à la réservation.'
    });
  }

  if (input.status === 'REQUESTED' && input.requestKind === 'VACAF') {
    actions.push({
      actorLabel: 'Organisme',
      description: 'Vérifier les droits VACAF / AVE puis saisir le montant CAF appliqué à la réservation.'
    });
  }

  if (input.status === 'REQUESTED' && input.requestKind === 'ANCV_CONNECT') {
    actions.push({
      actorLabel: 'Organisme',
      description: 'Recontacter la famille puis saisir le montant ANCV Connect effectivement encaissé.'
    });
  }

  if (organizerPaperWorkflowOpen) {
    actions.push({
      actorLabel: 'Organisme',
      description: 'Confirmer la réception du règlement en ANCV papier puis enregistrer le montant encaissé.'
    });
  }

  if (
    (input.status === 'PENDING_PAYMENT' || input.status === 'VALIDATED' || input.status === 'BOOKED') &&
    !organizerPaperWorkflowOpen &&
    input.clientContributionCents > 0
  ) {
    actions.push({
      actorLabel: 'Famille',
      description: 'Régler le solde restant de la réservation.'
    });
  }

  if (input.status === 'PARTIALLY_PAID' && input.clientContributionCents > 0) {
    actions.push({
      actorLabel: 'Famille',
      description: 'Compléter le paiement du solde restant.'
    });
  }

  if (
    input.status === 'REQUESTED' &&
    input.requestKind == null &&
    !organizerPaperWorkflowOpen &&
    input.clientContributionCents > 0
  ) {
    actions.push({
      actorLabel: 'Famille',
      description: 'Régler le solde restant de la réservation.'
    });
  }

  return actions;
}

export async function readPartnerCollectivity(collectivityId: string): Promise<CollectivityRow> {
  const supabase = getServerSupabaseClient();
  const { data, error } = await supabase
    .from('collectivities')
    .select('*')
    .eq('id', collectivityId)
    .maybeSingle();

  if (error) {
    throw new Error(`Impossible de charger la collectivité : ${error.message}`);
  }
  if (!data) {
    throw new Error('Collectivité introuvable.');
  }

  return data;
}

export async function listPartnerContacts(collectivityId: string): Promise<CollectivityContactRow[]> {
  const supabase = getServerSupabaseClient();
  const { data, error } = await supabase
    .from('collectivity_contacts')
    .select('*')
    .eq('collectivity_id', collectivityId)
    .order('is_primary', { ascending: false })
    .order('created_at', { ascending: true });

  if (error) {
    if (isCollectivityContactsTableMissingError(error)) {
      const collectivity = await readPartnerCollectivity(collectivityId);
      if (!collectivity.contact_email?.trim()) {
        return [];
      }

      return [
        {
          id: `legacy-${collectivityId}`,
          collectivity_id: collectivityId,
          full_name: collectivity.contact_name?.trim() || collectivity.name,
          role_label: null,
          email: collectivity.contact_email.trim(),
          phone: collectivity.contact_phone?.trim() || null,
          is_primary: true,
          created_at: collectivity.created_at,
          updated_at: collectivity.updated_at
        }
      ];
    }
    throw new Error(`Impossible de charger les contacts partenaire : ${error.message}`);
  }

  return data ?? [];
}

export async function isPartnerContactsTableAvailable(collectivityId: string) {
  const supabase = getServerSupabaseClient();
  const { error } = await supabase
    .from('collectivity_contacts')
    .select('id')
    .eq('collectivity_id', collectivityId)
    .limit(1);

  return !isCollectivityContactsTableMissingError(error);
}

const CLIENT_QF_COLUMNS = ['family_quotient', 'family_quotient_expires_on'] as const;

type PartnerBeneficiaryClientRow = {
  user_id: string;
  full_name: string | null;
  phone: string | null;
  created_at: string;
  family_quotient?: number | null;
  family_quotient_expires_on?: string | null;
};

export type PartnerBeneficiary = {
  id: string;
  userId: string;
  name: string;
  familyName: string;
  email: string;
  phone: string;
  city: string;
  attachedAt: string;
  role: 'BENEFICIARY';
  familyQuotient: number | null;
  familyQuotientExpiresOn: string | null;
};

export type PartnerBeneficiariesListResult = {
  beneficiaries: PartnerBeneficiary[];
  qfFieldsAvailable: boolean;
};

function parseStoredFamilyQuotient(value: number | string | null | undefined) {
  if (value == null) return null;
  const parsed = typeof value === 'number' ? value : Number(String(value).replace(',', '.'));
  if (!Number.isFinite(parsed) || parsed < 0) return null;
  return Math.round(parsed * 100) / 100;
}

function normalizeFamilyQuotientExpiresOn(value: string | null | undefined) {
  const trimmed = String(value ?? '').trim();
  if (!trimmed) return null;
  const datePart = trimmed.slice(0, 10);
  if (!/^\d{4}-\d{2}-\d{2}$/.test(datePart)) return null;
  return datePart;
}

export async function updatePartnerBeneficiaryFamilyQuotient(input: {
  collectivityId: string;
  beneficiaryUserId: string;
  familyQuotient: number | null;
  familyQuotientExpiresOn: string | null;
}) {
  const supabase = getServerSupabaseClient();
  const { data: client, error: readError } = await supabase
    .from('clients')
    .select('user_id,collectivity_id')
    .eq('user_id', input.beneficiaryUserId)
    .maybeSingle();

  if (readError) {
    throw new Error(`Impossible de vérifier l'ayant-droit : ${readError.message}`);
  }
  if (!client || client.collectivity_id !== input.collectivityId) {
    throw new Error('Ayant-droit introuvable pour votre collectivité.');
  }

  const { error: updateError } = await supabase
    .from('clients')
    .update({
      family_quotient: input.familyQuotient,
      family_quotient_expires_on: input.familyQuotientExpiresOn
    })
    .eq('user_id', input.beneficiaryUserId)
    .eq('collectivity_id', input.collectivityId);

  if (updateError) {
    if (isMissingAnyColumnError(updateError, [...CLIENT_QF_COLUMNS])) {
      throw new Error(buildFeatureActivationMessage('Le quotient familial (QF) des ayants-droit'));
    }
    throw new Error(`Impossible d'enregistrer le QF : ${updateError.message}`);
  }
}

export async function listPartnerBeneficiaryUserIds(collectivityId: string, excludedUserId?: string | null) {
  const supabase = getServerSupabaseClient();
  const { data, error } = await supabase
    .from('clients')
    .select('user_id')
    .eq('collectivity_id', collectivityId);

  if (error) {
    throw new Error(`Impossible de charger les bénéficiaires rattachés : ${error.message}`);
  }

  return (data ?? [])
    .map((row) => row.user_id)
    .filter((userId) => userId !== excludedUserId);
}

export async function listPartnerBeneficiaries(
  collectivityId: string,
  excludedUserId?: string | null
): Promise<PartnerBeneficiariesListResult> {
  const supabase = getServerSupabaseClient();
  let qfFieldsAvailable = true;
  const beneficiaryClientsWithQf = await supabase
    .from('clients')
    .select('user_id,full_name,phone,created_at,family_quotient,family_quotient_expires_on')
    .eq('collectivity_id', collectivityId);

  let beneficiaryClients: PartnerBeneficiaryClientRow[] | null = beneficiaryClientsWithQf.data;
  let beneficiaryClientsError = beneficiaryClientsWithQf.error;

  if (beneficiaryClientsError && isMissingAnyColumnError(beneficiaryClientsError, [...CLIENT_QF_COLUMNS])) {
    qfFieldsAvailable = false;
    const legacyClients = await supabase
      .from('clients')
      .select('user_id,full_name,phone,created_at')
      .eq('collectivity_id', collectivityId);
    beneficiaryClients = (legacyClients.data ?? []) as PartnerBeneficiaryClientRow[];
    beneficiaryClientsError = legacyClients.error;
  }

  if (beneficiaryClientsError) {
    throw new Error(`Impossible de charger les clients rattachés : ${beneficiaryClientsError.message}`);
  }

  const filteredClients = (beneficiaryClients ?? []).filter((row) => row.user_id !== excludedUserId);
  const userIds = filteredClients.map((row) => row.user_id);
  if (userIds.length === 0) {
    return { beneficiaries: [], qfFieldsAvailable };
  }

  const [{ data: profiles, error: profilesError }] = await Promise.all([
    supabase
      .from('client_profiles')
      .select('user_id,parent1_first_name,parent1_last_name,parent1_email,parent1_phone,city,created_at')
      .in('user_id', userIds)
  ]);

  if (profilesError) {
    throw new Error(`Impossible de charger les profils clients rattachés : ${profilesError.message}`);
  }

  const profilesByUserId = new Map((profiles ?? []).map((row) => [row.user_id, row]));

  const beneficiaries = filteredClients.map((client) => {
    const profile = profilesByUserId.get(client.user_id);
    const nameFromProfile = profile ? buildClientDisplayName(profile) : '';
    const displayName = client?.full_name?.trim() || nameFromProfile || 'Nom non renseigné';
    const clientRow = client;

    return {
      id: client.user_id,
      userId: client.user_id,
      name: displayName,
      familyName: resolveBeneficiaryFamilyName(profile, client.full_name),
      email: profile?.parent1_email?.trim() || 'Non renseigné',
      phone: profile?.parent1_phone?.trim() || client?.phone?.trim() || 'Non renseigné',
      city: profile?.city?.trim() || 'Non renseignée',
      attachedAt: profile?.created_at ?? client.created_at,
      role: 'BENEFICIARY' as const,
      familyQuotient: qfFieldsAvailable ? parseStoredFamilyQuotient(clientRow.family_quotient) : null,
      familyQuotientExpiresOn: qfFieldsAvailable
        ? normalizeFamilyQuotientExpiresOn(clientRow.family_quotient_expires_on)
        : null
    };
  });

  return { beneficiaries, qfFieldsAvailable };
}

export async function listPartnerReservations(collectivityId: string, excludedUserId?: string | null) {
  const supabase = getServerSupabaseClient();
  const collectivity = await readPartnerCollectivity(collectivityId);

  let { data: orders, error: ordersError } = await supabase
    .from('orders')
    .select(
      'id,status,request_kind,vacaf_number_snapshot,ancv_connect_matricule,ancv_connect_requested_amount_cents,external_aid_cents,external_paid_cents,created_at,requested_at,validated_at,booked_at,paid_at,cancellation_reason,client_user_id,collectivity_id'
    )
    .eq('collectivity_id', collectivityId)
    .neq('status', 'CART')
    .order('created_at', { ascending: false });

  if (
    ordersError &&
    isMissingAnyColumnError(ordersError, [
      'request_kind',
      'vacaf_number_snapshot',
      'ancv_connect_matricule',
      'ancv_connect_requested_amount_cents',
      'external_aid_cents',
      'external_paid_cents',
      'cancellation_reason'
    ])
  ) {
    const legacyOrdersResult = await supabase
      .from('orders')
      .select('id,status,created_at,requested_at,validated_at,booked_at,paid_at,client_user_id,collectivity_id')
      .eq('collectivity_id', collectivityId)
      .neq('status', 'CART')
      .order('created_at', { ascending: false });

    orders = (legacyOrdersResult.data ?? []).map((order) => ({
      ...order,
      request_kind: null,
      vacaf_number_snapshot: null,
      ancv_connect_matricule: null,
      ancv_connect_requested_amount_cents: null,
      external_aid_cents: 0,
      external_paid_cents: 0,
      cancellation_reason: null
    }));
    ordersError = legacyOrdersResult.error;
  }

  if (ordersError) {
    throw new Error(`Impossible de charger les réservations : ${ordersError.message}`);
  }

  const orderRows = orders ?? [];
  if (orderRows.length === 0) return [];

  const orderIds = orderRows.map((row) => row.id);
  const clientUserIds = Array.from(new Set(orderRows.map((row) => row.client_user_id).filter(Boolean)));

  const { data: orderItems, error: itemsError } = await supabase
    .from('order_items')
    .select('id,order_id,session_id,child_first_name,child_last_name,total_price_cents')
    .in('order_id', orderIds);

  if (itemsError) {
    throw new Error(`Impossible de charger les lignes de commande : ${itemsError.message}`);
  }

  const sessionIds = Array.from(new Set((orderItems ?? []).map((row) => row.session_id).filter(Boolean)));
  const orderItemIds = Array.from(new Set((orderItems ?? []).map((row) => row.id).filter(Boolean)));

  const contributionsResponse = orderItemIds.length
    ? await supabase
        .from('collectivity_contributions')
        .select('collectivity_id,order_item_id,mode,fixed_cents,percent_value,cap_cents,status')
        .eq('collectivity_id', collectivityId)
        .in('order_item_id', orderItemIds)
    : { data: [], error: null };

  const sessionsResponse = sessionIds.length
    ? await supabase.from('sessions').select('id,start_date,end_date,stay_id').in('id', sessionIds)
    : { data: [], error: null };
  const clientsResponse = clientUserIds.length
    ? await supabase.from('clients').select('user_id,full_name').in('user_id', clientUserIds)
    : { data: [], error: null };
  const profilesResponse = clientUserIds.length
    ? await supabase
        .from('client_profiles')
        .select('user_id,parent1_first_name,parent1_last_name,parent1_email')
        .in('user_id', clientUserIds)
    : { data: [], error: null };
  const paymentsResponse = orderIds.length
    ? await supabase
        .from('payments')
        .select('order_id,status,amount_cents,updated_at,raw_payload')
        .in('order_id', orderIds)
        .order('updated_at', { ascending: false })
    : { data: [], error: null };

  if (sessionsResponse.error) {
    throw new Error(`Impossible de charger les sessions réservées : ${sessionsResponse.error.message}`);
  }
  if (clientsResponse.error) {
    throw new Error(`Impossible de charger les clients des réservations : ${clientsResponse.error.message}`);
  }
  if (profilesResponse.error) {
    throw new Error(`Impossible de charger les profils des réservations : ${profilesResponse.error.message}`);
  }
  if (contributionsResponse.error) {
    throw new Error(`Impossible de charger les contributions partenaire : ${contributionsResponse.error.message}`);
  }
  if (paymentsResponse.error) {
    throw new Error(`Impossible de charger les paiements des réservations : ${paymentsResponse.error.message}`);
  }

  const sessions = sessionsResponse.data ?? [];
  const clients = clientsResponse.data ?? [];
  const profiles = profilesResponse.data ?? [];

  const stayIds = Array.from(new Set(sessions.map((row) => row.stay_id).filter(Boolean)));
  const { data: stays, error: staysError } = stayIds.length
    ? await supabase
        .from('stays')
        .select('id,title,location_text,destination_city,destination_country')
        .in('id', stayIds)
    : { data: [], error: null };

  if (staysError) {
    throw new Error(`Impossible de charger les séjours réservés : ${staysError.message}`);
  }

  const itemsByOrderId = new Map<string, OrderItemRow[]>();
  for (const item of orderItems ?? []) {
    const existing = itemsByOrderId.get(item.order_id) ?? [];
    existing.push(item);
    itemsByOrderId.set(item.order_id, existing);
  }

  const sessionsById = new Map(sessions.map((row) => [row.id, row]));
  const staysById = new Map((stays ?? []).map((row) => [row.id, row]));
  const clientsByUserId = new Map(clients.map((row) => [row.user_id, row]));
  const profilesByUserId = new Map(profiles.map((row) => [row.user_id, row]));
  const latestPaymentStatusByOrderId = new Map<string, string>();
  const latestPaymentModeByOrderId = new Map<string, PartnerPaymentMode>();
  const latestPaymentPayloadByOrderId = new Map<string, Record<string, unknown> | null>();
  const onlinePaidCentsByOrderId = new Map<string, number>();
  for (const payment of paymentsResponse.data ?? []) {
    if (payment.status === 'SUCCEEDED') {
      onlinePaidCentsByOrderId.set(
        payment.order_id,
        (onlinePaidCentsByOrderId.get(payment.order_id) ?? 0) + (payment.amount_cents ?? 0)
      );
    }
    if (!latestPaymentStatusByOrderId.has(payment.order_id)) {
      latestPaymentStatusByOrderId.set(payment.order_id, payment.status);
      latestPaymentModeByOrderId.set(payment.order_id, parsePaymentModeFromPayload(payment.raw_payload));
      latestPaymentPayloadByOrderId.set(
        payment.order_id,
        payment.raw_payload && typeof payment.raw_payload === 'object' && !Array.isArray(payment.raw_payload)
          ? (payment.raw_payload as Record<string, unknown>)
          : null
      );
    }
  }
  const contributionByOrderItemId = new Map(
    (contributionsResponse.data ?? [])
      .filter((row) => row.status !== 'REJECTED')
      .map((row) => [row.order_item_id, row])
  );

  return orderRows
    .filter((order) => {
      const latestPaymentStatus = latestPaymentStatusByOrderId.get(order.id) ?? null;
      if (order.status === 'CANCELLED' && order.cancellation_reason === 'PAYMENT_FAILED') {
        return false;
      }
      return latestPaymentStatus !== 'FAILED';
    })
    .map((order) => {
    const itemsForOrder = itemsByOrderId.get(order.id) ?? [];
    const firstSession = itemsForOrder.length ? sessionsById.get(itemsForOrder[0].session_id) : null;
    const firstStay = firstSession ? staysById.get(firstSession.stay_id) : null;
    const profile = profilesByUserId.get(order.client_user_id);
    const client = clientsByUserId.get(order.client_user_id);
    const beneficiaryName =
      client?.full_name?.trim() ||
      (profile ? buildClientDisplayName(profile) : '') ||
      'Nom non renseigné';
    const beneficiaryEmail = profile?.parent1_email?.trim() || 'Non renseigné';
    const childNames = Array.from(
      new Set(
        itemsForOrder
          .map((item) => [item.child_first_name, item.child_last_name].filter(Boolean).join(' ').trim())
          .filter(Boolean)
      )
    );
    const totalCents = itemsForOrder.reduce((sum, item) => sum + (item.total_price_cents ?? 0), 0);
    const snapshotPartnerCents = itemsForOrder.reduce((sum, item) => {
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
    const hasContributionSnapshot = itemsForOrder.some((item) => contributionByOrderItemId.has(item.id));
    const fallbackSplit = computePartnerFinanceSplit({
      mode: collectivity.finance_mode,
      totalCents,
      percentValue: collectivity.finance_percent_value,
      fixedCents: collectivity.finance_fixed_cents,
      manualPartnerCents: 0
    });
    const partnerContributionCents = hasContributionSnapshot ? snapshotPartnerCents : fallbackSplit.partnerCents;
    const clientContributionCents = Math.max(0, totalCents - partnerContributionCents);
    const paymentMode = latestPaymentModeByOrderId.get(order.id) ?? 'FULL';
    const paymentRawPayload = latestPaymentPayloadByOrderId.get(order.id) ?? null;
    const effectiveRequestKind = inferPartnerRequestKind({
      requestKind: order.request_kind,
      vacafNumberSnapshot: order.vacaf_number_snapshot,
      ancvConnectMatricule: order.ancv_connect_matricule,
      paymentRawPayload
    });
    const onlinePaidCents = onlinePaidCentsByOrderId.get(order.id) ?? 0;
    const remainingBalanceCents = computeRemainingBalanceCents({
      totalCents: clientContributionCents,
      externalAidCents: order.external_aid_cents ?? 0,
      externalPaidCents: order.external_paid_cents ?? 0,
      onlinePaidCents
    });
    const effectiveStatus = reconcileOrderStatusWithBalance({
      status: order.status,
      remainingBalanceCents,
      onlinePaidCents,
      externalPaidCents: order.external_paid_cents ?? 0
    });
    const pendingActions = describePartnerReservationPendingActions({
      status: effectiveStatus,
      requestKind: effectiveRequestKind,
      clientContributionCents,
      collectivityFinanceMode: collectivity.finance_mode,
      hasContributionSnapshot,
      paymentMode,
      externalPaidCents: order.external_paid_cents ?? 0
    });
    const statusLabel = partnerReservationStatusLabel(
      effectiveStatus,
      effectiveRequestKind,
      collectivity.finance_mode,
      hasContributionSnapshot,
      paymentMode,
      order.external_paid_cents ?? 0
    );
    const badgeStatus = partnerReservationBadgeStatus({
      status: effectiveStatus,
      statusLabel
    });

      return {
        id: order.id,
        orderItemIds: itemsForOrder.map((item) => item.id),
        createdAt: order.created_at,
        status: effectiveStatus,
        badgeStatus,
        statusLabel,
        requestKind: effectiveRequestKind,
        paymentMode,
        paymentModeLabel: PAYMENT_MODE_LABELS[paymentMode],
        vacafNumberSnapshot: order.vacaf_number_snapshot,
        ancvConnectMatricule: order.ancv_connect_matricule,
        ancvConnectRequestedAmountCents: order.ancv_connect_requested_amount_cents,
        externalAidCents: order.external_aid_cents ?? 0,
        externalPaidCents: order.external_paid_cents ?? 0,
        pendingActions,
        beneficiaryName,
        beneficiaryEmail,
        stayTitle: firstStay?.title ?? 'Séjour inconnu',
        stayLocation:
          firstStay?.location_text ||
          [firstStay?.destination_city, firstStay?.destination_country].filter(Boolean).join(', ') ||
          'Lieu non renseigné',
        sessionLabel: formatDateRange(firstSession?.start_date, firstSession?.end_date),
        childNames,
        childrenLabel: childNames.length > 0 ? childNames.join(', ') : 'Aucun participant',
        totalCents,
        totalLabel: formatCurrencyFromCents(totalCents, 'EUR'),
        partnerContributionCents,
        clientContributionCents,
        hasContributionSnapshot
      };
    });
}

export type PartnerCollectivityProfile = Awaited<ReturnType<typeof readPartnerCollectivity>>;

export async function listPartnerCatalogStays() {
  const supabase = getServerSupabaseClient();
  const { data: stays, error: staysError } = await supabase
    .from('stays')
    .select(
      'id,title,status,season_id,categories,age_min,age_max,destination_country,destination_countries,transport_mode,required_documents_text,supervision_text,location_text,organizer_id,partner_discount_percent'
    )
    .eq('status', 'PUBLISHED')
    .order('updated_at', { ascending: false })
    .limit(300);

  if (staysError) {
    throw new Error(`Impossible de charger les séjours du catalogue : ${staysError.message}`);
  }

  const stayIds = (stays ?? []).map((stay) => stay.id);
  const organizerIds = Array.from(new Set((stays ?? []).map((stay) => stay.organizer_id).filter(Boolean)));

  const [{ data: sessions, error: sessionsError }, { data: organizers, error: organizersError }, { data: seasons }] =
    await Promise.all([
      stayIds.length
        ? supabase
            .from('sessions')
            .select('id,stay_id,start_date,end_date,status,capacity_total')
            .in('stay_id', stayIds)
            .order('start_date', { ascending: true })
        : Promise.resolve({ data: [], error: null }),
      organizerIds.length
        ? supabase
            .from('organizers')
            .select('id,name,is_resacolo_member,education_project_path')
            .in('id', organizerIds)
        : Promise.resolve({ data: [], error: null }),
      supabase.from('seasons').select('id,name')
    ]);

  if (sessionsError) {
    throw new Error(`Impossible de charger les sessions du catalogue : ${sessionsError.message}`);
  }
  if (organizersError) {
    throw new Error(`Impossible de charger les organisateurs du catalogue : ${organizersError.message}`);
  }

  const sessionIds = (sessions ?? []).map((session) => session.id);
  const { data: orderItemsBySession } = sessionIds.length
    ? await supabase
        .from('order_items')
        .select('session_id,total_price_cents')
        .in('session_id', sessionIds)
    : { data: [] as Array<{ session_id: string; total_price_cents: number | null }> };

  const priceSamplesBySession = new Map<string, number[]>();
  for (const row of orderItemsBySession ?? []) {
    if (typeof row.total_price_cents !== 'number') continue;
    const existing = priceSamplesBySession.get(row.session_id) ?? [];
    existing.push(row.total_price_cents);
    priceSamplesBySession.set(row.session_id, existing);
  }

  const sessionsByStayId = new Map<string, Array<{ id: string; start_date: string; end_date: string; status: string; capacity_total: number; estimated_price_cents: number }>>();
  for (const session of sessions ?? []) {
    const existing = sessionsByStayId.get(session.stay_id) ?? [];
    const prices = priceSamplesBySession.get(session.id) ?? [];
    const estimatedPriceCents = prices.length > 0 ? Math.min(...prices) : 0;
    existing.push({
      id: session.id,
      start_date: session.start_date,
      end_date: session.end_date,
      status: session.status,
      capacity_total: session.capacity_total,
      estimated_price_cents: estimatedPriceCents
    });
    sessionsByStayId.set(session.stay_id, existing);
  }
  const organizersById = new Map(
    (organizers ?? []).map((organizer) => [
      organizer.id,
      {
        name: organizer.name,
        is_resacolo_member: organizer.is_resacolo_member,
        education_project_path: organizer.education_project_path
      }
    ])
  );
  const seasonsById = new Map((seasons ?? []).map((season) => [season.id, season.name]));

  return (stays ?? []).map((stay) => ({
    ...stay,
    season_name: seasonsById.get(stay.season_id) ?? stay.season_id,
    organizer_name: organizersById.get(stay.organizer_id)?.name ?? 'Organisateur',
    organizer_is_partner: organizersById.get(stay.organizer_id)?.is_resacolo_member ?? false,
    education_project_path: organizersById.get(stay.organizer_id)?.education_project_path ?? null,
    sessions: sessionsByStayId.get(stay.id) ?? []
  }));
}
