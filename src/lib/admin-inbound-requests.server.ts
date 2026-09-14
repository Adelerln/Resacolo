import 'server-only';

import type { SupabaseClient } from '@supabase/supabase-js';
import { isMissingPublicTableError } from '@/lib/mnemos/supabase-table-missing';
import { sendSmtpEmail } from '@/lib/rag/smtp';
import { SITE_URL } from '@/lib/seo';
import type { Database, Json } from '@/types/supabase';

export const ADMIN_INBOUND_REQUEST_SETTINGS_ID = 'default';

export type AdminInboundRequestKind = 'PARTNER' | 'ORGANIZER';
export type AdminInboundRequestStatus = 'NEW' | 'IN_PROGRESS' | 'RESOLVED';

export type AdminInboundRequestSettings = {
  partnerNotificationEmail: string | null;
  organizerNotificationEmail: string | null;
  tableMissing: boolean;
};

export type CreateAdminInboundRequestInput = {
  kind: AdminInboundRequestKind;
  organizationName?: string | null;
  contactFirstName?: string | null;
  contactLastName?: string | null;
  contactEmail: string;
  contactPhone?: string | null;
  formula?: string | null;
  atoutFrance?: string | null;
  sdjes?: string | null;
  websiteUrl?: string | null;
  message: string;
  rawPayload?: Record<string, unknown>;
};

const DEFAULT_PARTNER_EMAIL = 'jeanne@thalie.org';
const DEFAULT_ORGANIZER_EMAIL = 'jeanne@thalie.org';

function normalizeEmail(value: string | null | undefined) {
  const email = String(value ?? '')
    .trim()
    .toLowerCase();
  if (!email || !email.includes('@')) return null;
  return email;
}

