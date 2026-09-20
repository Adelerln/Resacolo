import 'server-only';

import type { SupabaseClient } from '@supabase/supabase-js';
import { sendSmtpEmail } from '@/lib/rag/smtp';
import { SITE_URL } from '@/lib/seo';
import { formatEuroFromCents } from '@/types/checkout';
import type { Database, Json } from '@/types/supabase';

export const CART_ABANDONMENT_REMINDER_MIN_AGE_MS = 24 * 60 * 60 * 1000;
export const CART_ABANDONMENT_REMINDER_MAX_AGE_MS = 14 * 24 * 60 * 60 * 1000;

export type CartAbandonmentReminderCandidate = {
  checkoutId: string;
  email: string;
  familyName: string;
  stayTitle: string;
  sessionLabel: string;
  organizerName: string;
  amountLabel: string;
  cartUrl: string;
  itemCount: number;
  referenceAt: string;
};

function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === 'object' && !Array.isArray(value);
}

function asString(value: unknown) {
  if (typeof value !== 'string') return null;
  const trimmed = value.trim();
  return trimmed.length > 0 ? trimmed : null;
}

function escapeHtml(value: string) {
  return value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

function parseContact(snapshot: Json | null) {
  if (!isRecord(snapshot)) return null;
  const email = asString(snapshot.email)?.toLowerCase() ?? null;
  if (!email || !email.includes('@')) return null;
  const firstName = asString(snapshot.billingFirstName) ?? '';
  const lastName = asString(snapshot.billingLastName) ?? '';
  const familyName = `${firstName} ${lastName}`.trim() || email;
  return { email, familyName };
}

function parseItems(snapshot: Json): Record<string, unknown>[] {
  if (!Array.isArray(snapshot)) return [];
  const items: Record<string, unknown>[] = [];
  for (const entry of snapshot) {
    if (isRecord(entry)) items.push(entry);
  }
  return items;
}

function earliestItemAddedAt(items: Record<string, unknown>[]) {
  let earliest: string | null = null;
  for (const item of items) {
    const addedAt = asString(item.addedAt);
    if (!addedAt) continue;
    const ts = Date.parse(addedAt);
    if (Number.isNaN(ts)) continue;
    if (!earliest || ts < Date.parse(earliest)) {
      earliest = addedAt;
    }
  }
  return earliest;
}

function formatAmountFromPricing(snapshot: Json | null) {
  if (!isRecord(snapshot)) return null;
  const total =
    typeof snapshot.totalPriceCents === 'number'
      ? snapshot.totalPriceCents
      : typeof snapshot.familyPayableCents === 'number'
        ? snapshot.familyPayableCents
        : null;
  if (total == null || !Number.isFinite(total)) return null;
  return formatEuroFromCents(total);
}

function formatAmountFromItem(item: Record<string, unknown>) {
  const unitPrice = item.unitPrice;
  if (typeof unitPrice === 'number' && Number.isFinite(unitPrice)) {
    // unitPrice panier = euros (pas centimes)
    return `${unitPrice.toLocaleString('fr-FR', { minimumFractionDigits: 0, maximumFractionDigits: 2 })} €`;
  }
  return null;
}

function buildSessionLabel(item: Record<string, unknown>) {
  const labels = isRecord(item.selectionLabels) ? item.selectionLabels : null;
  return (
    asString(labels?.sessionLine) ||
    asString(item.duration) ||
    asString(item.location) ||
    'Dates à confirmer'
  );
}

function buildCartUrl(checkoutId: string) {
  return `${SITE_URL}/panier?checkout=${encodeURIComponent(checkoutId)}`;
}

export function isEligibleAbandonmentAge(referenceAt: string, now = new Date()) {
  const ts = Date.parse(referenceAt);
  if (Number.isNaN(ts)) return false;
  const age = now.getTime() - ts;
  return age >= CART_ABANDONMENT_REMINDER_MIN_AGE_MS && age <= CART_ABANDONMENT_REMINDER_MAX_AGE_MS;
}

export function mapCheckoutCartToReminderCandidate(row: {
  id: string;
  created_at: string;
  contact_snapshot: Json | null;
  items_snapshot: Json;
  pricing_snapshot: Json | null;
}): CartAbandonmentReminderCandidate | null {
  const contact = parseContact(row.contact_snapshot);
  if (!contact) return null;

  const items = parseItems(row.items_snapshot);
  if (items.length === 0) return null;

  const referenceAt = earliestItemAddedAt(items) ?? row.created_at;
  if (!isEligibleAbandonmentAge(referenceAt)) return null;

  const first = items[0]!;
  const stayTitle = asString(first.title) || 'Séjour Resacolo';
  const organizerName = asString(first.organizerName) || 'Organisateur Resacolo';
  const sessionLabel = buildSessionLabel(first);
  const amountLabel =
    formatAmountFromPricing(row.pricing_snapshot) ||
    formatAmountFromItem(first) ||
    'Montant à confirmer';

  const extraCount = items.length - 1;
  const stayTitleDisplay =
    extraCount > 0 ? `${stayTitle} (+${extraCount} autre${extraCount > 1 ? 's' : ''})` : stayTitle;

  return {
    checkoutId: row.id,
    email: contact.email,
    familyName: contact.familyName,
    stayTitle: stayTitleDisplay,
    sessionLabel,
    organizerName,
    amountLabel,
    cartUrl: buildCartUrl(row.id),
    itemCount: items.length,
    referenceAt
  };
}

export async function listCartAbandonmentReminderCandidates(
  supabase: SupabaseClient<Database>,
  options?: { limit?: number; now?: Date }
) {
  const limit = options?.limit ?? 200;
  const now = options?.now ?? new Date();
  const minCreatedAt = new Date(now.getTime() - CART_ABANDONMENT_REMINDER_MAX_AGE_MS).toISOString();

  const { data, error } = await supabase
    .from('checkout_carts')
    .select('id, created_at, contact_snapshot, items_snapshot, pricing_snapshot, status, abandonment_reminder_sent_at')
    .eq('status', 'ACTIVE')
    .is('abandonment_reminder_sent_at', null)
    .gte('created_at', minCreatedAt)
    .order('created_at', { ascending: true })
    .limit(limit);

  if (error) {
    throw new Error(error.message);
  }

  const candidates: CartAbandonmentReminderCandidate[] = [];
  for (const row of data ?? []) {
    const mapped = mapCheckoutCartToReminderCandidate(row);
    if (mapped && isEligibleAbandonmentAge(mapped.referenceAt, now)) {
      candidates.push(mapped);
    }
  }
  return candidates;
}

export function buildCartAbandonmentReminderSubject(stayTitle: string) {
  const shortTitle = stayTitle.length > 60 ? `${stayTitle.slice(0, 57)}…` : stayTitle;
  return `[Resacolo] Votre séjour vous attend encore dans le panier — ${shortTitle}`;
}

export function renderCartAbandonmentReminderText(candidate: CartAbandonmentReminderCandidate) {
  return [
    `Bonjour ${candidate.familyName},`,
    '',
    'Hier vous avez ajouté un séjour dans votre panier Resacolo. Il y est toujours : vous pouvez finaliser votre réservation en quelques minutes.',
    '',
    `Séjour : ${candidate.stayTitle}`,
    `Dates : ${candidate.sessionLabel}`,
    `Organisateur : ${candidate.organizerName}`,
    `Montant indicatif : ${candidate.amountLabel}`,
    '',
    `Reprendre mon panier : ${candidate.cartUrl}`,
    '',
    'Si vous avez changé d’avis, vous pouvez ignorer ce message : aucun paiement n’a été lancé.',
    '',
    '— Resacolo'
  ].join('\n');
}

export function renderCartAbandonmentReminderHtml(candidate: CartAbandonmentReminderCandidate) {
  return `<!DOCTYPE html>
<html lang="fr">
<body style="margin:0;padding:0;background-color:#f8f8f8;font-family:'Raleway',Arial,Helvetica,sans-serif;color:#1d1f25;">
  <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="background-color:#f8f8f8;">
    <tr>
      <td align="center" style="padding:40px 16px;">
        <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="max-width:600px;background-color:#ffffff;border-radius:16px;overflow:hidden;">
          <tr><td style="height:4px;background-color:#52b0ea;font-size:0;line-height:0;">&nbsp;</td></tr>
          <tr>
            <td align="center" style="padding:28px 32px 8px;">
              <img src="https://ypesoxqzrodukhjgwfkg.supabase.co/storage/v1/object/public/brand-assets/email/logo-resacolo.png" alt="Resacolo" width="160" height="42" style="display:block;width:160px;max-width:100%;height:auto;border:0;" />
            </td>
          </tr>
          <tr>
            <td style="padding:16px 40px 8px;">
              <p style="margin:0 0 4px;font-size:13px;font-weight:600;letter-spacing:0.04em;text-transform:uppercase;color:#f48200;">Panier en attente</p>
              <h1 style="margin:0 0 12px;font-size:22px;font-weight:700;line-height:1.3;color:#1d1f25;">Votre séjour vous attend encore</h1>
              <p style="margin:0;font-size:15px;line-height:1.6;color:#64748b;">
                Bonjour <strong>${escapeHtml(candidate.familyName)}</strong>, hier vous avez ajouté un séjour dans votre panier Resacolo.
                Il y est toujours : vous pouvez finaliser votre réservation en quelques minutes.
              </p>
            </td>
          </tr>
          <tr>
            <td style="padding:16px 40px 8px;">
              <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="background:#f8fafc;border:1px solid #e2e8f0;border-radius:12px;">
                <tr>
                  <td style="padding:16px;">
                    <p style="margin:0 0 8px;font-size:12px;font-weight:700;letter-spacing:0.04em;text-transform:uppercase;color:#94a3b8;">Dans votre panier</p>
                    <p style="margin:0 0 4px;font-size:16px;font-weight:700;color:#1d1f25;">${escapeHtml(candidate.stayTitle)}</p>
                    <p style="margin:0 0 4px;font-size:14px;color:#64748b;">${escapeHtml(candidate.sessionLabel)}</p>
                    <p style="margin:0 0 4px;font-size:14px;color:#1d1f25;"><strong>Organisateur :</strong> ${escapeHtml(candidate.organizerName)}</p>
                    <p style="margin:0;font-size:14px;color:#1d1f25;"><strong>Montant indicatif :</strong> ${escapeHtml(candidate.amountLabel)}</p>
                  </td>
                </tr>
              </table>
            </td>
          </tr>
          <tr>
            <td style="padding:12px 40px 8px;">
              <p style="margin:0 0 10px;font-size:15px;font-weight:700;color:#1d1f25;">Pourquoi finaliser maintenant&nbsp;?</p>
              <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0">
                <tr>
                  <td style="padding:10px 14px;border:1px solid #bfdbfe;background:#eff6ff;border-radius:10px;">
                    <p style="margin:0;font-size:13px;line-height:1.55;color:#1e40af;">Les places partent vite : tant que la réservation n’est pas confirmée, le séjour n’est pas garanti.</p>
                  </td>
                </tr>
                <tr><td style="height:10px;font-size:0;line-height:0;">&nbsp;</td></tr>
                <tr>
                  <td style="padding:10px 14px;border:1px solid #bfdbfe;background:#eff6ff;border-radius:10px;">
                    <p style="margin:0;font-size:13px;line-height:1.55;color:#1e40af;">Vos informations sont déjà enregistrées : il ne reste qu’à reprendre le parcours et confirmer.</p>
                  </td>
                </tr>
                <tr><td style="height:10px;font-size:0;line-height:0;">&nbsp;</td></tr>
                <tr>
                  <td style="padding:10px 14px;border:1px solid #bfdbfe;background:#eff6ff;border-radius:10px;">
                    <p style="margin:0;font-size:13px;line-height:1.55;color:#1e40af;">Si vous avez changé d’avis, vous pouvez simplement ignorer ce message : aucun paiement n’a été lancé.</p>
                  </td>
                </tr>
              </table>
            </td>
          </tr>
          <tr>
            <td align="center" style="padding:16px 40px 32px;">
              <table role="presentation" cellpadding="0" cellspacing="0" border="0">
                <tr>
                  <td align="center" bgcolor="#f48200" style="border-radius:8px;background-color:#f48200;">
                    <a href="${escapeHtml(candidate.cartUrl)}" target="_blank" style="display:inline-block;padding:14px 28px;font-size:15px;font-weight:600;color:#ffffff;text-decoration:none;border-radius:8px;">
                      Reprendre mon panier
                    </a>
                  </td>
                </tr>
              </table>
              <p style="margin:14px 0 0;font-size:13px;line-height:1.5;color:#94a3b8;">
                Ou ouvrez directement <a href="${escapeHtml(`${SITE_URL}/panier`)}" style="color:#52b0ea;text-decoration:none;">${escapeHtml(`${SITE_URL.replace(/^https?:\/\//, '')}/panier`)}</a>
              </p>
            </td>
          </tr>
          <tr>
            <td style="padding:20px 40px 28px;background-color:#f8fafc;border-top:1px solid #e2e8f0;">
              <p style="margin:0;font-size:12px;line-height:1.5;color:#94a3b8;text-align:center;">
                Message automatique Resacolo · envoyé uniquement si le séjour est encore dans votre panier ·
                <a href="${escapeHtml(SITE_URL)}" style="color:#52b0ea;text-decoration:none;">resacolo.com</a>
              </p>
            </td>
          </tr>
        </table>
      </td>
    </tr>
  </table>
</body>
</html>`;
}

export async function markCartAbandonmentReminderSent(
  supabase: SupabaseClient<Database>,
  checkoutId: string
) {
  const now = new Date().toISOString();
  const { error } = await supabase
    .from('checkout_carts')
    .update({ abandonment_reminder_sent_at: now, updated_at: now })
    .eq('id', checkoutId)
    .eq('status', 'ACTIVE')
    .is('abandonment_reminder_sent_at', null);

  if (error) {
    throw new Error(error.message);
  }
}

export async function sendCartAbandonmentReminder(input: {
  supabase: SupabaseClient<Database>;
  candidate: CartAbandonmentReminderCandidate;
  toOverride?: string | null;
}) {
  const { data: fresh, error } = await input.supabase
    .from('checkout_carts')
    .select('id, status, abandonment_reminder_sent_at, contact_snapshot, items_snapshot')
    .eq('id', input.candidate.checkoutId)
    .maybeSingle();

  if (error) {
    throw new Error(error.message);
  }
  if (!fresh || fresh.status !== 'ACTIVE' || fresh.abandonment_reminder_sent_at) {
    return { skipped: true as const, reason: 'cart-no-longer-eligible' };
  }
  if (parseItems(fresh.items_snapshot).length === 0 || !parseContact(fresh.contact_snapshot)) {
    return { skipped: true as const, reason: 'cart-empty-or-no-email' };
  }

  const to = (input.toOverride?.trim().toLowerCase() || input.candidate.email).trim();
  const subject = buildCartAbandonmentReminderSubject(input.candidate.stayTitle);
  const text = renderCartAbandonmentReminderText(input.candidate);
  const html = renderCartAbandonmentReminderHtml(input.candidate);

  await sendSmtpEmail({ to, subject, text, html });
  await markCartAbandonmentReminderSent(input.supabase, input.candidate.checkoutId);

  return { skipped: false as const, to, subject };
}
