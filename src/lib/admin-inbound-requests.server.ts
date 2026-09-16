import 'server-only';

import type { SupabaseClient } from '@supabase/supabase-js';
import { isMissingPublicTableError } from '@/lib/mnemos/supabase-table-missing';
import { sendSmtpEmail } from '@/lib/rag/smtp';
import { SITE_URL } from '@/lib/seo';
import { getServerSupabaseClient } from '@/lib/supabase/server';
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

export type AdminInboundRequestListRow = {
  id: string;
  kind: string;
  status: string;
  organization_name: string | null;
  contact_first_name: string | null;
  contact_last_name: string | null;
  contact_email: string;
  contact_phone: string | null;
  formula: string | null;
  message: string;
  created_at: string;
  resolved_at: string | null;
};

export async function listAdminInboundRequests(options?: {
  limit?: number;
  kind?: AdminInboundRequestKind | null;
  status?: AdminInboundRequestStatus | null;
}): Promise<{
  rows: AdminInboundRequestListRow[];
  error: Error | null;
  tableMissing: boolean;
}> {
  const supabase = getServerSupabaseClient();
  let query = supabase
    .from('admin_inbound_requests')
    .select(
      'id,kind,status,organization_name,contact_first_name,contact_last_name,contact_email,contact_phone,formula,message,created_at,resolved_at'
    )
    .order('created_at', { ascending: false })
    .limit(options?.limit ?? 100);

  if (options?.kind) {
    query = query.eq('kind', options.kind);
  }
  if (options?.status) {
    query = query.eq('status', options.status);
  }

  const { data, error } = await query;
  if (error) {
    if (isMissingPublicTableError(error)) {
      return { rows: [], error: null, tableMissing: true };
    }
    return { rows: [], error: new Error(error.message), tableMissing: false };
  }

  return {
    rows: (data ?? []) as AdminInboundRequestListRow[],
    error: null,
    tableMissing: false
  };
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
      ? `<tr><td style="padding:8px 0;border-bottom:1px solid #f1f5f9;font-family:'Raleway',Arial,Helvetica,sans-serif;font-size:14px;color:#1d1f25;"><strong style="color:#64748b;font-weight:600;">Structure</strong><br />${escapeHtml(input.organizationName.trim())}</td></tr>`
      : '',
    `<tr><td style="padding:8px 0;border-bottom:1px solid #f1f5f9;font-family:'Raleway',Arial,Helvetica,sans-serif;font-size:14px;color:#1d1f25;"><strong style="color:#64748b;font-weight:600;">Contact</strong><br />${escapeHtml(input.contactName || '—')}</td></tr>`,
    `<tr><td style="padding:8px 0;border-bottom:1px solid #f1f5f9;font-family:'Raleway',Arial,Helvetica,sans-serif;font-size:14px;color:#1d1f25;"><strong style="color:#64748b;font-weight:600;">E-mail</strong><br /><a href="mailto:${escapeHtml(input.contactEmail)}" style="color:#52b0ea;text-decoration:none;">${escapeHtml(input.contactEmail)}</a></td></tr>`,
    input.contactPhone?.trim()
      ? `<tr><td style="padding:8px 0;border-bottom:1px solid #f1f5f9;font-family:'Raleway',Arial,Helvetica,sans-serif;font-size:14px;color:#1d1f25;"><strong style="color:#64748b;font-weight:600;">Téléphone</strong><br />${escapeHtml(input.contactPhone.trim())}</td></tr>`
      : '',
    input.formula?.trim()
      ? `<tr><td style="padding:8px 0;border-bottom:1px solid #f1f5f9;font-family:'Raleway',Arial,Helvetica,sans-serif;font-size:14px;color:#1d1f25;"><strong style="color:#64748b;font-weight:600;">Formule</strong><br />${escapeHtml(input.formula.trim())}</td></tr>`
      : '',
    input.atoutFrance?.trim()
      ? `<tr><td style="padding:8px 0;border-bottom:1px solid #f1f5f9;font-family:'Raleway',Arial,Helvetica,sans-serif;font-size:14px;color:#1d1f25;"><strong style="color:#64748b;font-weight:600;">Atout France</strong><br />${escapeHtml(input.atoutFrance.trim())}</td></tr>`
      : '',
    input.sdjes?.trim()
      ? `<tr><td style="padding:8px 0;border-bottom:1px solid #f1f5f9;font-family:'Raleway',Arial,Helvetica,sans-serif;font-size:14px;color:#1d1f25;"><strong style="color:#64748b;font-weight:600;">SDJES</strong><br />${escapeHtml(input.sdjes.trim())}</td></tr>`
      : '',
    input.websiteUrl?.trim()
      ? `<tr><td style="padding:8px 0;font-family:'Raleway',Arial,Helvetica,sans-serif;font-size:14px;color:#1d1f25;"><strong style="color:#64748b;font-weight:600;">Site</strong><br /><a href="${escapeHtml(input.websiteUrl.trim())}" style="color:#52b0ea;text-decoration:none;">${escapeHtml(input.websiteUrl.trim())}</a></td></tr>`
      : ''
  ].join('');

  const kindTitle =
    input.kind === 'PARTNER' ? 'Nouvelle demande de partenariat' : 'Nouvelle demande organisateur';

  const html = `<!DOCTYPE html>
<html lang="fr">
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <title>${escapeHtml(kindTitle)}</title>
</head>
<body style="margin:0;padding:0;background-color:#f8f8f8;">
  <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="background-color:#f8f8f8;font-family:'Raleway',Arial,Helvetica,sans-serif;">
    <tr>
      <td align="center" style="padding:40px 16px;">
        <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="max-width:560px;background-color:#ffffff;border-radius:16px;overflow:hidden;">
          <tr>
            <td style="height:4px;background-color:#52b0ea;font-size:0;line-height:0;">&nbsp;</td>
          </tr>
          <tr>
            <td align="center" style="padding:36px 32px 20px;background-color:#ffffff;">
              <img
                src="https://ypesoxqzrodukhjgwfkg.supabase.co/storage/v1/object/public/brand-assets/email/logo-resacolo.png"
                alt="Resacolo"
                width="180"
                height="47"
                style="display:block;width:180px;max-width:100%;height:auto;border:0;"
              />
            </td>
          </tr>
          <tr>
            <td style="padding:0 40px 8px;background-color:#ffffff;">
              <p style="margin:0 0 8px;font-family:'Raleway',Arial,Helvetica,sans-serif;font-size:13px;font-weight:600;letter-spacing:0.04em;text-transform:uppercase;color:#f48200;text-align:center;">
                Alerte admin
              </p>
              <h1 style="margin:0 0 12px;font-family:'Raleway',Arial,Helvetica,sans-serif;font-size:24px;font-weight:700;line-height:1.3;color:#1d1f25;text-align:center;">
                ${escapeHtml(kindTitle)}
              </h1>
              <p style="margin:0 0 24px;font-family:'Raleway',Arial,Helvetica,sans-serif;font-size:15px;line-height:1.6;color:#64748b;text-align:center;">
                Une demande vient d’arriver et doit être traitée dans l’espace admin.
              </p>
            </td>
          </tr>
          <tr>
            <td style="padding:0 40px 20px;">
              <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="background-color:#f8fafc;border:1px solid #e2e8f0;border-radius:12px;">
                <tr>
                  <td style="padding:16px 18px;">
                    <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0">
                      ${detailRows}
                    </table>
                  </td>
                </tr>
              </table>
            </td>
          </tr>
          <tr>
            <td style="padding:0 40px 28px;">
              <p style="margin:0 0 8px;font-family:'Raleway',Arial,Helvetica,sans-serif;font-size:14px;font-weight:700;color:#1d1f25;">
                Message
              </p>
              <p style="margin:0;font-family:'Raleway',Arial,Helvetica,sans-serif;font-size:14px;line-height:1.6;color:#404040;white-space:pre-wrap;background:#ffffff;border:1px solid #e2e8f0;border-radius:10px;padding:14px;">${escapeHtml(input.message)}</p>
            </td>
          </tr>
          <tr>
            <td align="center" style="padding:0 40px 32px;">
              <table role="presentation" cellpadding="0" cellspacing="0" border="0" align="center" style="margin:0 auto;">
                <tr>
                  <td align="center" bgcolor="#f48200" style="border-radius:8px;background-color:#f48200;">
                    <a href="${escapeHtml(adminUrl)}" target="_blank" style="display:inline-block;padding:14px 36px;font-family:'Raleway',Arial,Helvetica,sans-serif;font-size:16px;font-weight:600;color:#ffffff;text-decoration:none;border-radius:8px;">
                      Ouvrir les demandes
                    </a>
                  </td>
                </tr>
              </table>
            </td>
          </tr>
          <tr>
            <td style="padding:24px 40px 32px;background-color:#f8fafc;border-top:1px solid #e2e8f0;">
              <p style="margin:0 0 8px;font-family:'Raleway',Arial,Helvetica,sans-serif;font-size:12px;line-height:1.5;color:#94a3b8;text-align:center;">
                Réf. demande : ${escapeHtml(input.requestId)}
              </p>
              <p style="margin:0;font-family:'Raleway',Arial,Helvetica,sans-serif;font-size:12px;font-weight:500;color:#64748b;text-align:center;">
                <a href="https://resacolo.com" style="color:#52b0ea;text-decoration:none;">resacolo.com</a>
              </p>
            </td>
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

  const notifyResult = await notifyAdminInboundRequest({
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

  if (notifyResult.failed > 0) {
    throw new Error(
      `Demande enregistrée (${requestId}) mais l'e-mail d'alerte n'a pas pu être envoyé.`
    );
  }

  return requestId;
}
