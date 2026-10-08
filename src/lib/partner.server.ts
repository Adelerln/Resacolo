import { getServerSupabaseClient } from '@/lib/supabase/server';
import { resolveStayDestination } from '@/lib/stay-destination-resolver';
import {
  computeRemainingBalanceCents,
  inferOrderRequestKind,
  orderStatusLabel,
  reconcileOrderStatusWithBalance
} from '@/lib/order-workflow';
import {
  computePartnerContributionSnapshotCents,
  computePartnerFinanceSplit,
  normalizePartnerFinanceMode,
  PARTNER_FINANCE_MODE_LABELS
} from '@/lib/partner-offers';
import { buildClientPaymentSummaryRows } from '@/lib/client-payment-summary';
import { buildFeatureActivationMessage, isMissingAnyColumnError } from '@/lib/supabase-schema-errors';
import type { Database, Json } from '@/types/supabase';

type CollectivityRow = Database['public']['Tables']['collectivities']['Row'];
type CollectivityContactRow = Database['public']['Tables']['collectivity_contacts']['Row'];
type OrderItemRow = Pick<
  Database['public']['Tables']['order_items']['Row'],
  'id' | 'order_id' | 'session_id' | 'child_first_name' | 'child_last_name' | 'total_price_cents'
>;
type SessionPriceRow = Pick<Database['public']['Tables']['session_prices']['Row'], 'session_id' | 'amount_cents'>;
type PartnerPaymentMode = 'FULL' | 'DEPOSIT_200' | 'CV_CONNECT' | 'CV_PAPER' | 'DEFERRED';

const PAYMENT_MODE_LABELS: Record<PartnerPaymentMode, string> = {
  FULL: 'Paiement de la totalité en CB',
  DEPOSIT_200: "Paiement d'un acompte (200 €) en CB",
  CV_CONNECT: 'Paiement en ANCV Connect',
  CV_PAPER: 'Paiement en ANCV papier',
  DEFERRED: 'Paiement différé'
};

function resolvePartnerFinanceModeAtOrderLabel(input: {
  paymentRawPayload: Record<string, unknown> | null;
  contributionMode: string | null | undefined;
  contributionPercentValue: number | null | undefined;
  partnerContributionCents: number;
  totalCents: number;
  fallbackFinanceMode: string | null | undefined;
}) {
  const snapshot = input.paymentRawPayload?.partnerFinanceSnapshot;
  if (snapshot && typeof snapshot === 'object' && !Array.isArray(snapshot)) {
    const mode = normalizePartnerFinanceMode(
      typeof (snapshot as { mode?: unknown }).mode === 'string'
        ? ((snapshot as { mode: string }).mode)
        : null
    );
    if (mode === 'PERCENT') {
      const percent =
        typeof (snapshot as { percentValue?: unknown }).percentValue === 'number'
          ? Math.round((snapshot as { percentValue: number }).percentValue)
          : null;
      return percent != null && percent > 0 && percent < 100
        ? `Quote-part en % (${percent} %)`
        : PARTNER_FINANCE_MODE_LABELS.PERCENT;
    }
    if (mode === 'FIXED') {
      const fixedCents =
        typeof (snapshot as { fixedCents?: unknown }).fixedCents === 'number'
          ? Math.round((snapshot as { fixedCents: number }).fixedCents)
          : null;
      return fixedCents != null && fixedCents > 0
        ? `Quote-part fixe (${formatCurrencyFromCents(fixedCents, 'EUR')})`
        : PARTNER_FINANCE_MODE_LABELS.FIXED;
    }
    return PARTNER_FINANCE_MODE_LABELS[mode];
  }

  if (input.contributionMode === 'PERCENT') {
    const percent = Math.round(Number(input.contributionPercentValue ?? 0));
    if (percent >= 100) return PARTNER_FINANCE_MODE_LABELS.TOTAL;
    if (percent > 0) return `Quote-part en % (${percent} %)`;
    return PARTNER_FINANCE_MODE_LABELS.PERCENT;
  }

  if (input.contributionMode === 'FIXED') {
    if (input.partnerContributionCents <= 0) return PARTNER_FINANCE_MODE_LABELS.NONE;
    if (input.totalCents > 0 && input.partnerContributionCents >= input.totalCents) {
      return PARTNER_FINANCE_MODE_LABELS.TOTAL;
    }
    return PARTNER_FINANCE_MODE_LABELS.FIXED;
  }

  return PARTNER_FINANCE_MODE_LABELS[normalizePartnerFinanceMode(input.fallbackFinanceMode)];
}

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
  // Matricule ANCV optionnel sur le TPE Limonetik : ne pas inférer une demande organisme.
  return inferOrderRequestKind({
    requestKind: input.requestKind,
    paymentRawPayload: input.paymentRawPayload
  });
}

