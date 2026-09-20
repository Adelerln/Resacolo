import 'server-only';

import type { SupabaseClient } from '@supabase/supabase-js';
import { sendSmtpEmail } from '@/lib/rag/smtp';
import { SITE_URL } from '@/lib/seo';
import type { Database, Json } from '@/types/supabase';

const DEFAULT_ALERT_EMAILS = ['jeanne@thalie.org', 'adele.rolin@gmail.com'] as const;

export type PaymentReminderKind = 'deposit' | 'balance';

function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === 'object' && !Array.isArray(value);
}

function asString(value: unknown) {
  if (typeof value !== 'string') return null;
  const trimmed = value.trim();
  return trimmed.length > 0 ? trimmed : null;
}

export function escapePaymentReminderHtml(value: string) {
  return value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

export function extractEmailFromPaymentPayload(rawPayload: Json | null | undefined): string | null {
  if (!isRecord(rawPayload)) return null;
  const contact = rawPayload.contact;
  if (!isRecord(contact)) return null;
  const email = asString(contact.email)?.toLowerCase() ?? null;
  if (!email || !email.includes('@') || email.endsWith('@resacolo.local')) return null;
  return email;
}

export async function resolveOrderClientEmail(
  supabase: SupabaseClient<Database>,
  orderId: string,
  clientUserId: string
): Promise<string | null> {
  const { data: profile } = await supabase
    .from('client_profiles')
    .select('parent1_email')
    .eq('user_id', clientUserId)
    .maybeSingle();

  const profileEmail = asString(profile?.parent1_email)?.toLowerCase() ?? null;
  if (profileEmail && profileEmail.includes('@')) {
    return profileEmail;
  }

  const { data: payments } = await supabase
    .from('payments')
    .select('raw_payload')
    .eq('order_id', orderId)
    .order('updated_at', { ascending: false })
    .limit(5);

  for (const payment of payments ?? []) {
    const email = extractEmailFromPaymentPayload(payment.raw_payload);
    if (email) return email;
  }

  return null;
}

export async function alertMissingPaymentReminderEmail(input: {
  supabase: SupabaseClient<Database>;
  orderId: string;
  kind: PaymentReminderKind;
  stayTitle?: string | null;
  departureDate?: string | null;
}): Promise<{ alerted: boolean; reason?: string }> {
  const { data: order, error } = await input.supabase
    .from('orders')
    .select('id, payment_reminder_missing_email_alerted_at')
    .eq('id', input.orderId)
    .maybeSingle();

  if (error) {
    return { alerted: false, reason: error.message };
  }
  if (!order) {
    return { alerted: false, reason: 'order_not_found' };
  }
  if (order.payment_reminder_missing_email_alerted_at) {
    return { alerted: false, reason: 'already_alerted' };
  }

  const kindLabel = input.kind === 'deposit' ? 'acompte J+7' : 'solde J-30';
  const subject = `[Resacolo] Alerte : email client introuvable (relance ${kindLabel})`;
  const text = [
    `Impossible d’envoyer la relance ${kindLabel} : aucun e-mail client fiable.`,
    '',
    `Commande : ${input.orderId}`,
    input.stayTitle ? `Séjour : ${input.stayTitle}` : null,
    input.departureDate ? `Départ : ${input.departureDate}` : null,
    '',
    `Ouvrir Mnemos : ${SITE_URL}/mnemos/payment-reminder-alerts`
  ]
    .filter(Boolean)
    .join('\n');

  let sent = 0;
  for (const to of DEFAULT_ALERT_EMAILS) {
    try {
      await sendSmtpEmail({ to, subject, text });
      sent += 1;
    } catch (sendError) {
      console.error('[payment-reminder-alert] send failed', {
        to,
        orderId: input.orderId,
        error: sendError instanceof Error ? sendError.message : String(sendError)
      });
    }
  }

  const now = new Date().toISOString();
  await input.supabase
    .from('orders')
    .update({
      payment_reminder_missing_email_alerted_at: now,
      updated_at: now
    })
    .eq('id', input.orderId)
    .is('payment_reminder_missing_email_alerted_at', null);

  return { alerted: sent > 0 };
}

export function startOfUtcDay(date: Date) {
  return new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate()));
}

export function utcDayWindow(daysAgo: number, from: Date = new Date()) {
  const end = startOfUtcDay(from);
  end.setUTCDate(end.getUTCDate() - daysAgo);
  const start = new Date(end);
  start.setUTCDate(start.getUTCDate() - 1);
  return { startIso: start.toISOString(), endIso: end.toISOString() };
}

export function departureWindowIso(daysBefore: number, from: Date = new Date()) {
  const start = startOfUtcDay(from);
  start.setUTCDate(start.getUTCDate() + daysBefore);
  const end = new Date(start);
  end.setUTCDate(end.getUTCDate() + 1);
  return {
    startDate: start.toISOString().slice(0, 10),
    endDate: end.toISOString().slice(0, 10)
  };
}
