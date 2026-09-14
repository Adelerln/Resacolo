import 'server-only';

import type { SupabaseClient } from '@supabase/supabase-js';
import { sendSmtpEmail } from '@/lib/rag/smtp';
import { SITE_URL } from '@/lib/seo';
import type { Database } from '@/types/supabase';

function escapeHtml(value: string) {
  return value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
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
  const { data: organizer, error } = await input.supabase
    .from('organizers')
    .select('id, name, contact_email')
    .eq('id', input.organizerId)
    .maybeSingle();

  if (error) {
    console.error('[inquiry-transfer-notify] organizer lookup failed', error.message);
    return { sent: false as const, reason: 'lookup_failed' as const };
  }

  const to = organizer?.contact_email?.trim().toLowerCase() ?? '';
  if (!to.includes('@')) {
    console.warn('[inquiry-transfer-notify] skipped: no contact_email', {
      organizerId: input.organizerId,
      inquiryId: input.inquiryId
    });
    return { sent: false as const, reason: 'no_email' as const };
  }

  const organizerName = organizer?.name?.trim() || 'Organisateur';
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

  const html = `<!DOCTYPE html>
<html lang="fr">
<body style="margin:0;padding:0;background:#f8fafc;font-family:Arial,Helvetica,sans-serif;color:#1e293b;">
  <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:#f8fafc;padding:24px 12px;">
    <tr>
      <td align="center">
        <table role="presentation" width="100%" style="max-width:560px;background:#ffffff;border-radius:12px;border:1px solid #e2e8f0;overflow:hidden;">
          <tr><td style="height:4px;background:#059669;"></td></tr>
          <tr>
            <td style="padding:28px 28px 8px;">
              <p style="margin:0 0 8px;font-size:12px;font-weight:700;letter-spacing:0.06em;text-transform:uppercase;color:#059669;">Espace organisateur</p>
              <h1 style="margin:0 0 12px;font-size:20px;line-height:1.3;">Demande transférée par Mnemos</h1>
              <p style="margin:0 0 16px;font-size:14px;line-height:1.5;color:#64748b;">Une demande de renseignements vous a été assignée.</p>
              <p style="margin:0 0 6px;font-size:14px;"><strong>Contact :</strong> ${escapeHtml(input.contactName || '—')}</p>
              <p style="margin:0 0 6px;font-size:14px;"><strong>E-mail :</strong> ${escapeHtml(input.contactEmail)}</p>
              ${
                input.contactPhone?.trim()
                  ? `<p style="margin:0 0 6px;font-size:14px;"><strong>Téléphone :</strong> ${escapeHtml(input.contactPhone.trim())}</p>`
                  : ''
              }
              ${
                input.subject?.trim()
                  ? `<p style="margin:0 0 16px;font-size:14px;"><strong>Sujet :</strong> ${escapeHtml(input.subject.trim())}</p>`
                  : ''
              }
              <p style="margin:0 0 8px;font-size:14px;font-weight:700;">Message</p>
              <p style="margin:0 0 24px;font-size:14px;line-height:1.6;white-space:pre-wrap;background:#f8fafc;border:1px solid #e2e8f0;border-radius:8px;padding:12px;">${escapeHtml(input.message)}</p>
              <a href="${escapeHtml(demandesUrl)}" style="display:inline-block;padding:12px 20px;background:#059669;color:#ffffff;text-decoration:none;border-radius:8px;font-size:14px;font-weight:600;">Ouvrir dans mon espace</a>
            </td>
          </tr>
          <tr>
            <td style="padding:20px 28px 28px;font-size:12px;color:#94a3b8;">Visible aussi dans Organisme → Demandes.</td>
          </tr>
        </table>
      </td>
    </tr>
  </table>
</body>
</html>`;

  try {
    await sendSmtpEmail({ to, subject: mailSubject, text, html });
    console.info('[inquiry-transfer-notify] sent', {
      to,
      inquiryId: input.inquiryId,
      organizerId: input.organizerId
    });
    return { sent: true as const, to };
  } catch (sendError) {
    console.error('[inquiry-transfer-notify] send failed', {
      to,
      inquiryId: input.inquiryId,
      error: sendError instanceof Error ? sendError.message : String(sendError)
    });
    return { sent: false as const, reason: 'send_failed' as const, to };
  }
}