function escapeHtml(value: string) {
  return value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

export function parseSingleNotificationEmail(value: string) {
  return normalizeEmail(
    value
      .split(/[\n,;]+/)
      .map((part) => part.trim())
      .find(Boolean) ?? ''
  );
}

export async function readAdminInboundRequestSettings(
  supabase: SupabaseClient<Database>
): Promise<AdminInboundRequestSettings> {
  const { data, error } = await supabase
    .from('admin_inbound_request_settings')
    .select('partner_notification_email, organizer_notification_email')
    .eq('id', ADMIN_INBOUND_REQUEST_SETTINGS_ID)
    .maybeSingle();

  if (error) {
    if (isMissingPublicTableError(error)) {
      return {
        partnerNotificationEmail: DEFAULT_PARTNER_EMAIL,
        organizerNotificationEmail: DEFAULT_ORGANIZER_EMAIL,
        tableMissing: true
      };
    }
    throw new Error(error.message);
  }

  if (!data) {
    return {
      partnerNotificationEmail: DEFAULT_PARTNER_EMAIL,
      organizerNotificationEmail: DEFAULT_ORGANIZER_EMAIL,
      tableMissing: false
    };
  }

  return {
    partnerNotificationEmail: normalizeEmail(data.partner_notification_email) ?? DEFAULT_PARTNER_EMAIL,
    organizerNotificationEmail:
      normalizeEmail(data.organizer_notification_email) ?? DEFAULT_ORGANIZER_EMAIL,
    tableMissing: false
  };
}

export async function upsertAdminInboundRequestSettings(
  supabase: SupabaseClient<Database>,
  input: {
    partnerNotificationEmail: string | null;
    organizerNotificationEmail: string | null;
  }
) {
  const partnerNotificationEmail = normalizeEmail(input.partnerNotificationEmail);
  const organizerNotificationEmail = normalizeEmail(input.organizerNotificationEmail);

  if (!partnerNotificationEmail || !organizerNotificationEmail) {
    throw new Error('Indiquez une adresse e-mail valide pour chaque type de demande.');
  }

  const { error } = await supabase.from('admin_inbound_request_settings').upsert(
    {
      id: ADMIN_INBOUND_REQUEST_SETTINGS_ID,
      partner_notification_email: partnerNotificationEmail,
      organizer_notification_email: organizerNotificationEmail,
      updated_at: new Date().toISOString()
    },
    { onConflict: 'id' }
  );

  if (error) {
    if (isMissingPublicTableError(error)) {
      throw new Error(
        'Table admin_inbound_request_settings absente. Appliquez la migration 20260914_admin_inbound_requests.sql.'
      );
    }
    throw new Error(error.message);
  }

  return { partnerNotificationEmail, organizerNotificationEmail };
}

export async function createAdminInboundRequest(
  supabase: SupabaseClient<Database>,
  input: CreateAdminInboundRequestInput
) {
  const contactEmail = normalizeEmail(input.contactEmail);
  if (!contactEmail) {
    throw new Error('E-mail de contact invalide.');
  }

  const message = input.message.trim();
  if (!message) {
    throw new Error('Message requis.');
  }

  const { data, error } = await supabase
    .from('admin_inbound_requests')
    .insert({
      kind: input.kind,
      status: 'NEW',
      organization_name: input.organizationName?.trim() || null,
      contact_first_name: input.contactFirstName?.trim() || null,
      contact_last_name: input.contactLastName?.trim() || null,
      contact_email: contactEmail,
      contact_phone: input.contactPhone?.trim() || null,
      formula: input.formula?.trim() || null,
      atout_france: input.atoutFrance?.trim() || null,
      sdjes: input.sdjes?.trim() || null,
      website_url: input.websiteUrl?.trim() || null,
      message,
      raw_payload: (input.rawPayload ?? {}) as Json
    })
    .select('id')
    .single();

  if (error || !data) {
    if (isMissingPublicTableError(error)) {
      throw new Error(
        'Table admin_inbound_requests absente. Appliquez la migration 20260914_admin_inbound_requests.sql.'
      );
    }
    throw new Error(error?.message ?? 'Création de la demande impossible.');
  }

  return data.id as string;
}

export async function markAdminInboundRequestResolved(
  supabase: SupabaseClient<Database>,
  requestId: string
) {
  const now = new Date().toISOString();
  const { error } = await supabase
    .from('admin_inbound_requests')
    .update({
      status: 'RESOLVED',
      resolved_at: now,
      updated_at: now
    })
    .eq('id', requestId);

  if (error) {
    if (isMissingPublicTableError(error)) {
      throw new Error(
        'Table admin_inbound_requests absente. Appliquez la migration 20260914_admin_inbound_requests.sql.'
      );
    }
    throw new Error(error.message);
  }
}

export async function notifyAdminInboundRequest(input: {
  supabase: SupabaseClient<Database>;
  requestId: string;
  kind: AdminInboundRequestKind;
  organizationName?: string | null;
  contactName: string;
  contactEmail: string;
  contactPhone?: string | null;
  formula?: string | null;
  atoutFrance?: string | null;
  sdjes?: string | null;
  websiteUrl?: string | null;
  message: string;
}) {
  const settings = await readAdminInboundRequestSettings(input.supabase);
  const to =
    input.kind === 'PARTNER' ? settings.partnerNotificationEmail : settings.organizerNotificationEmail;

  if (!to) {
    return { sent: 0, failed: 0, skipped: true as const };
  }

  const kindLabel = input.kind === 'PARTNER' ? 'partenariat' : 'organisateur';
  const adminUrl = `${SITE_URL}/admin/demandes`;
  const subject = `[Resacolo] Nouvelle demande ${kindLabel} — ${input.contactName || input.contactEmail}`;
  const text = [
    `Une nouvelle demande ${kindLabel} a été reçue.`,
    '',
    input.organizationName?.trim() ? `Structure : ${input.organizationName.trim()}` : null,
    `Contact : ${input.contactName || '—'}`,
    `E-mail : ${input.contactEmail}`,
    input.contactPhone?.trim() ? `Téléphone : ${input.contactPhone.trim()}` : null,
    input.formula?.trim() ? `Formule : ${input.formula.trim()}` : null,
    input.atoutFrance?.trim() ? `Atout France : ${input.atoutFrance.trim()}` : null,
    input.sdjes?.trim() ? `SDJES : ${input.sdjes.trim()}` : null,
    input.websiteUrl?.trim() ? `Site : ${input.websiteUrl.trim()}` : null,
    '',
    'Message :',
    input.message,
    '',
    `Traiter dans l’admin : ${adminUrl}`
  ]
    .filter((line) => line !== null)
    .join('\n');

  const detailRows = [
    input.organizationName?.trim()
      ? `<p style="margin:0 0 6px;font-size:14px;"><strong>Structure :</strong> ${escapeHtml(input.organizationName.trim())}</p>`
      : '',
    `<p style="margin:0 0 6px;font-size:14px;"><strong>Contact :</strong> ${escapeHtml(input.contactName || '—')}</p>`,
    `<p style="margin:0 0 6px;font-size:14px;"><strong>E-mail :</strong> ${escapeHtml(input.contactEmail)}</p>`,
    input.contactPhone?.trim()
      ? `<p style="margin:0 0 6px;font-size:14px;"><strong>Téléphone :</strong> ${escapeHtml(input.contactPhone.trim())}</p>`
      : '',
    input.formula?.trim()
      ? `<p style="margin:0 0 6px;font-size:14px;"><strong>Formule :</strong> ${escapeHtml(input.formula.trim())}</p>`
      : '',
    input.atoutFrance?.trim()
      ? `<p style="margin:0 0 6px;font-size:14px;"><strong>Atout France :</strong> ${escapeHtml(input.atoutFrance.trim())}</p>`
      : '',
    input.sdjes?.trim()
      ? `<p style="margin:0 0 6px;font-size:14px;"><strong>SDJES :</strong> ${escapeHtml(input.sdjes.trim())}</p>`
      : '',
    input.websiteUrl?.trim()
      ? `<p style="margin:0 0 16px;font-size:14px;"><strong>Site :</strong> ${escapeHtml(input.websiteUrl.trim())}</p>`
      : '<div style="height:10px;"></div>'
  ].join('');

  const html = `<!DOCTYPE html>
<html lang="fr">
<body style="margin:0;padding:0;background:#f8fafc;font-family:Arial,Helvetica,sans-serif;color:#1e293b;">
  <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:#f8fafc;padding:24px 12px;">
    <tr>
      <td align="center">
        <table role="presentation" width="100%" style="max-width:560px;background:#ffffff;border-radius:12px;border:1px solid #e2e8f0;overflow:hidden;">
          <tr><td style="height:4px;background:#52b0ea;"></td></tr>
          <tr>
            <td style="padding:28px 28px 8px;">
              <p style="margin:0 0 8px;font-size:12px;font-weight:700;letter-spacing:0.06em;text-transform:uppercase;color:#52b0ea;">Admin · Alerte</p>
              <h1 style="margin:0 0 12px;font-size:20px;line-height:1.3;">Nouvelle demande ${escapeHtml(kindLabel)}</h1>
              <p style="margin:0 0 16px;font-size:14px;line-height:1.5;color:#64748b;">Une demande doit être traitée dans l’espace admin.</p>
              ${detailRows}
              <p style="margin:0 0 8px;font-size:14px;font-weight:700;">Message</p>
              <p style="margin:0 0 24px;font-size:14px;line-height:1.6;white-space:pre-wrap;background:#f8fafc;border:1px solid #e2e8f0;border-radius:8px;padding:12px;">${escapeHtml(input.message)}</p>
              <a href="${escapeHtml(adminUrl)}" style="display:inline-block;padding:12px 20px;background:#f48200;color:#ffffff;text-decoration:none;border-radius:8px;font-size:14px;font-weight:600;">Ouvrir les demandes</a>
            </td>
          </tr>
          <tr>
            <td style="padding:20px 28px 28px;font-size:12px;color:#94a3b8;">Réf. demande : ${escapeHtml(input.requestId)}</td>
          </tr>
        </table>
      </td>
    </tr>
  </table>
</body>
</html>`;

  try {
    await sendSmtpEmail({ to, subject, text, html });
    return { sent: 1, failed: 0, skipped: false as const, email: to };
  } catch (error) {
    console.error('[admin-inbound-notify] send failed', {
      to,
      requestId: input.requestId,
      kind: input.kind,
      error: error instanceof Error ? error.message : String(error)
    });
    return { sent: 0, failed: 1, skipped: false as const, email: to };
  }
}

export async function createAndNotifyAdminInboundRequest(
  supabase: SupabaseClient<Database>,
  input: CreateAdminInboundRequestInput
) {
  const requestId = await createAdminInboundRequest(supabase, input);
  const contactName = [input.contactFirstName, input.contactLastName]
    .map((part) => part?.trim())
    .filter(Boolean)
    .join(' ')
    .trim();

  try {
    await notifyAdminInboundRequest({
      supabase,
      requestId,
      kind: input.kind,
      organizationName: input.organizationName,
      contactName: contactName || input.organizationName?.trim() || input.contactEmail,
      contactEmail: input.contactEmail.trim().toLowerCase(),
      contactPhone: input.contactPhone,
      formula: input.formula,
      atoutFrance: input.atoutFrance,
      sdjes: input.sdjes,
      websiteUrl: input.websiteUrl,
      message: input.message
    });
  } catch (error) {
    console.error('[admin-inbound] notification skipped', error);
  }

  return requestId;
}
