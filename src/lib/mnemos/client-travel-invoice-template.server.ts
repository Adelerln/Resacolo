import 'server-only';

import { readFile } from 'fs/promises';
import { join } from 'path';
import { pathToFileURL } from 'url';
import { RESACOLO_COMPANY, RESACOLO_INVOICE_LATE_PAYMENT_MENTIONS } from '@/lib/resacolo-company';
import { formatOrderReservationCode } from '@/lib/order-workflow';

const ORANGE = '#fa8000';
const BLUE = '#52b0ea';
const BLUE_SOFT = '#e8f6fc';
const VAT_MENTION = 'Régime particulier - Agences de voyage (art. 266, 1-e du CGI)';

export const CLIENT_TRAVEL_INVOICE_RALEWAY_REGULAR_PATH = join(
  process.cwd(),
  'public/fonts/Raleway-Regular.ttf'
);
export const CLIENT_TRAVEL_INVOICE_RALEWAY_BOLD_PATH = join(
  process.cwd(),
  'public/fonts/Raleway-Bold.ttf'
);
export const CLIENT_TRAVEL_INVOICE_LOGO_WHITE_PATH = join(
  process.cwd(),
  'public/image/footer/logo_footer/logo-resacolo-RVB-blanc_logo-final copie 2.png'
);

export type ClientTravelInvoiceTemplateChild = {
  name: string;
  dates: string;
};

export type ClientTravelInvoiceTemplateLine = {
  label: string;
  quantity?: number;
  amountCents: number;
  hideQty?: boolean;
  children?: ClientTravelInvoiceTemplateChild[];
};

export type ClientTravelInvoiceTemplatePayment = {
  date: string;
  label: string;
  amountCents: number;
};

export type ClientTravelInvoiceTemplateInput = {
  docLabel?: string;
  invoiceNumber: string;
  orderId: string;
  issuedAtLabel: string;
  paidAtLabel: string;
  paymentModeLabel: string;
  organizerName: string | null;
  billingName: string;
  billingAddressLines: string[];
  billingEmail: string | null;
  lines: ClientTravelInvoiceTemplateLine[];
  payments: ClientTravelInvoiceTemplatePayment[];
  totalCents: number;
  paidCents: number;
  remainingBalanceCents: number;
  /** Avoir relatif à une facture (ex. 26-C01-0001). */
  creditOfInvoice?: string | null;
  /** pending = à rembourser, settled = soldé. */
  avoirState?: 'pending' | 'settled' | null;
  isProvisional?: boolean;
};

function euros(cents: number) {
  return `${(cents / 100)
    .toLocaleString('fr-FR', {
      minimumFractionDigits: 2,
      maximumFractionDigits: 2
    })
    .replace(/[\u202f\u00a0]/g, ' ')} EUR`;
}

