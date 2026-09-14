import 'server-only';

import { after } from 'next/server';
import type { SupabaseClient } from '@supabase/supabase-js';
import { sendSmtpEmail } from '@/lib/rag/smtp';
import { SITE_URL } from '@/lib/seo';
import type { Database } from '@/types/supabase';

const LOGO_URL =
  'https://ypesoxqzrodukhjgwfkg.supabase.co/storage/v1/object/public/brand-assets/email/logo-resacolo.png';

function escapeHtml(value: string) {
  return value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

function normalizeEmail(value: string | null | undefined) {
  const email = String(value ?? '')
    .trim()
    .toLowerCase();
  return email.includes('@') ? email : null;
}

async function resolveOrganizerNotificationEmails(
  supabase: SupabaseClient<Database>,
  organizerId: string
) {
  const emails = new Set<string>();

  const { data: organizer, error: organizerError } = await supabase
    .from('organizers')
    .select('id, name, contact_email')
    .eq('id', organizerId)
    .maybeSingle();

  if (organizerError) {
    throw new Error(organizerError.message);
  }

  const contact = normalizeEmail(organizer?.contact_email);
  if (contact) emails.add(contact);

  if (emails.size === 0) {
    const { data: owners } = await supabase
      .from('organizer_members')
      .select('user_id')
      .eq('organizer_id', organizerId)
      .eq('role', 'OWNER')
      .limit(5);

    await Promise.all(
      (owners ?? []).map(async (owner) => {
        try {
          const { data } = await supabase.auth.admin.getUserById(owner.user_id);
          const memberEmail = normalizeEmail(data.user?.email);
          if (memberEmail) emails.add(memberEmail);
        } catch (error) {
          console.warn('[inquiry-transfer-notify] owner email lookup failed', {
            userId: owner.user_id,
            error: error instanceof Error ? error.message : String(error)
          });
        }
      })
    );
  }

  return {
    organizerName: organizer?.name?.trim() || 'Organisateur',
    emails: Array.from(emails)
  };
}

function buildTransferEmailHtml(input: {
  organizerName: string;
  contactName: string;
  contactEmail: string;
  contactPhone?: string | null;
  subject?: string | null;
  message: string;
  demandesUrl: string;
}) {
  const phoneRow = input.contactPhone?.trim()
    ? `<tr>
        <td style="padding:10px 16px;border-top:1px solid #e2e8f0;font-size:13px;color:#64748b;width:110px;vertical-align:top;">Téléphone</td>
        <td style="padding:10px 16px;border-top:1px solid #e2e8f0;font-size:14px;color:#1d1f25;font-weight:600;">${escapeHtml(input.contactPhone.trim())}</td>
      </tr>`
    : '';

  const subjectRow = input.subject?.trim()
    ? `<tr>
        <td style="padding:10px 16px;border-top:1px solid #e2e8f0;font-size:13px;color:#64748b;width:110px;vertical-align:top;">Sujet</td>
        <td style="padding:10px 16px;border-top:1px solid #e2e8f0;font-size:14px;color:#1d1f25;font-weight:600;">${escapeHtml(input.subject.trim())}</td>
      </tr>`
    : '';

  return `<!DOCTYPE html>
<html lang="fr">
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <title>Demande transférée — Resacolo</title>
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
            <td align="center" style="padding:32px 32px 12px;background-color:#ffffff;">
              <img
                src="${LOGO_URL}"
                alt="Resacolo"
                width="160"
                height="42"
                style="display:block;width:160px;max-width:100%;height:auto;border:0;"
              />
            </td>
          </tr>

          <tr>
            <td style="padding:8px 40px 8px;background-color:#ffffff;">
              <p style="margin:0 0 8px;font-size:12px;font-weight:700;letter-spacing:0.08em;text-transform:uppercase;color:#f48200;text-align:center;">
                Espace organisateur
              </p>
              <h1 style="margin:0 0 12px;font-family:'Raleway',Arial,Helvetica,sans-serif;font-size:22px;font-weight:700;line-height:1.3;color:#1d1f25;text-align:center;">
                Demande transférée par Mnemos
              </h1>
              <p style="margin:0 0 8px;font-size:15px;line-height:1.6;color:#404040;text-align:center;">
                Bonjour <strong>${escapeHtml(input.organizerName)}</strong>,
              </p>
              <p style="margin:0;font-size:15px;line-height:1.6;color:#64748b;text-align:center;">
                Une demande de renseignements vous a été assignée.<br />
                Merci de la traiter depuis votre espace organisateur.
              </p>
            </td>
          </tr>

          <tr>
            <td style="padding:24px 32px 8px;">
              <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="background-color:#f8fafc;border:1px solid #e2e8f0;border-radius:12px;overflow:hidden;">
                <tr>
                  <td colspan="2" style="padding:12px 16px;background-color:#eff6ff;border-bottom:1px solid #e2e8f0;">
                    <p style="margin:0;font-size:12px;font-weight:700;letter-spacing:0.04em;text-transform:uppercase;color:#52b0ea;">
                      Coordonnées du contact
                    </p>
                  </td>
                </tr>
                <tr>
                  <td style="padding:12px 16px 10px;font-size:13px;color:#64748b;width:110px;vertical-align:top;">Nom</td>
                  <td style="padding:12px 16px 10px;font-size:14px;color:#1d1f25;font-weight:600;">${escapeHtml(input.contactName || '—')}</td>
                </tr>
                <tr>
                  <td style="padding:10px 16px;border-top:1px solid #e2e8f0;font-size:13px;color:#64748b;width:110px;vertical-align:top;">E-mail</td>
                  <td style="padding:10px 16px;border-top:1px solid #e2e8f0;font-size:14px;color:#1d1f25;font-weight:600;">
                    <a href="mailto:${escapeHtml(input.contactEmail)}" style="color:#52b0ea;text-decoration:none;">${escapeHtml(input.contactEmail)}</a>
                  </td>
                </tr>
                ${phoneRow}
                ${subjectRow}
              </table>
            </td>
          </tr>

          <tr>
            <td style="padding:16px 32px 8px;">
              <p style="margin:0 0 8px;font-size:12px;font-weight:700;letter-spacing:0.04em;text-transform:uppercase;color:#64748b;">
                Message
              </p>
              <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="background-color:#ffffff;border:1px solid #e2e8f0;border-radius:12px;">
                <tr>
                  <td style="padding:16px;font-size:14px;line-height:1.65;color:#334155;white-space:pre-wrap;">${escapeHtml(input.message)}</td>
                </tr>
              </table>
            </td>
          </tr>

          <tr>
            <td align="center" style="padding:28px 40px 12px;">
              <table role="presentation" cellpadding="0" cellspacing="0" border="0">
                <tr>
                  <td align="center" bgcolor="#f48200" style="border-radius:8px;background-color:#f48200;">
                    <a
                      href="${escapeHtml(input.demandesUrl)}"
                      target="_blank"
                      style="display:inline-block;padding:14px 32px;font-family:'Raleway',Arial,Helvetica,sans-serif;font-size:15px;font-weight:600;color:#ffffff;text-decoration:none;border-radius:8px;"
                    >
                      Ouvrir dans mon espace
                    </a>
                  </td>
                </tr>
              </table>
            </td>
          </tr>

          <tr>
            <td style="padding:8px 40px 28px;">
              <p style="margin:0;font-size:12px;line-height:1.5;color:#94a3b8;text-align:center;">
                Visible aussi dans <strong style="color:#64748b;">Organisme → Demandes</strong>.
              </p>
            </td>
          </tr>

          <tr>
            <td style="padding:20px 40px 28px;background-color:#f8fafc;border-top:1px solid #e2e8f0;">
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
}

export async function notifyOrganizerOfInquiryTransfer(input: {
  supabase: SupabaseClient<Database>;
  inquiryId: string;
  organizerId: string;
  contactName: string;
  contactEmail: string;
  contactPhone?: string | null;
  subject?: string | null;
  message: string;
}) {
  const { organizerName, emails } = await resolveOrganizerNotificationEmails(
    input.supabase,
    input.organizerId
  );

  if (emails.length === 0) {
    console.warn('[inquiry-transfer-notify] skipped: no recipient email', {
      organizerId: input.organizerId,
      inquiryId: input.inquiryId
    });
    return { sent: 0, failed: 0, skipped: true as const, emails: [] as string[] };
  }

  const demandesUrl = `${SITE_URL}/organisme/demandes/${input.inquiryId}?organizerId=${encodeURIComponent(input.organizerId)}`;
  const mailSubject = `[Resacolo] Nouvelle demande transférée — ${input.contactName || 'Contact'}`;
  const text = [
    `Bonjour ${organizerName},`,
    '',
    'Mnemos vous a transféré une demande de renseignements à traiter dans votre espace organisateur.',
    '',
    `Contact : ${input.contactName || '—'}`,
    `E-mail : ${input.contactEmail}`,
    input.contactPhone?.trim() ? `Téléphone : ${input.contactPhone.trim()}` : null,
    input.subject?.trim() ? `Sujet : ${input.subject.trim()}` : null,
    '',
    'Message :',
    input.message,
    '',
    `Ouvrir la demande : ${demandesUrl}`
  ]
    .filter((line) => line !== null)
    .join('\n');

  const html = buildTransferEmailHtml({
    organizerName,
    contactName: input.contactName,
    contactEmail: input.contactEmail,
    contactPhone: input.contactPhone,
    subject: input.subject,
    message: input.message,
    demandesUrl
  });

  const results = await Promise.all(
    emails.map(async (to) => {
      try {
        await sendSmtpEmail({ to, subject: mailSubject, text, html });
        console.info('[inquiry-transfer-notify] sent', {
          to,
          inquiryId: input.inquiryId,
          organizerId: input.organizerId
        });
        return true;
      } catch (sendError) {
        console.error('[inquiry-transfer-notify] send failed', {
          to,
          inquiryId: input.inquiryId,
          error: sendError instanceof Error ? sendError.message : String(sendError)
        });
        return false;
      }
    })
  );

  const sent = results.filter(Boolean).length;
  return { sent, failed: results.length - sent, skipped: false as const, emails };
}

/** Envoi non bloquant après la réponse HTTP (évite de ralentir Mnemos). */
export function scheduleOrganizerInquiryTransferNotify(input: {
  inquiryId: string;
  organizerId: string;
  contactName: string;
  contactEmail: string;
  contactPhone?: string | null;
  subject?: string | null;
  message: string;
  getSupabase: () => SupabaseClient<Database>;
}) {
  after(async () => {
    try {
      await notifyOrganizerOfInquiryTransfer({
        supabase: input.getSupabase(),
        inquiryId: input.inquiryId,
        organizerId: input.organizerId,
        contactName: input.contactName,
        contactEmail: input.contactEmail,
        contactPhone: input.contactPhone,
        subject: input.subject,
        message: input.message
      });
    } catch (error) {
      console.error('[inquiry-transfer-notify] background send failed', error);
    }
  });
}
