import {
  normalizePartnerFinanceMode,
  PARTNER_FINANCE_MODE_LABELS
} from '@/lib/partner-offers';
import {
  listPartnerBeneficiaries,
  listPartnerReservations,
  readPartnerCollectivity
} from '@/lib/partner.server';
import type { Database } from '@/types/supabase';

const DASHBOARD_WINDOW_DAYS = 30;
const RECENT_RESERVATIONS_LIMIT = 6;
const TOP_STAYS_LIMIT = 5;
const FINALIZED_STATUSES = new Set<Database['public']['Enums']['order_status']>(['PAID', 'CONFIRMED']);
const DASHBOARD_STATUSES: Database['public']['Enums']['order_status'][] = [
  'REQUESTED',
  'VALIDATED',
  'BOOKED',
  'PAID',
  'CONFIRMED',
  'CANCELLED'
];

function dayKey(date: Date) {
  const y = date.getUTCFullYear();
  const m = String(date.getUTCMonth() + 1).padStart(2, '0');
  const d = String(date.getUTCDate()).padStart(2, '0');
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
    status: Database['public']['Enums']['order_status'];
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
};

export async function buildPartnerDashboardModel(input: {
  collectivityId: string;
  userId: string;
  now?: Date;
}): Promise<PartnerDashboardViewModel> {
  const now = input.now ?? new Date();
  const minDate = new Date(now);
  minDate.setUTCDate(minDate.getUTCDate() - (DASHBOARD_WINDOW_DAYS - 1));
  minDate.setUTCHours(0, 0, 0, 0);

  const [collectivity, beneficiaries, reservations] = await Promise.all([
    readPartnerCollectivity(input.collectivityId),
    listPartnerBeneficiaries(input.collectivityId, input.userId),
    listPartnerReservations(input.collectivityId, input.userId)
  ]);

  const reservations30d = reservations.filter((reservation) => {
    const date = new Date(reservation.createdAt);
    return Number.isFinite(date.getTime()) && date >= minDate && date <= now;
  });

  const dailyReservationsMap = new Map<string, { label: string; count: number }>();
  for (let i = 0; i < DASHBOARD_WINDOW_DAYS; i += 1) {
    const day = new Date(minDate);
    day.setUTCDate(minDate.getUTCDate() + i);
    const key = dayKey(day);
    dailyReservationsMap.set(key, { label: formatDateLabelFR(day), count: 0 });
  }
  for (const reservation of reservations30d) {
    const date = new Date(reservation.createdAt);
    const key = dayKey(date);
    const row = dailyReservationsMap.get(key);
    if (row) row.count += 1;
  }

  const statusCount = new Map<Database['public']['Enums']['order_status'], number>(
    DASHBOARD_STATUSES.map((status) => [status, 0])
  );
  for (const reservation of reservations30d) {
    const current = statusCount.get(reservation.status);
    if (typeof current === 'number') {
      statusCount.set(reservation.status, current + 1);
    }
  }

  let finalizedCount = 0;
  let totalCents30d = 0;
  let partnerCents30d = 0;
  let clientCents30d = 0;

  for (const reservation of reservations30d) {
    if (FINALIZED_STATUSES.has(reservation.status)) finalizedCount += 1;
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
    statusBreakdown: DASHBOARD_STATUSES.map((status) => ({
      status,
      label:
        status === 'REQUESTED'
          ? 'Demandée'
          : status === 'VALIDATED'
            ? 'Validée'
            : status === 'BOOKED'
              ? 'Réservée'
              : status === 'PAID'
                ? 'Payée'
                : status === 'CONFIRMED'
                  ? 'Confirmée'
                  : 'Annulée',
      count: statusCount.get(status) ?? 0
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
    }
  };
}