function escapeHtml(value: string) {
  return String(value)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

function renderLinesHtml(lines: ClientTravelInvoiceTemplateLine[]) {
  return lines
    .map((line) => {
      const qty = line.quantity ?? 1;
      const unitCents = qty !== 0 ? Math.round(line.amountCents / qty) : line.amountCents;
      const children = line.children?.length
        ? `<ul class="children">${line.children
            .map(
              (child) =>
                `<li><span class="child-name">${escapeHtml(child.name)}</span> <span class="child-dates">${escapeHtml(child.dates)}</span></li>`
            )
            .join('')}</ul>`
        : '';

      return `<tr class="${line.amountCents < 0 ? 'deduction' : ''}">
        <td>
          <div class="line-label">${escapeHtml(line.label)}</div>
          ${children}
        </td>
        <td class="num">${line.hideQty ? '' : qty}</td>
        <td class="num">${line.hideQty ? '' : escapeHtml(euros(unitCents))}</td>
        <td class="num">${escapeHtml(euros(line.amountCents))}</td>
      </tr>`;
    })
    .join('');
}

async function loadTemplateAssets(mode: 'data' | 'file' = 'file') {
  const [regular, bold, logo] = await Promise.all([
    readFile(CLIENT_TRAVEL_INVOICE_RALEWAY_REGULAR_PATH),
    readFile(CLIENT_TRAVEL_INVOICE_RALEWAY_BOLD_PATH),
    readFile(CLIENT_TRAVEL_INVOICE_LOGO_WHITE_PATH)
  ]);

  if (mode === 'data') {
    return {
      ralewayRegularUrl: `data:font/ttf;base64,${regular.toString('base64')}`,
      ralewayBoldUrl: `data:font/ttf;base64,${bold.toString('base64')}`,
      logoUrl: `data:image/png;base64,${logo.toString('base64')}`
    };
  }

  // file:// : Chromium embarque correctement Raleway dans le PDF (contrairement aux data: seuls).
  return {
    ralewayRegularUrl: pathToFileURL(CLIENT_TRAVEL_INVOICE_RALEWAY_REGULAR_PATH).href,
    ralewayBoldUrl: pathToFileURL(CLIENT_TRAVEL_INVOICE_RALEWAY_BOLD_PATH).href,
    logoUrl: pathToFileURL(CLIENT_TRAVEL_INVOICE_LOGO_WHITE_PATH).href
  };
}

export function formatClientTravelInvoiceNumber(year: number, number: number, kind: 'invoice' | 'credit' = 'invoice') {
  const yy = String(year).slice(2);
  const series = kind === 'credit' ? 'A01' : 'C01';
  return `${yy}-${series}-${String(number).padStart(4, '0')}`;
}

export async function buildClientTravelInvoiceHtml(
  input: ClientTravelInvoiceTemplateInput,
  options?: { assetMode?: 'data' | 'file' }
) {
  const assets = await loadTemplateAssets(options?.assetMode ?? 'file');
  const docLabel = input.docLabel || (input.avoirState ? 'Avoir' : 'Facture');
  const payments = input.payments ?? [];
  const paymentsHtml = payments.length
    ? payments
        .map(
          (p) => `<tr>
        <td>${escapeHtml(p.date)}</td>
        <td>${escapeHtml(p.label)}</td>
        <td class="num">${escapeHtml(euros(p.amountCents))}</td>
      </tr>`
        )
        .join('')
    : `<tr><td colspan="3" class="muted">Aucun paiement enregistré</td></tr>`;

  const orderCode = formatOrderReservationCode(input.orderId);
  const cityLine = `${RESACOLO_COMPANY.postalCode} ${RESACOLO_COMPANY.city.toUpperCase()}`;

  return `<!DOCTYPE html>
<html lang="fr">
<head>
  <meta charset="utf-8" />
  <style>
    @font-face {
      font-family: 'Raleway';
      src: url('${assets.ralewayRegularUrl}') format('truetype');
      font-weight: 400;
      font-style: normal;
      font-display: block;
    }
    @font-face {
      font-family: 'Raleway';
      src: url('${assets.ralewayBoldUrl}') format('truetype');
      font-weight: 700;
      font-style: normal;
      font-display: block;
    }
    * { box-sizing: border-box; }
    html, body {
      margin: 0;
      padding: 0;
      width: 210mm;
      height: 297mm;
      font-family: 'Raleway', Helvetica, Arial, sans-serif;
      color: #1d1f25;
      font-size: 11px;
      -webkit-print-color-adjust: exact;
      print-color-adjust: exact;
    }
    .sheet {
      display: flex;
      flex-direction: column;
      min-height: 297mm;
      height: 297mm;
    }
    .banner {
      background: ${BLUE};
      color: #fff;
      padding: 16px 28px;
      display: flex;
      justify-content: space-between;
      align-items: center;
      flex-shrink: 0;
    }
    .banner .logo { height: 64px; width: auto; display: block; }
    .banner .doc {
      font-size: 16px;
      font-weight: 700;
      letter-spacing: 0.02em;
      padding: 6px 12px;
      border: 1.5px solid rgba(255,255,255,0.55);
      border-radius: 8px;
      background: rgba(255,255,255,0.12);
    }
    .accent-bar {
      height: 4px;
      background: ${ORANGE};
      flex-shrink: 0;
    }
    .page {
      flex: 1;
      display: flex;
      flex-direction: column;
      padding: 18px 28px 14px;
      min-height: 0;
    }
    .page-body { flex: 1 1 auto; }
    .eyebrow {
      color: ${BLUE};
      font-size: 11px;
      font-weight: 700;
      margin-bottom: 12px;
    }
    .parties {
      display: flex;
      justify-content: space-between;
      gap: 24px;
      margin-bottom: 12px;
    }
    .parties strong { display: block; font-size: 13px; margin-bottom: 4px; color: #0f172a; }
    .muted { color: #64748b; }
    .small { font-size: 10px; color: #64748b; }
    hr {
      border: none;
      border-top: 2px solid ${BLUE_SOFT};
      margin: 12px 0;
    }
    h1 { font-size: 18px; margin: 0 0 4px; color: #0f172a; }
    .meta { line-height: 1.55; margin-bottom: 8px; }
    .vat {
      font-size: 10px;
      color: #475569;
      margin: 8px 0 12px;
      padding: 8px 10px;
      background: ${BLUE_SOFT};
      border-left: 3px solid ${BLUE};
      border-radius: 0 6px 6px 0;
    }
    table.lines { width: 100%; border-collapse: collapse; margin-bottom: 20px; }
    table.lines th {
      background: ${BLUE_SOFT};
      border-bottom: 2px solid ${BLUE};
      text-align: left;
      padding: 8px 10px;
      font-size: 10px;
      color: #0f3a55;
    }
    table.lines th.num, table.lines td.num { text-align: right; white-space: nowrap; }
    table.lines td {
      border-bottom: 1px solid #e8edf3;
      padding: 9px 10px;
      vertical-align: top;
    }
    table.lines tr.deduction td { color: #475569; }
    .line-label { font-weight: 700; }
    ul.children {
      list-style: none;
      margin: 6px 0 0;
      padding: 0 0 0 12px;
      border-left: 2px solid ${BLUE};
    }
    ul.children li {
      font-size: 10px;
      color: #475569;
      padding: 2px 0 2px 8px;
      font-weight: 400;
    }
    .child-name { font-weight: 600; color: #1d1f25; }
    .child-dates { color: #64748b; }
    .bottom { display: flex; justify-content: space-between; gap: 18px; align-items: flex-start; }
    .payments {
      width: 52%;
      background: #fff;
      border: 1px solid #d7eaf5;
      border-top: 3px solid ${BLUE};
      border-radius: 6px;
      padding: 10px 12px;
    }
    .payments h2 { font-size: 12px; margin: 0 0 8px; color: #0f3a55; }
    .payments table { width: 100%; border-collapse: collapse; }
    .payments th { text-align: left; font-size: 9px; color: #64748b; padding: 0 0 6px; }
    .payments th.num, .payments td.num { text-align: right; }
    .payments td { padding: 4px 0; font-size: 10px; border-bottom: 1px solid #f1f5f9; }
    .totals {
      width: 40%;
      background: ${BLUE};
      color: #fff;
      border-radius: 8px;
      padding: 14px 16px;
    }
    .totals .row { display: flex; justify-content: space-between; margin-bottom: 8px; }
    .totals .row.strong { font-weight: 700; font-size: 13px; }
    .page-foot {
      flex-shrink: 0;
      margin-top: auto;
      padding-top: 16px;
    }
    .footer {
      padding-top: 10px;
      border-top: 2px solid ${BLUE_SOFT};
      font-size: 8.5px;
      color: #64748b;
      line-height: 1.55;
      text-align: center;
    }
    .avoir-ref {
      margin: 0 0 10px;
      font-size: 11px;
      color: #0f3a55;
      font-weight: 600;
    }
  </style>
</head>
<body>
  <div class="sheet">
  <div class="banner">
    <img class="logo" src="${assets.logoUrl}" alt="Resacolo" />
    <div class="doc">${escapeHtml(docLabel)}${input.isProvisional ? ' provisoire' : ''}</div>
  </div>
  <div class="accent-bar"></div>
  <div class="page">
    <div class="page-body">
    <div class="parties">
      <div>
        <strong>${escapeHtml(RESACOLO_COMPANY.legalName)} ${escapeHtml(RESACOLO_COMPANY.legalForm)}</strong>
        <div>${escapeHtml(RESACOLO_COMPANY.addressLine1)}</div>
        <div>${escapeHtml(cityLine)}</div>
        <div class="small">SIRET ${escapeHtml(RESACOLO_COMPANY.siret)}</div>
        <div class="small">TVA intracommunautaire ${escapeHtml(RESACOLO_COMPANY.vatNumber)}</div>
      </div>
      <div>
        <strong>${escapeHtml(input.billingName)}</strong>
        ${input.billingAddressLines.map((line) => `<div>${escapeHtml(line)}</div>`).join('')}
        ${input.billingEmail ? `<div class="small">${escapeHtml(input.billingEmail)}</div>` : ''}
      </div>
    </div>
    <hr />
    <h1>${escapeHtml(docLabel)} ${escapeHtml(input.invoiceNumber)}</h1>
    <div class="meta muted">Commande ${escapeHtml(orderCode)}</div>
    ${
      input.creditOfInvoice
        ? `<div class="avoir-ref">Avoir relatif à la facture ${escapeHtml(input.creditOfInvoice)}</div>`
        : ''
    }
    <div class="meta">
      <div>Date d'émission : ${escapeHtml(input.issuedAtLabel)}</div>
      <div>Date de règlement : ${escapeHtml(input.paidAtLabel)}</div>
      <div>Mode de règlement : ${escapeHtml(input.paymentModeLabel)}</div>
      ${input.organizerName ? `<div>Organisateur : ${escapeHtml(input.organizerName)}</div>` : ''}
    </div>
    <div class="vat">${escapeHtml(VAT_MENTION)}</div>
    <table class="lines">
      <thead>
        <tr>
          <th>Désignation</th>
          <th class="num">Qté</th>
          <th class="num">PU TTC</th>
          <th class="num">Montant TTC</th>
        </tr>
      </thead>
      <tbody>${renderLinesHtml(input.lines)}</tbody>
    </table>
    <div class="bottom">
      <div class="payments">
        <h2>Récapitulatif des paiements</h2>
        <table>
          <thead>
            <tr>
              <th>Date</th>
              <th>Mode</th>
              <th class="num">Montant</th>
            </tr>
          </thead>
          <tbody>${paymentsHtml}</tbody>
        </table>
      </div>
      <div class="totals">
        <div class="row strong"><span>TOTAL TTC</span><span>${escapeHtml(euros(input.totalCents))}</span></div>
        ${
          input.paidCents > 0
            ? `<div class="row"><span>Déjà réglé</span><span>${escapeHtml(euros(input.paidCents))}</span></div>`
            : ''
        }
        ${
          input.remainingBalanceCents > 0
            ? `<div class="row strong"><span>RESTANT DÛ</span><span>${escapeHtml(euros(input.remainingBalanceCents))}</span></div>`
            : ''
        }
        ${
          input.avoirState === 'pending'
            ? `<div class="row strong"><span>À rembourser</span><span>${escapeHtml(euros(Math.abs(input.totalCents)))}</span></div>`
            : ''
        }
        ${
          input.avoirState === 'settled'
            ? `<div class="row strong"><span>Soldé</span><span>0,00 EUR</span></div>`
            : ''
        }
      </div>
    </div>
    </div>
    <div class="page-foot">
      <div class="footer">
        ${escapeHtml(RESACOLO_INVOICE_LATE_PAYMENT_MENTIONS[0])}<br />
        ${escapeHtml(RESACOLO_INVOICE_LATE_PAYMENT_MENTIONS[1])}<br />
        ${escapeHtml(RESACOLO_COMPANY.legalName)}, ${escapeHtml(RESACOLO_COMPANY.legalForm)} au capital de ${escapeHtml(RESACOLO_COMPANY.shareCapitalLabel)}, ${escapeHtml(RESACOLO_COMPANY.addressLine1)}, ${escapeHtml(cityLine)}<br />
        RCS ${escapeHtml(RESACOLO_COMPANY.rcsCity.toUpperCase())} ${escapeHtml(RESACOLO_COMPANY.rcsNumber)} | SIRET ${escapeHtml(RESACOLO_COMPANY.siret)}<br />
        Numéro de TVA intracommunautaire : ${escapeHtml(RESACOLO_COMPANY.vatNumber)} | Numéro d'immatriculation Atout France : ${escapeHtml(RESACOLO_COMPANY.atoutFranceRegistration)}<br />
        Assureur : ${escapeHtml(RESACOLO_COMPANY.professionalInsurance.insurer)}, ${escapeHtml(RESACOLO_COMPANY.professionalInsurance.address)}
      </div>
    </div>
  </div>
  </div>
</body>
</html>`;
}
