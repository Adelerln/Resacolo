import { randomBytes } from 'node:crypto';
import { getServerSupabaseClient } from '@/lib/supabase/server';
import type { FamilyReservation } from '@/types/family-profile';
import type { Database } from '@/types/supabase';

type LegacyCustomerRow = Database['public']['Tables']['legacy_wp_customers']['Row'];
type LegacyReservationRow = Database['public']['Tables']['legacy_wp_reservations']['Row'];

const LEGACY_COVER_IMAGE = '/image/accueil/images_accueil/logo-resacolo.png';

export function normalizeLegacyEmail(email: string | null | undefined) {
  return (email ?? '').trim().toLowerCase();
}

function formatDateRange(startDate: string | null | undefined, endDate: string | null | undefined) {
  if (!startDate || !endDate) return 'Dates à confirmer';
  const start = new Date(startDate);
  const end = new Date(endDate);
  if (!Number.isFinite(start.getTime()) || !Number.isFinite(end.getTime())) return 'Dates à confirmer';
  return `${start.toLocaleDateString('fr-FR')} au ${end.toLocaleDateString('fr-FR')}`;
}

function mapLegacyOrderStatus(statusCode: string): string {
  if (statusCode === 'CANCELLED') return 'CANCELLED';
  if (statusCode === 'ON_HOLD') return 'PENDING_PAYMENT';
  return 'PAID';
}

export async function findLegacyWpCustomerByEmail(
  email: string
): Promise<LegacyCustomerRow | null> {
  const normalized = normalizeLegacyEmail(email);
  if (!normalized) return null;
  const supabase = getServerSupabaseClient();
  const { data, error } = await supabase
    .from('legacy_wp_customers')
    .select('*')
    .eq('email', normalized)
    .maybeSingle();
  if (error) {
    if (error.message?.includes('legacy_wp_customers') || error.code === '42P01') {
      return null;
    }
    console.warn('[legacy-wp] find customer failed:', error.message);
    return null;
  }
  return data;
}

export async function findAuthUserIdByEmail(email: string): Promise<string | null> {
  const supabase = getServerSupabaseClient();
  const normalized = normalizeLegacyEmail(email);
  for (let page = 1; page <= 20; page += 1) {
    const { data, error } = await supabase.auth.admin.listUsers({ page, perPage: 200 });
    if (error) {
      console.warn('[legacy-wp] listUsers failed:', error.message);
      return null;
    }
    const match = data.users.find((user) => user.email?.toLowerCase() === normalized);
    if (match?.id) return match.id;
    if (data.users.length < 200) break;
  }
  return null;
}

/**
 * Crée un utilisateur Auth confirmé pour un client legacy (sans MDP connu).
 * Retourne l'user id (existant ou créé).
 */
export async function ensureAuthUserForLegacyCustomer(input: {
  email: string;
  firstName?: string;
  lastName?: string;
}): Promise<{ userId: string; created: boolean }> {
  const email = normalizeLegacyEmail(input.email);
  const existingId = await findAuthUserIdByEmail(email);
  if (existingId) {
    return { userId: existingId, created: false };
  }

  const supabase = getServerSupabaseClient();
  const randomPassword = `Lw-${randomBytes(24).toString('base64url')}!aA1`;
  const fullName = [input.firstName, input.lastName].filter(Boolean).join(' ').trim();
  const { data, error } = await supabase.auth.admin.createUser({
    email,
    password: randomPassword,
    email_confirm: true,
    user_metadata: {
      first_name: input.firstName ?? '',
      last_name: input.lastName ?? '',
      name: fullName,
      legacy_wp: true
    }
  });

  if (error || !data.user?.id) {
    const raced = await findAuthUserIdByEmail(email);
    if (raced) return { userId: raced, created: false };
    throw error ?? new Error('Impossible de créer le compte legacy.');
  }

  return { userId: data.user.id, created: true };
}

export async function markLegacyWpCustomerClaimed(input: {
  userId: string;
  email: string;
}): Promise<void> {
  const email = normalizeLegacyEmail(input.email);
  if (!email) return;
  const supabase = getServerSupabaseClient();
  const { error } = await supabase
    .from('legacy_wp_customers')
    .update({
      claimed_user_id: input.userId,
      updated_at: new Date().toISOString()
    })
    .eq('email', email);

  if (error) {
    console.warn('[legacy-wp] claim update failed:', error.message);
  }
}

function mapLegacyReservationRow(row: LegacyReservationRow): FamilyReservation {
  const endMs = row.session_end_date
    ? new Date(`${row.session_end_date}T23:59:59`).getTime()
    : 0;
  const isPast = !Number.isFinite(endMs) || endMs < Date.now() || row.status_code !== 'ON_HOLD';

  return {
    orderId: `legacy-${row.wp_order_item_id}`,
    orderStatus: mapLegacyOrderStatus(row.status_code),
    title: row.stay_title,
    coverImage: LEGACY_COVER_IMAGE,
    dates: formatDateRange(row.session_start_date, row.session_end_date),
    child: 'Séjour historique Resacolo',
    children: [],
    status: row.status_label,
    sessionStartDate: row.session_start_date,
    sessionEndDate: row.session_end_date,
    isPast,
    totalCents: 0,
    currency: 'EUR',
    paymentMode: 'FULL',
    paymentModeLabel: '',
    remainingBalanceCents: 0,
    clientPaidCents: 0,
    partnerDiscountLine: null,
    partnerCoverageLine: null,
    transportLine: null,
    transportOutboundLine: null,
    transportReturnLine: null,
    insuranceLine: null,
    extraLines: [],
    organizerContactEmail: null,
    organizerName: null,
    hasSuccessfulPayment: false,
    partnerAdjustmentMessage: null,
    partnerAdjustmentUpdatedAt: null,
    isLegacy: true
  };
}

export async function readLegacyWpReservations(input: {
  email?: string | null;
  userId?: string | null;
}): Promise<FamilyReservation[]> {
  const supabase = getServerSupabaseClient();
  const emails = new Set<string>();
  const normalized = normalizeLegacyEmail(input.email);
  if (normalized) emails.add(normalized);

  if (input.userId) {
    const { data: claimed } = await supabase
      .from('legacy_wp_customers')
      .select('email')
      .eq('claimed_user_id', input.userId)
      .maybeSingle();
    if (claimed?.email) emails.add(normalizeLegacyEmail(claimed.email));
  }

  if (emails.size === 0) return [];

  const { data, error } = await supabase
    .from('legacy_wp_reservations')
    .select('*')
    .in('email', Array.from(emails));

  if (error) {
    if (error.message?.includes('legacy_wp_reservations') || error.code === '42P01') {
      return [];
    }
    console.warn('[legacy-wp] read reservations failed:', error.message);
    return [];
  }

  return (data ?? [])
    .map(mapLegacyReservationRow)
    .sort((left, right) => {
      if (left.isPast !== right.isPast) return left.isPast ? 1 : -1;
      const leftDate = left.sessionStartDate ? new Date(left.sessionStartDate).getTime() : 0;
      const rightDate = right.sessionStartDate ? new Date(right.sessionStartDate).getTime() : 0;
      return rightDate - leftDate;
    });
}
