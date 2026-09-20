import 'server-only';

import type { SupabaseClient } from '@supabase/supabase-js';
import { computeOrderClientBalance } from '@/lib/order-balance-payment';
import { normalizeOrderStatus } from '@/lib/order-workflow';
import {
  alertMissingPaymentReminderEmail,
  escapePaymentReminderHtml,
  resolveOrderClientEmail,
  utcDayWindow
} from '@/lib/payment-reminder-shared.server';
import { sendSmtpEmail } from '@/lib/rag/smtp';
import { SITE_URL } from '@/lib/seo';
import { formatEuroFromCents } from '@/types/checkout';
import type { Database } from '@/types/supabase';

export const DEPOSIT_REMINDER_DAYS_AFTER_ORDER = 7;

export type DepositReminderCandidate = {
  orderId: string;
  email: string | null;
  familyName: string;
  stayTitle: string;
  departureDate: string | null;
  remainingBalanceCents: number;
  accountUrl: string;
  createdAt: string;
};

async function loadOrderStaySummary(supabase: SupabaseClient<Database>, orderId: string) {
  const { data: items } = await supabase
    .from('order_items')
    .select('child_first_name, child_last_name, session_id')
    .eq('order_id', orderId)
    .limit(5);

  const sessionIds = Array.from(new Set((items ?? []).map((item) => item.session_id).filter(Boolean)));
  const { data: sessions } = sessionIds.length
    ? await supabase.from('sessions').select('id, start_date, stay_id').in('id', sessionIds)
    : { data: [] as Array<{ id: string; start_date: string; stay_id: string }> };

  const stayIds = Array.from(new Set((sessions ?? []).map((row) => row.stay_id).filter(Boolean)));
  const { data: stays } = stayIds.length
    ? await supabase.from('stays').select('id, title').in('id', stayIds)
    : { data: [] as Array<{ id: string; title: string }> };

  const stayById = new Map((stays ?? []).map((stay) => [stay.id, stay.title]));
  const stayTitles = (sessions ?? [])
    .map((session) => stayById.get(session.stay_id))
    .filter((title): title is string => Boolean(title));
  const departureDates = (sessions ?? []).map((session) => session.start_date).sort();

  return {
    stayTitle: stayTitles[0] ?? 'Votre séjour Resacolo',
    departureDate: departureDates[0] ?? null,
    familyName:
      [items?.[0]?.child_first_name, items?.[0]?.child_last_name].filter(Boolean).join(' ').trim() ||
      'Famille'
  };
}

