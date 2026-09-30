import {
  normalizePartnerFinanceMode,
  PARTNER_FINANCE_MODE_LABELS
} from '@/lib/partner-offers';
import { normalizeOrderStatus } from '@/lib/order-workflow';
import {
  findNewSiteCountries,
  listSiteStayCountryLabels
} from '@/lib/partner-catalog-countries';
import {
  getDefaultPartnerCatalogRules,
  normalizePartnerCatalogRules
} from '@/lib/partner-catalog-rules';
import {
  listPartnerBeneficiaries,
  listPartnerReservations,
  readPartnerCollectivity
} from '@/lib/partner.server';
import type { Database } from '@/types/supabase';

const DASHBOARD_WINDOW_DAYS = 30;
const RECENT_RESERVATIONS_LIMIT = 4;
const TOP_STAYS_LIMIT = 5;

/** Aligné sur les libellés métier partenaires (voir partnerReservationStatusLabel). */
const PARTNER_DEFERRED_STATUS_LABEL = 'Confirmée — paiement différé';

type PartnerDashboardStatusGroupKey =
  | 'requested'
  | 'pending'
  | 'partial'
  | 'paid'
  | 'cancelled'
  | 'failed'
  | 'transferred';

/** Libellés partenaire : regroupement métier (pas seulement le statut SQL brut). */
const PARTNER_STATUS_GROUPS: Array<{
  key: PartnerDashboardStatusGroupKey;
  label: string;
}> = [
  { key: 'requested', label: 'Traitement / calcul en cours' },
  { key: 'pending', label: 'En attente de paiement famille' },
  { key: 'partial', label: 'Paiement partiel reçu' },
  { key: 'paid', label: 'Confirmées' },
  { key: 'cancelled', label: 'Réservation annulée' },
  { key: 'failed', label: 'Échec de paiement' },
  { key: 'transferred', label: 'Réservation transférée' }
];

function resolvePartnerDashboardStatusGroup(input: {
  status: Database['public']['Enums']['order_status'] | string;
  statusLabel: string;
}): PartnerDashboardStatusGroupKey {
  const label = input.statusLabel.trim();
  const normalized = normalizeOrderStatus(input.status) ?? input.status;

  if (label === 'Réservation annulée' || normalized === 'CANCELLED') return 'cancelled';
  if (label === 'Échec de paiement' || normalized === 'FAILED') return 'failed';
  if (label === 'Réservation transférée' || normalized === 'TRANSFERRED') return 'transferred';
  if (label === 'Paiement partiel reçu' || normalized === 'PARTIALLY_PAID') return 'partial';

  // Confirmées métier : payée, legacy CONFIRMED, ou famille soldée avec part partenaire différée.
  if (
    label === 'Réservation payée' ||
    label === PARTNER_DEFERRED_STATUS_LABEL ||
    label.startsWith('Confirmée') ||
    normalized === 'PAID'
  ) {
    return 'paid';
  }

  if (
    label.startsWith('En attente de traitement') ||
    label.startsWith('En attente de calcul partenaire')
  ) {
    return 'requested';
  }

  if (label === 'En attente de paiement famille' || normalized === 'PENDING_PAYMENT') {
    return 'pending';
  }

  if (normalized === 'REQUESTED') return 'requested';

  // Filet de sécurité : ne jamais laisser une résa hors camembert.
  return 'pending';
}

function isPartnerDashboardFinalized(input: {
  status: Database['public']['Enums']['order_status'] | string;
  statusLabel: string;
}) {
  return resolvePartnerDashboardStatusGroup(input) === 'paid';
}
function startOfLocalDay(date: Date) {
  const value = new Date(date);
  value.setHours(0, 0, 0, 0);
  return value;
}

function endOfLocalDay(date: Date) {
  const value = new Date(date);
  value.setHours(23, 59, 59, 999);
  return value;
}

function dayKey(date: Date) {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, '0');
  const d = String(date.getDate()).padStart(2, '0');
  return `${y}-${m}-${d}`;
}

function formatDateLabelFR(value: Date) {
  return new Intl.DateTimeFormat('fr-FR', {
    day: '2-digit',
    month: '2-digit'
  }).format(value);
}

function formatMoneyFromCents(value: number, currency = 'EUR') {
  return new Intl.NumberFormat('fr-FR', {
    style: 'currency',
    currency,
    minimumFractionDigits: 2,
    maximumFractionDigits: 2
  }).format(value / 100);
}

export type PartnerDashboardViewModel = {
  partnerName: string;
  collectivityCode: string;
  periodLabel: string;
  financeModeLabel: string;
  metrics: {
    beneficiariesCount: number;
    reservations30d: number;
    finalizedRate30d: number;
    totalCents30d: number;
    partnerCents30d: number;
    clientCents30d: number;
  };
  dailyReservationsSeries: Array<{
    dayKey: string;
    label: string;
    count: number;
  }>;
  statusBreakdown: Array<{
    key: string;
    label: string;
    count: number;
  }>;
  recentReservations: Array<{
    id: string;
    createdAt: string;
    statusLabel: string;
    beneficiaryName: string;
    stayTitle: string;
    totalLabel: string;
  }>;
  topStays: Array<{
    stayTitle: string;
    reservationsCount: number;
    totalLabel: string;
  }>;
  quickActions: Array<{
    href: string;
    label: string;
    description: string;
  }>;
  emptyState: {
    hasNoBeneficiaries: boolean;
    message: string | null;
  };
  pendingNewCountries: string[];
};

