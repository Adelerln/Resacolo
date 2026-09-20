import 'server-only';

import type { SupabaseClient } from '@supabase/supabase-js';
import { computeOrderClientBalance, isBalancePaymentPayload } from '@/lib/order-balance-payment';
import { normalizeOrderStatus } from '@/lib/order-workflow';
import {
  alertMissingPaymentReminderEmail,
  departureWindowIso,
  escapePaymentReminderHtml,
  resolveOrderClientEmail
} from '@/lib/payment-reminder-shared.server';
import { sendSmtpEmail } from '@/lib/rag/smtp';
import { SITE_URL } from '@/lib/seo';
import { formatEuroFromCents } from '@/types/checkout';
import type { Database } from '@/types/supabase';

export const BALANCE_REMINDER_DAYS_BEFORE_DEPARTURE = 30;

export type BalanceReminderCandidate = {
  orderId: string;
  email: string | null;
  familyName: string;
  stayTitle: string;
  stayTitles: string[];
  departureDate: string;
  remainingBalanceCents: number;
  accountUrl: string;
};

async function loadOrderCatalog(supabase: SupabaseClient<Database>, orderId: string) {
  const { data: items } = await supabase
    .from('order_items')
    .select('child_first_name, child_last_name, session_id')
    .eq('order_id', orderId);

  const sessionIds = Array.from(new Set((items ?? []).map((item) => item.session_id).filter(Boolean)));
  const { data: sessions } = sessionIds.length
    ? await supabase.from('sessions').select('id, start_date, stay_id').in('id', sessionIds)
    : { data: [] as Array<{ id: string; start_date: string; stay_id: string }> };

  const stayIds = Array.from(new Set((sessions ?? []).map((row) => row.stay_id).filter(Boolean)));
  const { data: stays } = stayIds.length
    ? await supabase.from('stays').select('id, title').in('id', stayIds)
    : { data: [] as Array<{ id: string; title: string }> };

  const stayById = new Map((stays ?? []).map((stay) => [stay.id, stay.title]));
  const stayTitles = Array.from(
    new Set(
      (sessions ?? [])
        .map((session) => stayById.get(session.stay_id))
        .filter((title): title is string => Boolean(title))
    )
  );
  const departureDates = (sessions ?? []).map((session) => session.start_date).sort();

  return {
    stayTitles,
    stayTitle: stayTitles[0] ?? 'Votre séjour Resacolo',
    departureDate: departureDates[0] ?? null,
    familyName:
      [items?.[0]?.child_first_name, items?.[0]?.child_last_name].filter(Boolean).join(' ').trim() ||
      'Famille'
  };
}

export async function listBalanceReminderCandidates(
  supabase: SupabaseClient<Database>,
  options?: { limit?: number; now?: Date }
): Promise<BalanceReminderCandidate[]> {
  const limit = Math.min(Math.max(options?.limit ?? 200, 1), 500);
  const { startDate, endDate } = departureWindowIso(BALANCE_REMINDER_DAYS_BEFORE_DEPARTURE, options?.now);

  const { data: sessions, error: sessionsError } = await supabase
    .from('sessions')
    .select('id, start_date, stay_id')
    .gte('start_date', startDate)
    .lt('start_date', endDate);

  if (sessionsError) {
    throw new Error(sessionsError.message);
  }

  const sessionIds = (sessions ?? []).map((session) => session.id);
  if (sessionIds.length === 0) return [];

  const { data: orderItems, error: itemsError } = await supabase
    .from('order_items')
    .select('order_id, session_id')
    .in('session_id', sessionIds);

  if (itemsError) {
    throw new Error(itemsError.message);
  }

  const orderIds = Array.from(new Set((orderItems ?? []).map((item) => item.order_id)));
  if (orderIds.length === 0) return [];

  const { data: orders, error: ordersError } = await supabase
    .from('orders')
    .select('id, client_user_id, status, request_kind, balance_reminder_sent_at')
    .in('id', orderIds)
    .in('status', ['PARTIALLY_PAID', 'PENDING_PAYMENT', 'VALIDATED', 'BOOKED', 'PAID', 'CONFIRMED'])
    .is('balance_reminder_sent_at', null)
    .limit(limit);

  if (ordersError) {
    throw new Error(ordersError.message);
  }

  const candidates: BalanceReminderCandidate[] = [];

  for (const order of orders ?? []) {
    const normalized = normalizeOrderStatus(order.status);
    // Relance solde = après acompte / paiement partiel uniquement (pas 1er paiement).
    if (normalized === 'PENDING_PAYMENT' || normalized === 'REQUESTED') {
      continue;
    }
    if (normalized === 'PAID' || normalized === 'CANCELLED' || normalized === 'CART') {
      // PAID avec remaining>0 sera écarté plus bas ; CANCELLED/CART exclus.
      if (normalized !== 'PAID') continue;
    }

    let balance;
    try {
      balance = await computeOrderClientBalance(order.id);
    } catch {
      continue;
    }
    if (balance.remainingBalanceCents <= 0) continue;

    const { data: succeededPayments } = await supabase
      .from('payments')
      .select('id')
      .eq('order_id', order.id)
      .eq('status', 'SUCCEEDED')
      .limit(1);
    const hasOnlinePaid = (succeededPayments ?? []).length > 0;
    const hasExternalPaid = (balance.order.external_paid_cents ?? 0) > 0;
    if (!hasOnlinePaid && !hasExternalPaid && normalized !== 'PARTIALLY_PAID') {
      continue;
    }

    const catalog = await loadOrderCatalog(supabase, order.id);
    if (!catalog.departureDate) continue;
    if (catalog.departureDate < startDate || catalog.departureDate >= endDate) continue;

    const email = await resolveOrderClientEmail(supabase, order.id, order.client_user_id);

    candidates.push({
      orderId: order.id,
      email,
      familyName: catalog.familyName,
      stayTitle: catalog.stayTitle,
      stayTitles: catalog.stayTitles,
      departureDate: catalog.departureDate,
      remainingBalanceCents: balance.remainingBalanceCents,
      accountUrl: `${SITE_URL}/mon-compte/reservations/${order.id}/paiement`
    });
  }

  return candidates;
}