export async function listDepositReminderCandidates(
  supabase: SupabaseClient<Database>,
  options?: { limit?: number; now?: Date }
): Promise<DepositReminderCandidate[]> {
  const limit = Math.min(Math.max(options?.limit ?? 200, 1), 500);
  const { startIso, endIso } = utcDayWindow(DEPOSIT_REMINDER_DAYS_AFTER_ORDER, options?.now);

  const { data: orders, error } = await supabase
    .from('orders')
    .select('id, client_user_id, status, request_kind, created_at, deposit_reminder_sent_at')
    .in('status', ['PENDING_PAYMENT', 'VALIDATED', 'BOOKED'])
    .is('deposit_reminder_sent_at', null)
    .gte('created_at', startIso)
    .lt('created_at', endIso)
    .order('created_at', { ascending: true })
    .limit(limit);

  if (error) {
    throw new Error(error.message);
  }

  const candidates: DepositReminderCandidate[] = [];

  for (const order of orders ?? []) {
    if (normalizeOrderStatus(order.status) !== 'PENDING_PAYMENT') {
      continue;
    }
    if (order.request_kind === 'VACAF' || order.request_kind === 'ANCV_CONNECT') {
      continue;
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

    if ((succeededPayments ?? []).length > 0) continue;

    const summary = await loadOrderStaySummary(supabase, order.id);
    const email = await resolveOrderClientEmail(supabase, order.id, order.client_user_id);

    candidates.push({
      orderId: order.id,
      email,
      familyName: summary.familyName,
      stayTitle: summary.stayTitle,
      departureDate: summary.departureDate,
      remainingBalanceCents: balance.remainingBalanceCents,
      accountUrl: `${SITE_URL}/mon-compte/reservations/${order.id}`,
      createdAt: order.created_at
    });
  }

  return candidates;
}

function buildDepositReminderEmail(candidate: DepositReminderCandidate) {
  const amountLabel = formatEuroFromCents(candidate.remainingBalanceCents);
  const subject = `[Resacolo] Finalisez le paiement de votre réservation — ${candidate.stayTitle}`;
  const text = [
    `Bonjour,`,
    '',
    `Votre réservation « ${candidate.stayTitle} » est toujours en attente de paiement.`,
    `Montant restant : ${amountLabel}.`,
    candidate.departureDate ? `Date de départ : ${candidate.departureDate}.` : null,
    '',
    `Connectez-vous à votre espace pour finaliser le règlement :`,
    candidate.accountUrl,
    '',
    `— L’équipe Resacolo`
  ]
    .filter(Boolean)
    .join('\n');

  const html = `<!DOCTYPE html>
<html lang="fr">
<body style="margin:0;padding:0;background:#f8fafc;font-family:Arial,Helvetica,sans-serif;color:#1e293b;">
  <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:#f8fafc;padding:24px 12px;">
    <tr><td align="center">
      <table role="presentation" width="100%" style="max-width:560px;background:#ffffff;border-radius:12px;border:1px solid #e2e8f0;overflow:hidden;">
        <tr><td style="height:4px;background:#FA8500;"></td></tr>
        <tr><td style="padding:28px;">
          <p style="margin:0 0 8px;font-size:12px;font-weight:700;letter-spacing:0.06em;text-transform:uppercase;color:#FA8500;">Resacolo</p>
          <h1 style="margin:0 0 12px;font-size:20px;line-height:1.3;">Finalisez le paiement de votre réservation</h1>
          <p style="margin:0 0 12px;font-size:14px;line-height:1.6;">Votre séjour <strong>${escapePaymentReminderHtml(candidate.stayTitle)}</strong> est toujours en attente de règlement.</p>
          <p style="margin:0 0 8px;font-size:14px;"><strong>Montant restant :</strong> ${escapePaymentReminderHtml(amountLabel)}</p>
          ${
            candidate.departureDate
              ? `<p style="margin:0 0 16px;font-size:14px;"><strong>Départ :</strong> ${escapePaymentReminderHtml(candidate.departureDate)}</p>`
              : ''
          }
          <a href="${escapePaymentReminderHtml(candidate.accountUrl)}" style="display:inline-block;padding:12px 20px;background:#FA8500;color:#ffffff;text-decoration:none;border-radius:8px;font-size:14px;font-weight:600;">Payer maintenant</a>
        </td></tr>
      </table>
    </td></tr>
  </table>
</body>
</html>`;

  return { subject, text, html };
}

export async function sendDepositReminder(
  supabase: SupabaseClient<Database>,
  candidate: DepositReminderCandidate,
  options?: { toOverride?: string | null }
): Promise<{ sent: boolean; skipped?: string; email?: string }> {
  const balance = await computeOrderClientBalance(candidate.orderId);
  if (balance.order.status === 'CANCELLED' || balance.order.status === 'FAILED' || balance.order.status === 'CART') {
    return { sent: false, skipped: 'cancelled_or_cart' };
  }
  if (normalizeOrderStatus(balance.order.status) !== 'PENDING_PAYMENT') {
    return { sent: false, skipped: 'status_changed' };
  }
  if (balance.remainingBalanceCents <= 0) {
    return { sent: false, skipped: 'already_paid' };
  }

  const { data: succeededPayments } = await supabase
    .from('payments')
    .select('id')
    .eq('order_id', candidate.orderId)
    .eq('status', 'SUCCEEDED')
    .limit(1);
  if ((succeededPayments ?? []).length > 0) {
    return { sent: false, skipped: 'payment_succeeded' };
  }

  const email = (options?.toOverride?.trim().toLowerCase() || candidate.email || '').trim();
  if (!email || !email.includes('@')) {
    await alertMissingPaymentReminderEmail({
      supabase,
      orderId: candidate.orderId,
      kind: 'deposit',
      stayTitle: candidate.stayTitle,
      departureDate: candidate.departureDate
    });
    return { sent: false, skipped: 'missing_email' };
  }

  const mail = buildDepositReminderEmail({ ...candidate, email });
  await sendSmtpEmail({ to: email, subject: mail.subject, text: mail.text, html: mail.html });

  const now = new Date().toISOString();
  const { error } = await supabase
    .from('orders')
    .update({ deposit_reminder_sent_at: now, updated_at: now })
    .eq('id', candidate.orderId)
    .is('deposit_reminder_sent_at', null);

  if (error) {
    throw new Error(error.message);
  }

  return { sent: true, email };
}