/** Solde famille soldé, part partenaire encore due à l’organisateur (règlement différé). */
const PARTNER_DEFERRED_PAYMENT_STATUS_LABEL = 'Confirmée — paiement différé';

function partnerReservationStatusLabel(
  status: Database['public']['Enums']['order_status'],
  requestKind: string | null | undefined,
  collectivityFinanceMode: string | null | undefined,
  hasContributionSnapshot: boolean,
  paymentMode: PartnerPaymentMode,
  externalPaidCents: number,
  externalAidCents = 0,
  remainingBalanceCents = 0,
  partnerContributionCents = 0
) {
  const financeMode = normalizePartnerFinanceMode(collectivityFinanceMode);
  const vacafResolved = requestKind === 'VACAF' && externalAidCents > 0;
  const ancvConnectResolved = requestKind === 'ANCV_CONNECT' && externalPaidCents > 0;
  // Après saisie organisme (CAF / ANCV), ne plus afficher « traitement organisme ».
  const awaitingOrganizerVacaf =
    status === 'REQUESTED' && requestKind === 'VACAF' && !vacafResolved;
  const awaitingOrganizerAncv =
    status === 'REQUESTED' && requestKind === 'ANCV_CONNECT' && !ancvConnectResolved;
  const hasOpenOrganizerPaperWorkflow =
    paymentMode === 'CV_PAPER' &&
    externalPaidCents <= 0 &&
    (status === 'REQUESTED' || status === 'PENDING_PAYMENT');
  const familySettledWithPartnerShareDue =
    remainingBalanceCents <= 0 && partnerContributionCents > 0;

  if (status === 'REQUESTED') {
    if (awaitingOrganizerVacaf) {
      return 'En attente de traitement organisme (VACAF)';
    }
    if (awaitingOrganizerAncv) {
      return 'En attente de traitement organisme (ANCV Connect)';
    }
    if (hasOpenOrganizerPaperWorkflow) return 'En attente de traitement organisme (ANCV papier)';
    if (financeMode === 'MANUAL' && !hasContributionSnapshot) {
      return 'En attente de calcul partenaire (QF / prise en charge)';
    }
    if (familySettledWithPartnerShareDue) return PARTNER_DEFERRED_PAYMENT_STATUS_LABEL;
    return 'En attente de paiement famille';
  }

  if (status === 'PENDING_PAYMENT') {
    if (hasOpenOrganizerPaperWorkflow) return 'En attente de traitement organisme (ANCV papier)';
    if (financeMode === 'MANUAL' && !hasContributionSnapshot) {
      return 'En attente de calcul partenaire (QF / prise en charge)';
    }
    if (familySettledWithPartnerShareDue) return PARTNER_DEFERRED_PAYMENT_STATUS_LABEL;
    if (remainingBalanceCents <= 0) return 'Réservation payée';
    return 'En attente de paiement famille';
  }
  if (status === 'PARTIALLY_PAID') return 'Paiement partiel reçu';
  if (status === 'PAID') {
    if (familySettledWithPartnerShareDue) return PARTNER_DEFERRED_PAYMENT_STATUS_LABEL;
    return 'Réservation payée';
  }
  if (status === 'FAILED') return 'Échec de paiement';
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
  if (
    input.statusLabel.startsWith('En attente de traitement') ||
    input.statusLabel.startsWith('En attente de calcul partenaire')
  ) {
    return 'REQUESTED' as const;
  }
  // Confirmées métier (payée famille, ou différé partenaire).
  if (
    input.statusLabel === PARTNER_DEFERRED_PAYMENT_STATUS_LABEL ||
    input.statusLabel === 'Réservation payée'
  ) {
    return 'PAID' as const;
  }
  return input.status;
}

