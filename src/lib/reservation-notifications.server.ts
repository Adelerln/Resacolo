import 'server-only';

import { sendSmtpEmail } from '@/lib/rag/smtp';
import type { CheckoutContact, CheckoutPaymentMode } from '@/types/checkout';
import { formatOrderReservationCode, type OrderRequestKind } from '@/lib/order-workflow';

export type ReservationNotificationLine = {
  stayTitle: string;
  sessionLabel: string;
  childName: string;
  amountLabel?: string | null;
};

export type OrganizerReservationAction = {
  title: string;
  description: string;
};

export type ReservationNotificationInput = {
  orderId: string;
  organizerId: string;
  organizerName: string;
  organizerEmail: string | null | undefined;
  familyEmail: string;
  contact: Pick<
    CheckoutContact,
    | 'billingFirstName'
    | 'billingLastName'
    | 'email'
    | 'phone'
    | 'paymentMode'
    | 'vacafNumber'
    | 'ancvConnectMatricule'
    | 'ancvConnectAmount'
  >;
  paymentMode: CheckoutPaymentMode;
  requestKind: OrderRequestKind;
  /** True only when a partner affiliation requires a manual finance quote. */
  isPartnerManualQuote?: boolean;
  lines: ReservationNotificationLine[];
  organizerAcceptsAncvPaper: boolean;
  organizerAcceptsAncvConnect: boolean;
  organizerIsVacafApproved: boolean;
  stayCafEligible: boolean;
  ancvPaperMailingAddress?: string | null;
  dashboardUrl?: string;
  familyAccountUrl?: string;
};