function buildBalanceReminderEmail(candidate: BalanceReminderCandidate) {
  const amountLabel = formatEuroFromCents(candidate.remainingBalanceCents);
  const staysLabel = candidate.stayTitles.join(', ') || candidate.stayTitle;
  const subject = `[Resacolo] Il reste un solde à régler avant votre départ — ${candidate.stayTitle}`;
  const text = [
    `Bonjour,`,
    '',
    `Votre départ approche (${candidate.departureDate}).`,
    `Un solde reste à régler pour : ${staysLabel}.`,
    `Montant restant : ${amountLabel}.`,
    '',
    `Réglez votre solde depuis votre espace :`,
    candidate.accountUrl,
    '',
    `— L’équipe Resacolo`
  ].join('\n');

  const html = `<!DOCTYPE html>
<html lang="fr">
<body style="margin:0;padding:0;background:#f8fafc;font-family:Arial,Helvetica,sans-serif;color:#1e293b;">
  <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:#f8fafc;padding:24px 12px;">
    <tr><td align="center">
      <table role="presentation" width="100%" style="max-width:560px;background:#ffffff;border-radius:12px;border:1px solid #e2e8f0;overflow:hidden;">
        <tr><td style="height:4px;background:#37B5F5;"></td></tr>
        <tr><td style="padding:28px;">
          <p style="margin:0 0 8px;font-size:12px;font-weight:700;letter-spacing:0.06em;text-transform:uppercase;color:#37B5F5;">Resacolo</p>
          <h1 style="margin:0 0 12px;font-size:20px;line-height:1.3;">Il reste un solde à régler avant votre départ</h1>
          <p style="margin:0 0 12px;font-size:14px;line-height:1.6;">Séjour(s) : <strong>${escapePaymentReminderHtml(staysLabel)}</strong></p>
          <p style="margin:0 0 8px;font-size:14px;"><strong>Départ :</strong> ${escapePaymentReminderHtml(candidate.departureDate)}</p>
          <p style="margin:0 0 16px;font-size:14px;"><strong>Solde restant :</strong> ${escapePaymentReminderHtml(amountLabel)}</p>
          <a href="${escapePaymentReminderHtml(candidate.accountUrl)}" style="display:inline-block;padding:12px 20px;background:#37B5F5;color:#ffffff;text-decoration:none;border-radius:8px;font-size:14px;font-weight:600;">Régler mon solde</a>
        </td></tr>
      </table>
    </td></tr>
  </table>
</body>
</html>`;

  return { subject, text, html };
}

export async function sendBalanceReminder(
  supabase: SupabaseClient<Database>,
  candidate: BalanceReminderCandidate,
  options?: { toOverride?: string | null }
): Promise<{ sent: boolean; skipped?: string; email?: string }> {
  const balance = await computeOrderClientBalance(candidate.orderId);
  if (balance.order.status === 'CANCELLED' || balance.order.status === 'CART') {
    return { sent: false, skipped: 'cancelled_or_cart' };
  }
  if (balance.order.status === 'PAID' || balance.remainingBalanceCents <= 0) {
    return { sent: false, skipped: 'already_paid' };
  }
  const normalized = normalizeOrderStatus(balance.order.status);
  if (normalized === 'PENDING_PAYMENT' || normalized === 'REQUESTED') {
    return { sent: false, skipped: 'status_changed' };
  }
  if (normalized !== 'PARTIALLY_PAID' && normalized !== 'PAID' && normalized !== 'VALIDATED' && normalized !== 'BOOKED' && normalized !== 'CONFIRMED') {
    return { sent: false, skipped: 'status_changed' };
  }

  const { data: pendingBalancePayments } = await supabase
    .from('payments')
    .select('id, status, raw_payload, updated_at')
    .eq('order_id', candidate.orderId)
    .eq('status', 'PENDING')
    .order('updated_at', { ascending: false })
    .limit(5);

  const recentPendingBalance = (pendingBalancePayments ?? []).some((payment) => {
    if (!isBalancePaymentPayload(payment.raw_payload)) return false;
    const updatedAt = Date.parse(payment.updated_at);
    if (!Number.isFinite(updatedAt)) return true;
    return Date.now() - updatedAt < 2 * 60 * 60 * 1000;
  });
  if (recentPendingBalance) {
    return { sent: false, skipped: 'balance_payment_pending' };
  }

  const email = (options?.toOverride?.trim().toLowerCase() || candidate.email || '').trim();
  if (!email || !email.includes('@')) {
    await alertMissingPaymentReminderEmail({
      supabase,
      orderId: candidate.orderId,
      kind: 'balance',
      stayTitle: candidate.stayTitle,
      departureDate: candidate.departureDate
    });
    return { sent: false, skipped: 'missing_email' };
  }

  const mail = buildBalanceReminderEmail({ ...candidate, email });
  await sendSmtpEmail({ to: email, subject: mail.subject, text: mail.text, html: mail.html });

  const now = new Date().toISOString();
  const { error } = await supabase
    .from('orders')
    .update({ balance_reminder_sent_at: now, updated_at: now })
    .eq('id', candidate.orderId)
    .is('balance_reminder_sent_at', null);

  if (error) {
    throw new Error(error.message);
  }

  return { sent: true, email };
}