function describePartnerReservationPendingActions(input: {
  status: Database['public']['Enums']['order_status'];
  requestKind: string | null | undefined;
  clientContributionCents: number;
  remainingBalanceCents?: number;
  collectivityFinanceMode: string | null | undefined;
  hasContributionSnapshot: boolean;
  paymentMode: PartnerPaymentMode;
  externalPaidCents: number;
  externalAidCents?: number;
}) {
  const actions: Array<{ actorLabel: string; description: string }> = [];
  const financeMode = normalizePartnerFinanceMode(input.collectivityFinanceMode);
  const remainingBalanceCents =
    typeof input.remainingBalanceCents === 'number'
      ? Math.max(0, input.remainingBalanceCents)
      : Math.max(0, input.clientContributionCents);
  const isOpenWorkflow =
    input.status === 'REQUESTED' ||
    input.status === 'PENDING_PAYMENT' ||
    input.status === 'PARTIALLY_PAID';
  const organizerPaperWorkflowOpen =
    input.paymentMode === 'CV_PAPER' &&
    input.externalPaidCents <= 0 &&
    (input.status === 'REQUESTED' ||
      input.status === 'PENDING_PAYMENT');

  if (financeMode === 'MANUAL' && !input.hasContributionSnapshot && isOpenWorkflow) {
    actions.push({
      actorLabel: 'Partenaire',
      description:
        'Renseigner le quotient familial (Financement / Bénéficiaires) ou le montant de prise en charge, puis enregistrer le devis pour cette réservation.'
    });
  }

  if (
    input.status === 'REQUESTED' &&
    input.requestKind === 'VACAF' &&
    (input.externalAidCents ?? 0) <= 0
  ) {
    actions.push({
      actorLabel: 'Organisme',
      description: 'Vérifier les droits VACAF / AVE puis saisir le montant CAF appliqué à la réservation.'
    });
  }

  if (
    input.status === 'REQUESTED' &&
    input.requestKind === 'ANCV_CONNECT' &&
    input.externalPaidCents <= 0
  ) {
    actions.push({
      actorLabel: 'Organisme',
      description:
        'Envoyer à la famille un lien de paiement ANCV Connect (montant + identifiant client), puis saisir le montant effectivement encaissé.'
    });
  }

  if (organizerPaperWorkflowOpen) {
    actions.push({
      actorLabel: 'Organisme',
      description: 'Confirmer la réception du règlement en ANCV papier puis enregistrer le montant encaissé.'
    });
  }

  if (
    (input.status === 'PENDING_PAYMENT' || input.status === 'PARTIALLY_PAID') &&
    !organizerPaperWorkflowOpen &&
    remainingBalanceCents > 0 &&
    !(financeMode === 'MANUAL' && !input.hasContributionSnapshot)
  ) {
    actions.push({
      actorLabel: 'Famille',
      description:
        input.status === 'PARTIALLY_PAID'
          ? 'Compléter le paiement du solde restant.'
          : 'Régler le solde restant de la réservation.'
    });
  }

  if (
    input.status === 'REQUESTED' &&
    !organizerPaperWorkflowOpen &&
    remainingBalanceCents > 0 &&
    !(input.requestKind === 'VACAF' && (input.externalAidCents ?? 0) <= 0) &&
    !(input.requestKind === 'ANCV_CONNECT' && input.externalPaidCents <= 0) &&
    !(financeMode === 'MANUAL' && !input.hasContributionSnapshot)
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
  sub_entity_id?: string | null;
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
  subEntityId: string | null;
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
  /** Si renseigné, n'autorise la MAJ que pour un ayant-droit de cette sous-entité. */
  subEntityId?: string | null;
}) {
  const supabase = getServerSupabaseClient();
  const { data: client, error: readError } = await supabase
    .from('clients')
    .select('user_id,collectivity_id,sub_entity_id')
    .eq('user_id', input.beneficiaryUserId)
    .maybeSingle();

  if (readError) {
    if (isMissingAnyColumnError(readError, ['sub_entity_id'])) {
      const legacy = await supabase
        .from('clients')
        .select('user_id,collectivity_id')
        .eq('user_id', input.beneficiaryUserId)
        .maybeSingle();
      if (legacy.error) throw new Error(`Impossible de vérifier l'ayant-droit : ${legacy.error.message}`);
      if (!legacy.data || legacy.data.collectivity_id !== input.collectivityId) {
        throw new Error('Ayant-droit introuvable pour votre collectivité.');
      }
    } else {
      throw new Error(`Impossible de vérifier l'ayant-droit : ${readError.message}`);
    }
  } else {
    if (!client || client.collectivity_id !== input.collectivityId) {
      throw new Error('Ayant-droit introuvable pour votre collectivité.');
    }
    if (input.subEntityId && client.sub_entity_id !== input.subEntityId) {
      throw new Error('Ayant-droit introuvable pour votre sous-entité.');
    }
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

  const { recalculateOpenOrdersAfterBeneficiaryQfUpdate } = await import(
    '@/lib/partner-qf-order-recalc.server'
  );
  await recalculateOpenOrdersAfterBeneficiaryQfUpdate({
    collectivityId: input.collectivityId,
    beneficiaryUserId: input.beneficiaryUserId,
    familyQuotient: input.familyQuotient,
    familyQuotientExpiresOn: input.familyQuotientExpiresOn
  });
}

export async function updatePartnerBeneficiarySubEntity(input: {
  collectivityId: string;
  beneficiaryUserId: string;
  subEntityId: string | null;
}) {
  const supabase = getServerSupabaseClient();

  if (input.subEntityId) {
    const { data: subEntity, error } = await supabase
      .from('collectivity_sub_entities')
      .select('id')
      .eq('id', input.subEntityId)
      .eq('collectivity_id', input.collectivityId)
      .maybeSingle();
    if (error) {
      if (isMissingAnyColumnError(error, ['id']) || error.code === 'PGRST205') {
        throw new Error(buildFeatureActivationMessage('Les sous-entités partenaires'));
      }
      throw new Error(`Impossible de vérifier la sous-entité : ${error.message}`);
    }
    if (!subEntity) throw new Error('Sous-entité introuvable.');
  }

  const { error: updateError } = await supabase
    .from('clients')
    .update({ sub_entity_id: input.subEntityId })
    .eq('user_id', input.beneficiaryUserId)
    .eq('collectivity_id', input.collectivityId);

  if (updateError) {
    if (isMissingAnyColumnError(updateError, ['sub_entity_id'])) {
      throw new Error(buildFeatureActivationMessage('Les sous-entités partenaires'));
    }
    throw new Error(`Impossible d'assigner la sous-entité : ${updateError.message}`);
  }
}

export async function listPartnerBeneficiaryUserIds(
  collectivityId: string,
  excludedUserId?: string | null,
  subEntityId?: string | null
) {
  const supabase = getServerSupabaseClient();
  let query = supabase.from('clients').select('user_id').eq('collectivity_id', collectivityId);
  if (subEntityId) {
    query = query.eq('sub_entity_id', subEntityId);
  }
  const { data, error } = await query;

  if (error) {
    if (subEntityId && isMissingAnyColumnError(error, ['sub_entity_id'])) {
      return [];
    }
    throw new Error(`Impossible de charger les bénéficiaires rattachés : ${error.message}`);
  }

  return (data ?? [])
    .map((row) => row.user_id)
    .filter((userId) => userId !== excludedUserId);
}

export async function listPartnerBeneficiaries(
  collectivityId: string,
  excludedUserId?: string | null,
  subEntityId?: string | null
): Promise<PartnerBeneficiariesListResult> {
  const supabase = getServerSupabaseClient();
  let qfFieldsAvailable = true;
  let beneficiaryClientsQuery = supabase
    .from('clients')
    .select('user_id,full_name,phone,created_at,family_quotient,family_quotient_expires_on,sub_entity_id')
    .eq('collectivity_id', collectivityId);
  if (subEntityId) {
    beneficiaryClientsQuery = beneficiaryClientsQuery.eq('sub_entity_id', subEntityId);
  }
  const beneficiaryClientsWithQf = await beneficiaryClientsQuery;

  let beneficiaryClients: PartnerBeneficiaryClientRow[] | null = beneficiaryClientsWithQf.data;
  let beneficiaryClientsError = beneficiaryClientsWithQf.error;

  if (
    beneficiaryClientsError &&
    isMissingAnyColumnError(beneficiaryClientsError, ['sub_entity_id'])
  ) {
    let legacyWithQf = supabase
      .from('clients')
      .select('user_id,full_name,phone,created_at,family_quotient,family_quotient_expires_on')
      .eq('collectivity_id', collectivityId);
    const legacyResult = await legacyWithQf;
    beneficiaryClients = (legacyResult.data ?? []) as PartnerBeneficiaryClientRow[];
    beneficiaryClientsError = legacyResult.error;
    if (subEntityId) {
      beneficiaryClients = [];
    }
  }

  if (beneficiaryClientsError && isMissingAnyColumnError(beneficiaryClientsError, [...CLIENT_QF_COLUMNS])) {
    qfFieldsAvailable = false;
    let legacyClientsQuery = supabase
      .from('clients')
      .select('user_id,full_name,phone,created_at')
      .eq('collectivity_id', collectivityId);
    if (subEntityId) {
      // column may be missing; empty list already handled above
    }
    const legacyClients = await legacyClientsQuery;
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
        : null,
      subEntityId: clientRow.sub_entity_id ?? null
    };
  });

  return { beneficiaries, qfFieldsAvailable };
}

