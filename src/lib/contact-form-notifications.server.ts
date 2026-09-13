import 'server-only';

import type { SupabaseClient } from '@supabase/supabase-js';
import { isMissingPublicTableError } from '@/lib/mnemos/supabase-table-missing';
import { sendSmtpEmail } from '@/lib/rag/smtp';
import { SITE_URL } from '@/lib/seo';
import type { Database } from '@/types/supabase';

export const CONTACT_FORM_NOTIFICATION_SETTINGS_ID = 'default';

const DEFAULT_NOTIFICATION_EMAILS = ['jeanne@thalie.org', 'adele@thalie.org'];

export type ContactFormNotificationSettings = {
  emails: string[];
  tableMissing: boolean;
};

function normalizeEmailList(values: string[] | null | undefined) {
  const seen = new Set<string>();
  const emails: string[] = [];
  for (const raw of values ?? []) {
    const email = raw.trim().toLowerCase();
    if (!email || !email.includes('@') || seen.has(email)) continue;
    seen.add(email);
    emails.push(email);
  }
  return emails;
}

export function parseContactNotificationEmailsFromText(value: string) {
  return normalizeEmailList(
    value
      .split(/[\n,;]+/)
      .map((part) => part.trim())
      .filter(Boolean)
  );
}

export async function readContactFormNotificationSettings(
  supabase: SupabaseClient<Database>
): Promise<ContactFormNotificationSettings> {
  const { data, error } = await supabase
    .from('contact_form_notification_settings')
    .select('notification_emails')
    .eq('id', CONTACT_FORM_NOTIFICATION_SETTINGS_ID)
    .maybeSingle();

  if (error) {
    if (isMissingPublicTableError(error)) {
      return { emails: [...DEFAULT_NOTIFICATION_EMAILS], tableMissing: true };
    }
    throw new Error(error.message);
  }

  if (!data) {
    return { emails: [...DEFAULT_NOTIFICATION_EMAILS], tableMissing: false };
  }

  return {
    emails: normalizeEmailList(data.notification_emails),
    tableMissing: false
  };
}

export async function upsertContactFormNotificationEmails(
  supabase: SupabaseClient<Database>,
  emailsInput: string[]
) {
  const emails = normalizeEmailList(emailsInput);
  const { error } = await supabase.from('contact_form_notification_settings').upsert(
    {
      id: CONTACT_FORM_NOTIFICATION_SETTINGS_ID,
      notification_emails: emails,
      updated_at: new Date().toISOString()
    },
    { onConflict: 'id' }
  );

  if (error) {
    if (isMissingPublicTableError(error)) {
      throw new Error(
        'Table contact_form_notification_settings absente. Appliquez la migration 20260913_contact_form_notification_settings.sql.'
      );
    }
    throw new Error(error.message);
  }

  return emails;
}

export async function notifyContactFormRecipients(input: {
  supabase: SupabaseClient<Database>;
  inquiryId: string;
  firstName: string;
  lastName: string;
  email: string;
  phone?: string;
  recipient: string;
  message: string;
}) {
  const settings = await readContactFormNotificationSettings(input.supabase);
  if (settings.emails.length === 0) {
    return { sent: 0, failed: 0, skipped: true as const };
  }

  const contactName = [input.firstName, input.lastName].filter(Boolean).join(' ').trim() || 'Contact';
  const inquiryUrl = `${SITE_URL}/mnemos/inquiries/${input.inquiryId}`;
  const subject = `[Resacolo] Nouvelle demande de contact — ${contactName}`;
  const text = [
    'Une nouvelle demande a été reçue via le formulaire de contact Resacolo.',
    '',
    `Nom : ${contactName}`,
    `E-mail : ${input.email}`,
    input.phone?.trim() ? `Téléphone : ${input.phone.trim()}` : null,
    `Destinataire du formulaire : ${input.recipient}`,
    '',
    'Message :',
    input.message,
    '',
    `Traiter dans Mnemos : ${inquiryUrl}`
  ]
    .filter((line) => line !== null)
    .join('\n');

  const html = `<!DOCTYPE html>
<html lang="fr">
<body style="margin:0;padding:0;background:#f8fafc;font-family:Arial,Helvetica,sans-serif;color:#1e293b;">
  <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:#f8fafc;padding:24px 12px;">
    <tr>
      <td align="center">
        <table role="presentation" width="100%" style="max-width:560px;background:#ffffff;border-radius:12px;border:1px solid #e2e8f0;overflow:hidden;">
          <tr><td style="height:4px;background:#7c3aed;"></td></tr>
          <tr>
            <td style="padding:28px 28px 8px;">
              <p style="margin:0 0 8px;font-size:12px;font-weight:700;letter-spacing:0.06em;text-transform:uppercase;color:#7c3aed;">Mnemos · Alerte</p>
              <h1 style="margin:0 0 12px;font-size:20px;line-height:1.3;">Nouvelle demande de contact</h1>
              <p style="margin:0 0 16px;font-size:14px;line-height:1.5;color:#64748b;">Une demande doit être traitée dans l’onglet Demandes.</p>
              <p style="margin:0 0 6px;font-size:14px;"><strong>Nom :</strong> ${escapeHtml(contactName)}</p>
              <p style="margin:0 0 6px;font-size:14px;"><strong>E-mail :</strong> ${escapeHtml(input.email)}</p>
              ${
                input.phone?.trim()
                  ? `<p style="margin:0 0 6px;font-size:14px;"><strong>Téléphone :</strong> ${escapeHtml(input.phone.trim())}</p>`
                  : ''
              }
              <p style="margin:0 0 16px;font-size:14px;"><strong>Destinataire :</strong> ${escapeHtml(input.recipient)}</p>
              <p style="margin:0 0 8px;font-size:14px;font-weight:700;">Message</p>
              <p style="margin:0 0 24px;font-size:14px;line-height:1.6;white-space:pre-wrap;background:#f8fafc;border:1px solid #e2e8f0;border-radius:8px;padding:12px;">${escapeHtml(input.message)}</p>
              <a href="${escapeHtml(inquiryUrl)}" style="display:inline-block;padding:12px 20px;background:#7c3aed;color:#ffffff;text-decoration:none;border-radius:8px;font-size:14px;font-weight:600;">Ouvrir dans Mnemos</a>
            </td>
          </tr>
          <tr>
            <td style="padding:20px 28px 28px;font-size:12px;color:#94a3b8;">La demande reste aussi visible dans Mnemos → Demandes de renseignements.</td>
          </tr>
        </table>
      </td>
    </tr>
  </table>
</body>
</html>`;

  let sent = 0;
  let failed = 0;
  for (const to of settings.emails) {
    try {
      await sendSmtpEmail({ to, subject, text, html });
      sent += 1;
    } catch (error) {
      failed += 1;
      console.error('[contact-form-notify] send failed', {
        to,
        error: error instanceof Error ? error.message : String(error)
      });
    }
  }

  return { sent, failed, skipped: false as const, emails: settings.emails };
}

function escapeHtml(value: string) {
  return value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}