export async function buildPartnerDashboardModel(input: {
  collectivityId: string;
  userId: string;
  now?: Date;
}): Promise<PartnerDashboardViewModel> {
  const now = input.now ?? new Date();
  const minDate = startOfLocalDay(now);
  minDate.setDate(minDate.getDate() - (DASHBOARD_WINDOW_DAYS - 1));
  const maxDate = endOfLocalDay(now);

  const [collectivity, beneficiaries, reservations, siteCountries] = await Promise.all([
    readPartnerCollectivity(input.collectivityId),
    listPartnerBeneficiaries(input.collectivityId, input.userId).then((result) => result.beneficiaries),
    listPartnerReservations(input.collectivityId, input.userId),
    listSiteStayCountryLabels()
  ]);

  const catalogRules = normalizePartnerCatalogRules(
    collectivity.catalog_rules_draft ??
      collectivity.catalog_rules_published ??
      getDefaultPartnerCatalogRules()
  );
  const pendingNewCountries = findNewSiteCountries(
    siteCountries,
    catalogRules.meta?.knownSiteCountries ?? []
  );

  const reservations30d = reservations.filter((reservation) => {
    const date = new Date(reservation.createdAt);
    return Number.isFinite(date.getTime()) && date >= minDate && date <= maxDate;
  });

  const dailyReservationsMap = new Map<string, { label: string; count: number }>();
  for (let i = 0; i < DASHBOARD_WINDOW_DAYS; i += 1) {
    const day = new Date(minDate);
    day.setDate(minDate.getDate() + i);
    const key = dayKey(day);
    dailyReservationsMap.set(key, { label: formatDateLabelFR(day), count: 0 });
  }
  for (const reservation of reservations30d) {
    const date = new Date(reservation.createdAt);
    const key = dayKey(date);
    const row = dailyReservationsMap.get(key);
    if (row) row.count += 1;
  }

  const statusCountByGroup = new Map(PARTNER_STATUS_GROUPS.map((group) => [group.key, 0]));
  let finalizedCount = 0;
  let totalCents30d = 0;
  let partnerCents30d = 0;
  let clientCents30d = 0;

  for (const reservation of reservations30d) {
    const groupKey = resolvePartnerDashboardStatusGroup({
      status: reservation.status,
      statusLabel: reservation.statusLabel
    });
    statusCountByGroup.set(groupKey, (statusCountByGroup.get(groupKey) ?? 0) + 1);

    if (
      isPartnerDashboardFinalized({
        status: reservation.status,
        statusLabel: reservation.statusLabel
      })
    ) {
      finalizedCount += 1;
    }

    totalCents30d += reservation.totalCents;
    partnerCents30d += reservation.partnerContributionCents;
    clientCents30d += reservation.clientContributionCents;
  }

  const stayStats = new Map<string, { title: string; reservationsCount: number; totalCents: number }>();
  for (const reservation of reservations30d) {
    const key = reservation.stayTitle.trim() || 'Séjour non renseigné';
    const existing = stayStats.get(key) ?? { title: key, reservationsCount: 0, totalCents: 0 };
    existing.reservationsCount += 1;
    existing.totalCents += reservation.totalCents;
    stayStats.set(key, existing);
  }

  const topStays = Array.from(stayStats.values())
    .sort((a, b) => {
      if (b.reservationsCount !== a.reservationsCount) return b.reservationsCount - a.reservationsCount;
      return b.totalCents - a.totalCents;
    })
    .slice(0, TOP_STAYS_LIMIT)
    .map((stay) => ({
      stayTitle: stay.title,
      reservationsCount: stay.reservationsCount,
      totalLabel: formatMoneyFromCents(stay.totalCents)
    }));

  const periodLabel = `${formatDateLabelFR(minDate)} - ${formatDateLabelFR(now)} (30 jours)`;

  return {
    partnerName: collectivity.name,
    collectivityCode: collectivity.code,
    periodLabel,
    financeModeLabel: PARTNER_FINANCE_MODE_LABELS[normalizePartnerFinanceMode(collectivity.finance_mode)],
    metrics: {
      beneficiariesCount: beneficiaries.length,
      reservations30d: reservations30d.length,
      finalizedRate30d: reservations30d.length > 0 ? (finalizedCount / reservations30d.length) * 100 : 0,
      totalCents30d,
      partnerCents30d,
      clientCents30d
    },
    dailyReservationsSeries: Array.from(dailyReservationsMap.entries()).map(([key, value]) => ({
      dayKey: key,
      label: value.label,
      count: value.count
    })),
    statusBreakdown: PARTNER_STATUS_GROUPS.map((group) => ({
      key: group.key,
      label: group.label,
      count: statusCountByGroup.get(group.key) ?? 0
    })),
    recentReservations: reservations.slice(0, RECENT_RESERVATIONS_LIMIT).map((reservation) => ({
      id: reservation.id,
      createdAt: reservation.createdAt,
      statusLabel: reservation.statusLabel,
      beneficiaryName: reservation.beneficiaryName,
      stayTitle: reservation.stayTitle,
      totalLabel: reservation.totalLabel
    })),
    topStays,
    quickActions: [
      {
        href: '/partenaire/beneficiaires',
        label: 'Diffuser le code CSE',
        description: `Code actuel: ${collectivity.code}`
      },
      {
        href: '/partenaire/financement',
        label: 'Configurer le financement',
        description: `Mode actuel: ${PARTNER_FINANCE_MODE_LABELS[normalizePartnerFinanceMode(collectivity.finance_mode)]}`
      },
      {
        href: '/partenaire/reservations',
        label: 'Traiter les réservations',
        description: 'Suivre les commandes et parts de prise en charge'
      }
    ],
    emptyState: {
      hasNoBeneficiaries: beneficiaries.length === 0,
      message:
        beneficiaries.length === 0
          ? "Aucun ayant-droit n'est rattaché. Commencez par communiquer votre code CSE aux familles."
          : null
    },
    pendingNewCountries
  };
}