export async function listPartnerReservations(
  collectivityId: string,
  excludedUserId?: string | null,
  subEntityId?: string | null
) {
  const supabase = getServerSupabaseClient();
  const collectivity = await readPartnerCollectivity(collectivityId);

  let scopedClientUserIds: string[] | null = null;
  if (subEntityId) {
    scopedClientUserIds = await listPartnerBeneficiaryUserIds(collectivityId, excludedUserId, subEntityId);
    if (scopedClientUserIds.length === 0) return [];
  }

  // Ne pas sélectionner vacaf_number_snapshot / ancv_connect_* : absents sur certaines bases
  // et faisaient basculer vers un fallback qui perdait external_aid_cents.
  let ordersQuery = supabase
    .from('orders')
    .select(
      'id,status,request_kind,external_aid_cents,external_paid_cents,created_at,requested_at,validated_at,booked_at,paid_at,cancellation_reason,client_user_id,collectivity_id'
    )
    .eq('collectivity_id', collectivityId)
    .neq('status', 'CART')
    .order('created_at', { ascending: false });
  if (scopedClientUserIds) {
    ordersQuery = ordersQuery.in('client_user_id', scopedClientUserIds);
  }
  let { data: orders, error: ordersError } = await ordersQuery;

  if (
    ordersError &&
    isMissingAnyColumnError(ordersError, [
      'request_kind',
      'external_aid_cents',
      'external_paid_cents',
      'cancellation_reason'
    ])
  ) {
    let legacyOrdersQuery = supabase
      .from('orders')
      .select('id,status,created_at,requested_at,validated_at,booked_at,paid_at,client_user_id,collectivity_id')
      .eq('collectivity_id', collectivityId)
      .neq('status', 'CART')
      .order('created_at', { ascending: false });
    if (scopedClientUserIds) {
      legacyOrdersQuery = legacyOrdersQuery.in('client_user_id', scopedClientUserIds);
    }
    const legacyOrdersResult = await legacyOrdersQuery;

    orders = (legacyOrdersResult.data ?? []).map((order) => ({
      ...order,
      request_kind: null,
      external_aid_cents: 0,
      external_paid_cents: 0,
      cancellation_reason: null
    }));
    ordersError = legacyOrdersResult.error;
  }

  if (ordersError) {
    throw new Error(`Impossible de charger les réservations : ${ordersError.message}`);
  }

  const orderRows = (orders ?? []).map((order) => ({
    ...order,
    vacaf_number_snapshot: null as string | null,
    ancv_connect_matricule: null as string | null,
    ancv_connect_requested_amount_cents: null as number | null
  }));
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
        .select('collectivity_id,order_item_id,mode,fixed_cents,percent_value,cap_cents,status,approved_by_user_id')
        .eq('collectivity_id', collectivityId)
        .in('order_item_id', orderItemIds)
    : { data: [], error: null };

  const sessionsResponse = sessionIds.length
    ? await supabase.from('sessions').select('id,start_date,end_date,stay_id').in('id', sessionIds)
    : { data: [], error: null };
  let clientsResponse: {
    data: Array<{ user_id: string; full_name: string | null; sub_entity_id?: string | null }> | null;
    error: { message?: string; code?: string } | null;
  } = clientUserIds.length
    ? await supabase
        .from('clients')
        .select('user_id,full_name,sub_entity_id')
        .in('user_id', clientUserIds)
    : { data: [], error: null };
  if (clientsResponse.error && isMissingAnyColumnError(clientsResponse.error, ['sub_entity_id'])) {
    clientsResponse = await supabase
      .from('clients')
      .select('user_id,full_name')
      .in('user_id', clientUserIds);
  }
  const profilesResponse = clientUserIds.length
    ? await supabase
        .from('client_profiles')
        .select('user_id,parent1_first_name,parent1_last_name,parent1_email')
        .in('user_id', clientUserIds)
    : { data: [], error: null };
  const paymentsResponse = orderIds.length
    ? await supabase
        .from('payments')
        .select('order_id,status,amount_cents,created_at,updated_at,raw_payload')
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
  const paymentsByOrderId = new Map<
    string,
    Array<{
      order_id: string;
      status: string;
      amount_cents: number;
      created_at: string | null;
      updated_at: string | null;
      raw_payload: unknown;
    }>
  >();
  for (const payment of paymentsResponse.data ?? []) {
    const list = paymentsByOrderId.get(payment.order_id) ?? [];
    list.push(payment);
    paymentsByOrderId.set(payment.order_id, list);
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
      if (order.status === 'FAILED' || (order.status === 'CANCELLED' && order.cancellation_reason === 'PAYMENT_FAILED')) {
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
    const financeMode = normalizePartnerFinanceMode(collectivity.finance_mode);
    // MANUAL : un FIXED 0 auto (checkout devis) ne compte pas comme calcul partenaire.
    const hasContributionSnapshot = itemsForOrder.some((item) => {
      const contribution = contributionByOrderItemId.get(item.id);
      if (!contribution) return false;
      if (financeMode !== 'MANUAL') return true;
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
    const fallbackSplit = computePartnerFinanceSplit({
      mode: collectivity.finance_mode,
      totalCents,
      percentValue: collectivity.finance_percent_value,
      fixedCents: collectivity.finance_fixed_cents,
      manualPartnerCents: 0
    });
    const partnerContributionCents = hasContributionSnapshot ? snapshotPartnerCents : fallbackSplit.partnerCents;
    const clientContributionCents = hasContributionSnapshot
      ? Math.max(0, totalCents - partnerContributionCents)
      : financeMode === 'MANUAL'
        ? totalCents
        : Math.max(0, totalCents - partnerContributionCents);
    const paymentMode = latestPaymentModeByOrderId.get(order.id) ?? 'FULL';
    const paymentRawPayload = latestPaymentPayloadByOrderId.get(order.id) ?? null;
    const effectiveRequestKind = inferPartnerRequestKind({
      requestKind: order.request_kind,
      vacafNumberSnapshot: order.vacaf_number_snapshot,
      ancvConnectMatricule: order.ancv_connect_matricule,
      paymentRawPayload
    });
    const onlinePaidCents = onlinePaidCentsByOrderId.get(order.id) ?? 0;
    const externalAidCents = order.external_aid_cents ?? 0;
    const externalPaidCents = order.external_paid_cents ?? 0;
    const parentPaidCents = onlinePaidCents + externalPaidCents;
    const remainingBalanceCents = computeRemainingBalanceCents({
      totalCents: clientContributionCents,
      externalAidCents,
      externalPaidCents,
      onlinePaidCents
    });
    const effectiveStatus = reconcileOrderStatusWithBalance({
      status: order.status,
      remainingBalanceCents,
      onlinePaidCents,
      externalPaidCents
    });
    const pendingActions = describePartnerReservationPendingActions({
      status: effectiveStatus,
      requestKind: effectiveRequestKind,
      clientContributionCents,
      remainingBalanceCents,
      collectivityFinanceMode: collectivity.finance_mode,
      hasContributionSnapshot,
      paymentMode,
      externalPaidCents,
      externalAidCents
    });
    const statusLabel = partnerReservationStatusLabel(
      effectiveStatus,
      effectiveRequestKind,
      collectivity.finance_mode,
      hasContributionSnapshot,
      paymentMode,
      externalPaidCents,
      externalAidCents,
      remainingBalanceCents,
      partnerContributionCents
    );
    const badgeStatus = partnerReservationBadgeStatus({
      status: effectiveStatus,
      statusLabel
    });

    const firstContribution = itemsForOrder
      .map((item) => contributionByOrderItemId.get(item.id))
      .find(Boolean);
    const financeModeAtOrderLabel = resolvePartnerFinanceModeAtOrderLabel({
      paymentRawPayload,
      contributionMode: firstContribution?.mode,
      contributionPercentValue: firstContribution?.percent_value,
      partnerContributionCents,
      totalCents,
      fallbackFinanceMode: collectivity.finance_mode
    });
    const paymentLines = buildClientPaymentSummaryRows({
      payments: paymentsByOrderId.get(order.id) ?? [],
      externalPaidCents,
      requestKind: effectiveRequestKind,
      fallbackDateIso: order.paid_at ?? order.created_at
    }).map((row) => ({
      dateLabel: row.dateLabel,
      label: row.label,
      amountCents: row.amountCents
    }));
    const vacafCoverageLines =
      externalAidCents > 0
        ? [
            {
              label: 'Prise en charge VACAF / AVE',
              amountCents: externalAidCents
            }
          ]
        : [];

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
        vacafDepartmentCode: (() => {
          const contact = paymentRawPayload?.contact;
          if (!contact || typeof contact !== 'object' || Array.isArray(contact)) return null;
          const direct = (contact as { vacafDepartmentCode?: unknown }).vacafDepartmentCode;
          if (typeof direct === 'string' && direct.trim()) return direct.trim();
          return null;
        })(),
        ancvConnectMatricule: order.ancv_connect_matricule,
        ancvConnectRequestedAmountCents: order.ancv_connect_requested_amount_cents,
        externalAidCents,
        externalPaidCents,
        onlinePaidCents,
        parentPaidCents,
        remainingBalanceCents,
        financeModeAtOrderLabel,
        vacafCoverageLines,
        paymentLines,
        pendingActions,
        clientUserId: order.client_user_id,
        clientSubEntityId: client?.sub_entity_id ?? null,
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
      'id,title,status,season_id,categories,age_min,age_max,destination_type,destination_country,destination_countries,destination_city,destination_region,destination_itinerary_label,region_text,transport_mode,required_documents_text,supervision_text,location_text,organizer_id,partner_discount_percent'
    )
    .eq('status', 'PUBLISHED')
    .order('updated_at', { ascending: false })
    .limit(300);

  if (staysError) {
    throw new Error(`Impossible de charger les séjours du catalogue : ${staysError.message}`);
  }

  const stayIds = (stays ?? []).map((stay) => stay.id);
  const organizerIds = Array.from(new Set((stays ?? []).map((stay) => stay.organizer_id).filter(Boolean)));

  const [
    { data: sessions, error: sessionsError },
    { data: organizers, error: organizersError },
    { data: seasons },
    { data: sessionPrices, error: sessionPricesError }
  ] =
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
      supabase.from('seasons').select('id,name'),
      stayIds.length
        ? supabase.from('session_prices').select('session_id,amount_cents')
        : Promise.resolve({ data: [] as SessionPriceRow[], error: null })
    ]);

  if (sessionsError) {
    throw new Error(`Impossible de charger les sessions du catalogue : ${sessionsError.message}`);
  }
  if (organizersError) {
    throw new Error(`Impossible de charger les organisateurs du catalogue : ${organizersError.message}`);
  }
  if (sessionPricesError) {
    throw new Error(`Impossible de charger les tarifs des sessions du catalogue : ${sessionPricesError.message}`);
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

  const sessionPriceBySessionId = new Map(
    (sessionPrices ?? [])
      .filter((row): row is SessionPriceRow & { amount_cents: number } => typeof row.amount_cents === 'number')
      .map((row) => [row.session_id, row.amount_cents])
  );

  const sessionsByStayId = new Map<string, Array<{ id: string; start_date: string; end_date: string; status: string; capacity_total: number; estimated_price_cents: number }>>();
  for (const session of sessions ?? []) {
    const existing = sessionsByStayId.get(session.stay_id) ?? [];
    const prices = priceSamplesBySession.get(session.id) ?? [];
    const estimatedPriceCents = sessionPriceBySessionId.get(session.id) ?? (prices.length > 0 ? Math.min(...prices) : 0);
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

  return (stays ?? []).map((stay) => {
    const resolvedDestination = resolveStayDestination({
      destinationType: stay.destination_type,
      destinationCountry: stay.destination_country,
      destinationCountries: stay.destination_countries,
      destinationCity: stay.destination_city,
      destinationRegion: stay.destination_region,
      regionText: stay.region_text,
      locationText: stay.location_text,
      destinationItineraryLabel: stay.destination_itinerary_label
    });
    const resolvedCountry =
      resolvedDestination.destinationCountry ??
      (resolvedDestination.destinationType === 'fixed_france' || resolvedDestination.destinationRegion
        ? 'France'
        : null);
    const resolvedCountries =
      resolvedDestination.destinationCountries.length > 0
        ? resolvedDestination.destinationCountries
        : resolvedCountry
          ? [resolvedCountry]
          : [];

    return {
      ...stay,
      destination_country: resolvedCountry,
      destination_countries: resolvedCountries,
      season_name: seasonsById.get(stay.season_id) ?? stay.season_id,
      organizer_name: organizersById.get(stay.organizer_id)?.name ?? 'Organisateur',
      organizer_is_partner: organizersById.get(stay.organizer_id)?.is_resacolo_member ?? false,
      education_project_path: organizersById.get(stay.organizer_id)?.education_project_path ?? null,
      sessions: sessionsByStayId.get(stay.id) ?? []
    };
  });
}