function escapeHtml(value: string) {
  return value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

function paymentModeLabel(mode: CheckoutPaymentMode, requestKind?: OrderRequestKind) {
  if (requestKind === 'VACAF') return 'Demande VACAF / AVE';
  if (requestKind === 'ANCV_CONNECT' || mode === 'CV_CONNECT') return 'ANCV Connect';
  switch (mode) {
    case 'FULL':
      return 'Paiement intégral';
    case 'DEPOSIT_200':
      return 'Acompte 200 €';
    case 'CV_PAPER':
      return 'ANCV papier (chèques-vacances)';
    case 'DEFERRED':
      return 'Paiement différé';
    default:
      return mode;
  }
}

export function buildOrganizerReservationActions(input: {
  paymentMode: CheckoutPaymentMode;
  requestKind: OrderRequestKind;
  isPartnerManualQuote?: boolean;
  organizerAcceptsAncvPaper: boolean;
  organizerAcceptsAncvConnect: boolean;
  organizerIsVacafApproved: boolean;
  stayCafEligible: boolean;
  hasVacafNumber: boolean;
  ancvConnectMatricule?: string | null;
  ancvConnectAmount?: string | null;
}): OrganizerReservationAction[] {
  const actions: OrganizerReservationAction[] = [];
  const hasVacaf =
    input.requestKind === 'VACAF' ||
    (input.hasVacafNumber && input.organizerIsVacafApproved && input.stayCafEligible);
  const hasAncvConnect = input.requestKind === 'ANCV_CONNECT' || input.paymentMode === 'CV_CONNECT';

  if (hasVacaf) {
    actions.push({
      title: 'Action requise — VACAF / CAF',
      description:
        'Vérifier les droits VACAF/AVE de la famille, puis saisir le montant CAF réellement appliqué à la réservation dans votre espace organisateur.'
    });
  } else if (input.hasVacafNumber && !input.stayCafEligible) {
    actions.push({
      title: 'Attention — CAF non applicable sur ce séjour',
      description:
        'La famille a renseigné un numéro VACAF, mais ce séjour n’est pas marqué comme éligible CAF (souvent le cas pour un séjour à l’étranger). Aucune prise en charge CAF ne doit être attendue sur cette demande.'
    });
  }

  if (hasAncvConnect) {
    if (input.organizerAcceptsAncvConnect) {
      const clientId = input.ancvConnectMatricule?.trim() || null;
      const amount = input.ancvConnectAmount?.trim() || null;
      const clientIdPart = clientId ? ` (matricule ${clientId})` : '';
      const amountPart = amount ? ` pour environ ${amount} €` : '';
      actions.push({
        title: 'Action requise — ANCV Connect',
        description: `Recontactez la famille pour finaliser le règlement ANCV Connect${amountPart}${clientIdPart}, puis saisissez le montant effectivement reçu dans votre espace organisateur.`
      });
    } else {
      actions.push({
        title: 'Attention — ANCV Connect non accepté',
        description:
          'Cette demande mentionne ANCV Connect alors que votre organisme n’accepte pas ce mode. Recontactez la famille pour proposer un autre règlement.'
      });
    }
  }

  if (input.paymentMode === 'CV_PAPER') {
    if (input.organizerAcceptsAncvPaper) {
      actions.push({
        title: 'Action requise — ANCV papier',
        description:
          'Attendre / confirmer la réception des chèques-vacances papier à l’adresse postale renseignée sur votre fiche, puis enregistrer le montant encaissé dans votre espace organisateur.'
      });
    } else {
      actions.push({
        title: 'Attention — ANCV papier non accepté',
        description:
          'Cette demande mentionne des chèques-vacances papier alors que votre organisme ne les accepte pas. Recontactez la famille.'
      });
    }
  }

  // DEFERRED is also used when VACAF is checked (no online CB). Never confuse that with a partner quote.
  if (input.paymentMode === 'DEFERRED' && !hasVacaf && !hasAncvConnect && !input.hasVacafNumber) {
    if (input.isPartnerManualQuote) {
      actions.push({
        title: 'Paiement différé — devis partenaire',
        description:
          'Le règlement est différé car le partenaire doit d’abord calculer la prise en charge et la renseigner dans son back-office. Attendez ce calcul avant de finaliser le reste à charge avec la famille.'
      });
    } else {
      actions.push({
        title: 'Paiement différé',
        description:
          'La famille a choisi un règlement différé. Aucun paiement en ligne n’est attendu pour l’instant : recontactez-la pour finaliser le reste à charge.'
      });
    }
  }

  if (actions.length === 0) {
    actions.push({
      title: 'Aucune action d’aide particulière',
      description:
        'Aucune démarche VACAF / ANCV spécifique n’est requise de votre côté pour cette demande. Traitez l’inscription comme une réservation standard.'
    });
  }

  return actions;
}

function renderEmailShell(input: {
  title: string;
  eyebrow: string;
  introHtml: string;
  bodyHtml: string;
  ctaUrl?: string;
  ctaLabel?: string;
}) {
  const cta =
    input.ctaUrl && input.ctaLabel
      ? `
          <tr>
            <td align="center" style="padding:8px 40px 32px;">
              <table role="presentation" cellpadding="0" cellspacing="0" border="0">
                <tr>
                  <td align="center" bgcolor="#f48200" style="border-radius:8px;background-color:#f48200;">
                    <a href="${escapeHtml(input.ctaUrl)}" target="_blank" style="display:inline-block;padding:14px 28px;font-family:'Raleway',Arial,Helvetica,sans-serif;font-size:15px;font-weight:600;color:#ffffff;text-decoration:none;border-radius:8px;">
                      ${escapeHtml(input.ctaLabel)}
                    </a>
                  </td>
                </tr>
              </table>
            </td>
          </tr>`
      : '';

  return `<!DOCTYPE html>
<html lang="fr">
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <title>${escapeHtml(input.title)}</title>
  <!--[if !mso]><!-->
  <link href="https://fonts.googleapis.com/css2?family=Raleway:wght@400;600;700&display=swap" rel="stylesheet" />
  <!--<![endif]-->
</head>
<body style="margin:0;padding:0;background-color:#f8f8f8;">
  <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="background-color:#f8f8f8;font-family:'Raleway',Arial,Helvetica,sans-serif;">
    <tr>
      <td align="center" style="padding:40px 16px;">
        <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="max-width:600px;background-color:#ffffff;border-radius:16px;overflow:hidden;">
          <tr><td style="height:4px;background-color:#52b0ea;font-size:0;line-height:0;">&nbsp;</td></tr>
          <tr>
            <td style="padding:28px 40px 8px;">
              <p style="margin:0 0 4px;font-family:'Raleway',Arial,Helvetica,sans-serif;font-size:13px;font-weight:600;letter-spacing:0.04em;text-transform:uppercase;color:#f48200;">${escapeHtml(input.eyebrow)}</p>
              <h1 style="margin:0 0 12px;font-family:'Raleway',Arial,Helvetica,sans-serif;font-size:22px;font-weight:700;line-height:1.3;color:#1d1f25;">${escapeHtml(input.title)}</h1>
              <p style="margin:0;font-family:'Raleway',Arial,Helvetica,sans-serif;font-size:15px;line-height:1.6;color:#64748b;">${input.introHtml}</p>
            </td>
          </tr>
          ${input.bodyHtml}
          ${cta}
          <tr>
            <td style="padding:20px 40px 28px;background-color:#f8fafc;border-top:1px solid #e2e8f0;">
              <p style="margin:0;font-family:'Raleway',Arial,Helvetica,sans-serif;font-size:12px;line-height:1.5;color:#94a3b8;text-align:center;">
                Message automatique Resacolo · <a href="https://resacolo.com" style="color:#52b0ea;text-decoration:none;">resacolo.com</a>
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

function renderLinesBlock(lines: ReservationNotificationLine[]) {
  return lines
    .map(
      (line) => `
        <tr>
          <td style="padding:10px 0;border-top:1px solid #e2e8f0;font-size:14px;color:#1d1f25;">
            <strong>${escapeHtml(line.stayTitle)}</strong><br />
            <span style="color:#64748b;font-size:13px;">${escapeHtml(line.sessionLabel)}</span><br />
            <span style="color:#64748b;font-size:13px;">Participant : ${escapeHtml(line.childName)}</span>
            ${line.amountLabel ? `<br /><span style="color:#64748b;font-size:13px;">Montant : ${escapeHtml(line.amountLabel)}</span>` : ''}
          </td>
        </tr>`
    )
    .join('');
}

export function renderOrganizerReservationEmail(input: ReservationNotificationInput) {
  const reservationCode = formatOrderReservationCode(input.orderId);
  const ancvConnectMatricule = input.contact.ancvConnectMatricule?.trim() || null;
  const ancvConnectAmount = input.contact.ancvConnectAmount?.trim() || null;
  const actions = buildOrganizerReservationActions({
    paymentMode: input.paymentMode,
    requestKind: input.requestKind,
    isPartnerManualQuote: input.isPartnerManualQuote,
    organizerAcceptsAncvPaper: input.organizerAcceptsAncvPaper,
    organizerAcceptsAncvConnect: input.organizerAcceptsAncvConnect,
    organizerIsVacafApproved: input.organizerIsVacafApproved,
    stayCafEligible: input.stayCafEligible,
    hasVacafNumber: Boolean(input.contact.vacafNumber?.trim()),
    ancvConnectMatricule,
    ancvConnectAmount
  });
  const familyName = [input.contact.billingFirstName, input.contact.billingLastName]
    .filter(Boolean)
    .join(' ')
    .trim();
  const dashboardUrl = input.dashboardUrl ?? 'https://resacolo.com/organisme';
  const showAncvConnectIds =
    input.requestKind === 'ANCV_CONNECT' || input.paymentMode === 'CV_CONNECT';

  const actionsHtml = actions
    .map(
      (action) => `
        <tr>
          <td style="padding:12px 14px;border:1px solid #fed7aa;background:#fff7ed;border-radius:10px;">
            <p style="margin:0 0 4px;font-size:14px;font-weight:700;color:#c2410c;">${escapeHtml(action.title)}</p>
            <p style="margin:0;font-size:13px;line-height:1.55;color:#9a3412;">${escapeHtml(action.description)}</p>
          </td>
        </tr>
        <tr><td style="height:10px;font-size:0;line-height:0;">&nbsp;</td></tr>`
    )
    .join('');

  const bodyHtml = `
          <tr>
            <td style="padding:16px 40px 8px;">
              <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="background:#f8fafc;border:1px solid #e2e8f0;border-radius:12px;">
                <tr>
                  <td style="padding:16px;">
                    <p style="margin:0 0 8px;font-size:13px;font-weight:600;color:#64748b;text-transform:uppercase;letter-spacing:0.03em;">Réservation</p>
                    <p style="margin:0 0 4px;font-size:14px;color:#1d1f25;"><strong>Référence :</strong> ${escapeHtml(reservationCode)}</p>
                    <p style="margin:0 0 4px;font-size:14px;color:#1d1f25;"><strong>Famille :</strong> ${escapeHtml(familyName || '—')}</p>
                    <p style="margin:0 0 4px;font-size:14px;color:#1d1f25;"><strong>E-mail :</strong> ${escapeHtml(input.contact.email)}</p>
                    <p style="margin:0 0 4px;font-size:14px;color:#1d1f25;"><strong>Téléphone :</strong> ${escapeHtml(input.contact.phone || '—')}</p>
                    <p style="margin:0 0 4px;font-size:14px;color:#1d1f25;"><strong>Mode de règlement :</strong> ${escapeHtml(paymentModeLabel(input.paymentMode, input.requestKind))}</p>
                    <p style="margin:0 0 4px;font-size:14px;color:#1d1f25;"><strong>Mode de règlement :</strong> ${escapeHtml(paymentModeLabel(input.paymentMode))}</p>
                    ${
                      showAncvConnectIds
                        ? `<p style="margin:0 0 4px;font-size:14px;color:#1d1f25;"><strong>Identifiant client ANCV Connect :</strong> ${escapeHtml(ancvConnectMatricule || '—')}</p>
                    <p style="margin:0 0 4px;font-size:14px;color:#1d1f25;"><strong>Montant ANCV Connect :</strong> ${escapeHtml(ancvConnectAmount || '—')}</p>`
                        : ''
                    }
                    <p style="margin:0;font-size:14px;color:#1d1f25;"><strong>Séjour éligible CAF :</strong> ${input.stayCafEligible ? 'Oui' : 'Non'}</p>
                  </td>
                </tr>
              </table>
            </td>
          </tr>
          <tr>
            <td style="padding:8px 40px 8px;">
              <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0">
                ${renderLinesBlock(input.lines)}
              </table>
            </td>
          </tr>
          <tr>
            <td style="padding:12px 40px 8px;">
              <p style="margin:0 0 10px;font-size:15px;font-weight:700;color:#1d1f25;">Actions à prévoir</p>
              <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0">
                ${actionsHtml}
              </table>
            </td>
          </tr>`;

  const html = renderEmailShell({
    eyebrow: 'Espace organisateur',
    title: 'Nouvelle demande de réservation',
    introHtml: `Bonjour <strong>${escapeHtml(input.organizerName)}</strong>, une famille vient de transmettre une demande via Resacolo.`,
    bodyHtml,
    ctaUrl: dashboardUrl,
    ctaLabel: 'Ouvrir mon espace organisateur'
  });

  const text = [
    `Nouvelle demande de réservation — ${input.organizerName}`,
    `Référence : ${reservationCode}`,
    `Famille : ${familyName || '—'}`,
    `E-mail : ${input.contact.email}`,
    `Téléphone : ${input.contact.phone || '—'}`,
    `Mode de règlement : ${paymentModeLabel(input.paymentMode, input.requestKind)}`,
    `Mode de règlement : ${paymentModeLabel(input.paymentMode)}`,
    ...(showAncvConnectIds
      ? [
          `Identifiant client ANCV Connect : ${ancvConnectMatricule || '—'}`,
          `Montant ANCV Connect : ${ancvConnectAmount || '—'}`
        ]
      : []),
    `Séjour éligible CAF : ${input.stayCafEligible ? 'Oui' : 'Non'}`,
    '',
    ...input.lines.map(
      (line) =>
        `- ${line.stayTitle} | ${line.sessionLabel} | ${line.childName}${line.amountLabel ? ` | ${line.amountLabel}` : ''}`
    ),
    '',
    'Actions à prévoir :',
    ...actions.map((action) => `- ${action.title} : ${action.description}`),
    '',
    `Espace organisateur : ${dashboardUrl}`
  ].join('\n');

  return {
    subject: `[Resacolo] Nouvelle réservation — action${actions.some((a) => a.title.startsWith('Action')) ? ' requise' : ''} (${input.organizerName})`,
    html,
    text
  };
}

export function renderFamilyReservationEmail(input: ReservationNotificationInput) {
  const reservationCode = formatOrderReservationCode(input.orderId);
  const familyName = [input.contact.billingFirstName, input.contact.billingLastName]
    .filter(Boolean)
    .join(' ')
    .trim();
  const accountUrl = input.familyAccountUrl ?? 'https://resacolo.com/mon-compte';
  const nextSteps: string[] = [];

  if (input.requestKind === 'VACAF' || (input.contact.vacafNumber?.trim() && input.stayCafEligible)) {
    nextSteps.push(
      'L’organisateur va vérifier vos droits VACAF/CAF. Vous pouvez être recontacté(e) pour finaliser l’inscription.'
    );
  } else if (input.contact.vacafNumber?.trim() && !input.stayCafEligible) {
    nextSteps.push(
      'Ce séjour n’est pas éligible aux aides CAF. Votre numéro VACAF a bien été transmis pour information, mais aucune prise en charge CAF n’est attendue sur cette demande.'
    );
  }

  if (input.paymentMode === 'CV_CONNECT' || input.requestKind === 'ANCV_CONNECT') {
    nextSteps.push(
      'ANCV Connect : l’organisateur va vous recontacter pour finaliser le règlement avec vos Chèques-Vacances Connect.'
    );
  } else if (input.paymentMode === 'CV_PAPER') {
    const mailingAddress = input.ancvPaperMailingAddress?.trim();
    if (mailingAddress) {
      nextSteps.push(
        `Envoyez vos chèques-vacances papier à l’adresse suivante : ${mailingAddress}. L’organisateur confirmera ensuite la réception.`
      );
    } else {
      nextSteps.push(
        'Envoyez vos chèques-vacances papier à l’organisateur. L’adresse postale exacte vous sera communiquée par l’organisateur ; il confirmera ensuite la réception.'
      );
    }
  } else if (input.paymentMode === 'DEPOSIT_200') {
    nextSteps.push(
      'Votre acompte de 200 € a été initié. Dès confirmation bancaire, il apparaîtra comme encaissé ; le solde restant pourra être réglé ensuite.'
    );
  } else if (input.paymentMode === 'FULL') {
    nextSteps.push(
      'Votre paiement par carte bancaire a été initié. Dès que la banque confirme l’opération, le statut passe à « Payée » dans votre espace Mon compte (cela peut prendre quelques instants après le retour de la page bancaire).'
    );
  } else if (input.paymentMode === 'DEFERRED') {
    const coveredByAid =
      input.requestKind === 'VACAF' ||
      input.requestKind === 'ANCV_CONNECT' ||
      Boolean(input.contact.vacafNumber?.trim());
    if (!coveredByAid) {
      if (input.isPartnerManualQuote) {
        nextSteps.push(
          'Paiement différé : aucun règlement n’est demandé pour l’instant, car votre partenaire doit d’abord calculer la prise en charge et la renseigner dans son back-office. Le reste à charge vous sera indiqué ensuite.'
        );
      } else {
        nextSteps.push(
          'Paiement différé : aucun règlement n’est demandé pour l’instant. L’organisateur vous recontactera pour finaliser le reste à charge.'
        );
      }
    }
  } else if (nextSteps.length === 0) {
    nextSteps.push(
      'Paiement différé : aucun règlement n’est demandé pour l’instant, car votre partenaire doit d’abord calculer la prise en charge et la renseigner dans son back-office. Le reste à charge vous sera indiqué ensuite.'
    );
  } else {
    nextSteps.push('L’organisateur va traiter votre demande et vous recontactera si une information manque.');
  }

  nextSteps.push(
    `Conservez la référence ${reservationCode} et suivez l’avancée depuis votre espace « Mon compte ».`
  );

  const nextStepsHtml = nextSteps
    .map(
      (step) => `
        <tr>
          <td style="padding:10px 14px;border:1px solid #bfdbfe;background:#eff6ff;border-radius:10px;">
            <p style="margin:0;font-size:13px;line-height:1.55;color:#1e40af;">${escapeHtml(step)}</p>
          </td>
        </tr>
        <tr><td style="height:10px;font-size:0;line-height:0;">&nbsp;</td></tr>`
    )
    .join('');

  const bodyHtml = `
          <tr>
            <td style="padding:16px 40px 8px;">
              <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="background:#f8fafc;border:1px solid #e2e8f0;border-radius:12px;">
                <tr>
                  <td style="padding:16px;">
                    <p style="margin:0 0 8px;font-size:13px;font-weight:600;color:#64748b;text-transform:uppercase;letter-spacing:0.03em;">Votre demande</p>
                    <p style="margin:0 0 4px;font-size:14px;color:#1d1f25;"><strong>Référence :</strong> ${escapeHtml(reservationCode)}</p>
                    <p style="margin:0 0 4px;font-size:14px;color:#1d1f25;"><strong>Organisateur :</strong> ${escapeHtml(input.organizerName)}</p>
                    <p style="margin:0;font-size:14px;color:#1d1f25;"><strong>Mode de règlement :</strong> ${escapeHtml(paymentModeLabel(input.paymentMode, input.requestKind))}</p>
                    <p style="margin:0;font-size:14px;color:#1d1f25;"><strong>Mode de règlement :</strong> ${escapeHtml(paymentModeLabel(input.paymentMode))}</p>
                  </td>
                </tr>
              </table>
            </td>
          </tr>
          <tr>
            <td style="padding:8px 40px 8px;">
              <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0">
                ${renderLinesBlock(input.lines)}
              </table>
            </td>
          </tr>
          <tr>
            <td style="padding:12px 40px 8px;">
              <p style="margin:0 0 10px;font-size:15px;font-weight:700;color:#1d1f25;">Et maintenant ?</p>
              <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0">
                ${nextStepsHtml}
              </table>
            </td>
          </tr>`;

  const html = renderEmailShell({
    eyebrow: 'Confirmation famille',
    title: 'Votre demande de réservation est bien enregistrée',
    introHtml: `Bonjour <strong>${escapeHtml(familyName || 'Madame, Monsieur')}</strong>, merci pour votre demande sur Resacolo.`,
    bodyHtml,
    ctaUrl: accountUrl,
    ctaLabel: 'Voir mon compte'
  });

  const text = [
    'Votre demande de réservation est bien enregistrée',
    `Référence : ${reservationCode}`,
    `Organisateur : ${input.organizerName}`,
    `Mode de règlement : ${paymentModeLabel(input.paymentMode, input.requestKind)}`,
    `Mode de règlement : ${paymentModeLabel(input.paymentMode)}`,
    '',
    ...input.lines.map(
      (line) =>
        `- ${line.stayTitle} | ${line.sessionLabel} | ${line.childName}${line.amountLabel ? ` | ${line.amountLabel}` : ''}`
    ),
    '',
    'Et maintenant ?',
    ...nextSteps.map((step) => `- ${step}`),
    '',
    `Mon compte : ${accountUrl}`
  ].join('\n');

  return {
    subject: `[Resacolo] Demande enregistrée — ${input.organizerName}`,
    html,
    text
  };
}

export async function sendReservationNotificationEmails(input: ReservationNotificationInput) {
  const familyMail = renderFamilyReservationEmail(input);
  const organizerMail = renderOrganizerReservationEmail(input);

  const tasks: Array<Promise<unknown>> = [
    sendSmtpEmail({
      to: input.familyEmail,
      subject: familyMail.subject,
      text: familyMail.text,
      html: familyMail.html
    }).catch((error) => {
      console.error('[reservation-notifications] family email failed', error);
    })
  ];

  const organizerEmail = input.organizerEmail?.trim().toLowerCase();
  if (organizerEmail) {
    tasks.push(
      sendSmtpEmail({
        to: organizerEmail,
        subject: organizerMail.subject,
        text: organizerMail.text,
        html: organizerMail.html
      }).catch((error) => {
        console.error('[reservation-notifications] organizer email failed', error);
      })
    );
  } else {
    console.warn('[reservation-notifications] organizer email missing', {
      organizerId: input.organizerId
    });
  }

  await Promise.all(tasks);
}
