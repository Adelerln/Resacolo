/**
 * Génère des PDF d'exemple de factures via Playwright (HTML → PDF).
 * Template unique : Raleway + logo + charte orange/bleu.
 * Run: node scripts/generate-invoice-examples.mjs
 */
import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { chromium } from 'playwright';

const __dirname = dirname(fileURLToPath(import.meta.url));
const rootDir = join(__dirname, '..');
const outDir = join(rootDir, 'public/docs/exemples-factures');
const ralewayRegularPath = join(rootDir, 'public/fonts/Raleway-Regular.ttf');
const ralewayBoldPath = join(rootDir, 'public/fonts/Raleway-Bold.ttf');
const logoWhitePath = join(
  rootDir,
  'public/image/footer/logo_footer/logo-resacolo-RVB-blanc_logo-final copie 2.png'
);

const ORANGE = '#fa8000';
const BLUE = '#52b0ea';
const BLUE_SOFT = '#e8f6fc';
const VAT_MENTION = 'Régime particulier - Agences de voyage (art. 266, 1-e du CGI)';

let ralewayRegularDataUrl = '';
let ralewayBoldDataUrl = '';
let logoDataUrl = '';

async function loadAssets() {
  const [regular, bold, logo] = await Promise.all([
    readFile(ralewayRegularPath),
    readFile(ralewayBoldPath),
    readFile(logoWhitePath)
  ]);
  ralewayRegularDataUrl = `data:font/ttf;base64,${regular.toString('base64')}`;
  ralewayBoldDataUrl = `data:font/ttf;base64,${bold.toString('base64')}`;
  logoDataUrl = `data:image/png;base64,${logo.toString('base64')}`;
}

function euros(cents) {
  return `${(cents / 100)
    .toLocaleString('fr-FR', {
      minimumFractionDigits: 2,
      maximumFractionDigits: 2
    })
    .replace(/[\u202f\u00a0]/g, ' ')} EUR`;
}

function escapeHtml(value) {
  return String(value)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

function renderLinesHtml(lines) {
  return lines
    .map((line) => {
      const qty = line.quantity ?? 1;
      const unitCents = Math.round(line.amountCents / qty);
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

function buildInvoiceHtml(sample) {
  const docLabel = sample.docLabel || 'Facture';
  const payments = sample.payments?.length ? sample.payments : [];
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

  return `<!DOCTYPE html>
<html lang="fr">
<head>
  <meta charset="utf-8" />
  <style>
    @font-face {
      font-family: 'Raleway';
      src: url('${ralewayRegularDataUrl}') format('truetype');
      font-weight: 400;
      font-style: normal;
    }
    @font-face {
      font-family: 'Raleway';
      src: url('${ralewayBoldDataUrl}') format('truetype');
      font-weight: 700;
      font-style: normal;
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
    <img class="logo" src="${logoDataUrl}" alt="Resacolo" />
    <div class="doc">${escapeHtml(docLabel)}</div>
  </div>
  <div class="accent-bar"></div>
  <div class="page">
    <div class="page-body">
    <div class="eyebrow">EXEMPLE : ${escapeHtml(sample.scenario)}</div>
    <div class="parties">
      <div>
        <strong>Resacolo SAS</strong>
        <div>24/26 rue Bichat</div>
        <div>75010 PARIS</div>
        <div class="small">SIRET 904 862 158 00014</div>
        <div class="small">TVA intracommunautaire FR67904862158</div>
      </div>
      <div>
        <strong>${escapeHtml(sample.billingName)}</strong>
        ${sample.billingAddressLines.map((l) => `<div>${escapeHtml(l)}</div>`).join('')}
        <div class="small">${escapeHtml(sample.billingEmail)}</div>
      </div>
    </div>
    <hr />
    <h1>${escapeHtml(docLabel)} ${escapeHtml(sample.invoiceNumber)}</h1>
    <div class="meta muted">Commande ${escapeHtml(sample.orderCode)}</div>
    ${
      sample.creditOfInvoice
        ? `<div class="avoir-ref">Avoir relatif à la facture ${escapeHtml(sample.creditOfInvoice)}</div>`
        : ''
    }
    <div class="meta">
      <div>Date d'émission : ${escapeHtml(sample.issuedAt)}</div>
      <div>Date de règlement : ${escapeHtml(sample.paidAtLabel)}</div>
      <div>Mode de règlement : ${escapeHtml(sample.paymentModeLabel)}</div>
      <div>Organisateur : ${escapeHtml(sample.organizerName)}</div>
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
      <tbody>${renderLinesHtml(sample.lines)}</tbody>
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
        <div class="row strong"><span>TOTAL TTC</span><span>${escapeHtml(euros(sample.totalCents))}</span></div>
        ${
          sample.paidCents > 0
            ? `<div class="row"><span>Déjà réglé</span><span>${escapeHtml(euros(sample.paidCents))}</span></div>`
            : ''
        }
        ${
          sample.remainingBalanceCents > 0
            ? `<div class="row strong"><span>RESTANT DÛ</span><span>${escapeHtml(euros(sample.remainingBalanceCents))}</span></div>`
            : ''
        }
        ${
          sample.avoirState === 'pending'
            ? `<div class="row strong"><span>À rembourser</span><span>${escapeHtml(euros(Math.abs(sample.totalCents)))}</span></div>`
            : ''
        }
        ${
          sample.avoirState === 'settled'
            ? `<div class="row strong"><span>Soldé</span><span>0,00 EUR</span></div>`
            : ''
        }
      </div>
    </div>
    </div>
    <div class="page-foot">
      <div class="footer">
        Document d'exemple fictif, non comptable. Resacolo<br />
        SAS au capital de 1 000 EUR, 24/26 rue Bichat 75010 PARIS, SIRET 904 862 158 00014<br />
        Numéro de TVA intracommunautaire : FR67904862158<br />
        Numéro d'immatriculation Atout France : IM075220017<br />
        Assureur : HISCOX SA, 49 AVENUE DE L'OPÉRA, 75002 PARIS, FRANCE
      </div>
    </div>
  </div>
  </div>
</body>
</html>`;
}

async function buildInvoicePdf(sample, browser) {
  const page = await browser.newPage();
  await page.setContent(buildInvoiceHtml(sample), { waitUntil: 'networkidle' });
  await page.evaluate(async () => {
    if (document.fonts?.ready) await document.fonts.ready;
  });
  const pdf = await page.pdf({
    format: 'A4',
    printBackground: true,
    margin: { top: '0', right: '0', bottom: '0', left: '0' }
  });
  await page.close();
  return pdf;
}

const alpesStay = {
  label: 'Colonie Eté Alpes',
  quantity: 2,
  amountCents: 200_000,
  children: [
    { name: 'Léo MARTIN', dates: '05/07/2026 au 19/07/2026' },
    { name: 'Emma MARTIN', dates: '05/07/2026 au 19/07/2026' }
  ]
};

const bretagneStay = {
  label: 'Colonie Mer Bretagne',
  quantity: 1,
  amountCents: 85_000,
  children: [{ name: 'Noah DUPONT', dates: '12/08/2026 au 26/08/2026' }]
};

const stayLines = [alpesStay, bretagneStay];
const GROSS = 285_000;

const base = {
  billingName: 'Camille Dupont',
  billingAddressLines: ['12 rue des Lilas', '69003 Lyon', 'France'],
  billingEmail: 'camille.dupont@email.fr',
  organizerName: 'Les Colos du Soleil',
  issuedAt: '15/03/2026',
  orderCode: 'R-26-DEMO'
};

const samples = [
  {
    id: '01-cb-totalite',
    title: 'CB totalité',
    scenario: 'CB totalité (FULL)',
    invoiceNumber: '26-C01-0001',
    paymentModeLabel: 'Paiement de la totalité en CB',
    paidAtLabel: '10/05/2026',
    lines: stayLines,
    payments: [
      { date: '15/03/2026', label: 'Acompte CB', amountCents: 20_000 },
      { date: '10/05/2026', label: 'Solde CB', amountCents: 265_000 }
    ],
    totalCents: GROSS,
    paidCents: GROSS,
    remainingBalanceCents: 0,
    ...base
  },
  {
    id: '02-cb-acompte',
    title: 'CB acompte',
    scenario: 'CB acompte 200 EUR, solde en attente',
    invoiceNumber: '26-C01-0002',
    paymentModeLabel: "Paiement d'un acompte (200 EUR) en CB",
    paidAtLabel: 'en attente de solde',
    lines: stayLines,
    payments: [{ date: '15/03/2026', label: 'Acompte CB', amountCents: 20_000 }],
    totalCents: GROSS,
    paidCents: 20_000,
    remainingBalanceCents: GROSS - 20_000,
    ...base
  },
  {
    id: '03-cb-acompte-puis-solde',
    title: 'CB acompte + solde',
    scenario: 'CB acompte puis solde réglé',
    invoiceNumber: '26-C01-0003',
    paymentModeLabel: "Paiement d'un acompte (200 EUR) en CB",
    paidAtLabel: '10/05/2026',
    lines: stayLines,
    payments: [
      { date: '15/03/2026', label: 'Acompte CB', amountCents: 20_000 },
      { date: '10/05/2026', label: 'Solde CB', amountCents: GROSS - 20_000 }
    ],
    totalCents: GROSS,
    paidCents: GROSS,
    remainingBalanceCents: 0,
    ...base
  },
  {
    id: '04-partenaire',
    title: 'Partenaire + CB',
    scenario: 'Prise en charge partenaire + CB famille',
    invoiceNumber: '26-C01-0004',
    paymentModeLabel: 'Paiement de la totalité en CB',
    paidAtLabel: '15/03/2026',
    lines: [
      ...stayLines,
      { label: 'Prise en charge partenaire - CSE Exemple', quantity: 1, amountCents: -90_000 }
    ],
    payments: [{ date: '15/03/2026', label: 'CB famille', amountCents: 195_000 }],
    totalCents: 195_000,
    paidCents: 195_000,
    remainingBalanceCents: 0,
    ...base
  },
  {
    id: '05-vacaf',
    title: 'VACAF + CB',
    scenario: 'Aide VACAF + CB',
    invoiceNumber: '26-C01-0005',
    paymentModeLabel: 'Paiement de la totalité en CB',
    paidAtLabel: '20/03/2026',
    lines: [...stayLines, { label: 'Aide VACAF', quantity: 1, amountCents: -60_000 }],
    payments: [{ date: '20/03/2026', label: 'CB famille', amountCents: 225_000 }],
    totalCents: 225_000,
    paidCents: 225_000,
    remainingBalanceCents: 0,
    ...base
  },
  {
    id: '06-ancv-connect',
    title: 'ANCV Connect + CB',
    scenario: 'ANCV Connect (250 EUR) + CB reste',
    invoiceNumber: '26-C01-0006',
    paymentModeLabel: 'Paiement en ANCV Connect',
    paidAtLabel: '18/03/2026',
    lines: stayLines,
    payments: [
      { date: '18/03/2026', label: 'ANCV Connect', amountCents: 25_000 },
      { date: '18/03/2026', label: 'CB complément', amountCents: 260_000 }
    ],
    totalCents: GROSS,
    paidCents: GROSS,
    remainingBalanceCents: 0,
    ...base
  },
  {
    id: '07-ancv-papier',
    title: 'ANCV papier + CB',
    scenario: 'ANCV papier + complément CB',
    invoiceNumber: '26-C01-0007',
    paymentModeLabel: 'Paiement en ANCV papier',
    paidAtLabel: '22/03/2026',
    lines: stayLines,
    payments: [
      { date: '22/03/2026', label: 'ANCV papier', amountCents: 30_000 },
      { date: '22/03/2026', label: 'CB complément', amountCents: 255_000 }
    ],
    totalCents: GROSS,
    paidCents: GROSS,
    remainingBalanceCents: 0,
    ...base
  },
  {
    id: '08-melange-partenaire-vacaf-acompte',
    title: 'Mélange partenaire + VACAF + acompte',
    scenario: 'Partenaire + VACAF + acompte CB (solde restant)',
    invoiceNumber: '26-C01-0008',
    paymentModeLabel: "Paiement d'un acompte (200 EUR) en CB",
    paidAtLabel: 'en attente de solde',
    lines: [
      ...stayLines,
      { label: 'Prise en charge partenaire - CSE Exemple', quantity: 1, amountCents: -50_000 },
      { label: 'Aide VACAF', quantity: 1, amountCents: -40_000 }
    ],
    payments: [{ date: '15/03/2026', label: 'Acompte CB', amountCents: 20_000 }],
    totalCents: 195_000,
    paidCents: 20_000,
    remainingBalanceCents: 175_000,
    ...base
  },
  {
    id: '09-melange-complet',
    title: 'Mélange complet soldé',
    scenario: 'Partenaire + VACAF + ANCV + CB solde',
    invoiceNumber: '26-C01-0009',
    paymentModeLabel: 'Paiement en ANCV Connect',
    paidAtLabel: '01/06/2026',
    lines: [
      ...stayLines,
      { label: 'Prise en charge partenaire - Mairie Exemple', quantity: 1, amountCents: -70_000 },
      { label: 'Aide VACAF', quantity: 1, amountCents: -50_000 }
    ],
    payments: [
      { date: '15/03/2026', label: 'Acompte CB', amountCents: 20_000 },
      { date: '01/06/2026', label: 'ANCV Connect', amountCents: 25_000 },
      { date: '01/06/2026', label: 'Solde CB', amountCents: 120_000 }
    ],
    totalCents: 165_000,
    paidCents: 165_000,
    remainingBalanceCents: 0,
    ...base
  },
  {
    id: '10-avoir-a-rembourser',
    title: 'Avoir à rembourser',
    scenario: 'Avoir émis, remboursement pas encore effectué',
    docLabel: 'Avoir',
    creditOfInvoice: '26-C01-0001',
    avoirState: 'pending',
    invoiceNumber: '26-A01-0001',
    paymentModeLabel: 'Remboursement CB en attente',
    paidAtLabel: 'en attente de remboursement',
    lines: [
      {
        label: 'Annulation Colonie Mer Bretagne',
        quantity: 1,
        amountCents: -85_000,
        children: [{ name: 'Noah DUPONT', dates: '12/08/2026 au 26/08/2026' }]
      }
    ],
    payments: [{ date: '10/05/2026', label: 'CB (facture initiale)', amountCents: 85_000 }],
    totalCents: -85_000,
    paidCents: 0,
    remainingBalanceCents: 0,
    ...base,
    issuedAt: '12/06/2026'
  },
  {
    id: '11-avoir-solde',
    title: 'Avoir soldé',
    scenario: 'Avoir + remboursement effectué',
    docLabel: 'Avoir',
    creditOfInvoice: '26-C01-0001',
    avoirState: 'settled',
    invoiceNumber: '26-A01-0002',
    paymentModeLabel: 'Remboursement CB effectué',
    paidAtLabel: '15/06/2026',
    lines: [
      {
        label: 'Annulation Colonie Mer Bretagne',
        quantity: 1,
        amountCents: -85_000,
        children: [{ name: 'Noah DUPONT', dates: '12/08/2026 au 26/08/2026' }]
      }
    ],
    payments: [
      { date: '10/05/2026', label: 'CB (facture initiale)', amountCents: 85_000 },
      { date: '15/06/2026', label: 'Remboursement CB', amountCents: -85_000 }
    ],
    totalCents: -85_000,
    paidCents: 0,
    remainingBalanceCents: 0,
    ...base,
    issuedAt: '12/06/2026'
  }
];

async function main() {
  await mkdir(outDir, { recursive: true });
  await loadAssets();
  const links = [];
  const browser = await chromium.launch({ headless: true });

  try {
    for (const sample of samples) {
      const pdf = await buildInvoicePdf(sample, browser);
      const pdfName = `${sample.id}.pdf`;
      await writeFile(join(outDir, pdfName), pdf);
      links.push(sample);
      console.log('OK', pdfName);
    }
  } finally {
    await browser.close();
  }

  const index = `<!DOCTYPE html>
<html lang="fr">
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1" />
  <title>Exemples de factures Resacolo</title>
  <style>
    body { font-family: system-ui, -apple-system, sans-serif; max-width: 860px; margin: 40px auto; padding: 0 20px; color: #0f172a; background: #f8fafc; }
    h1 { font-size: 1.75rem; margin-bottom: 0.4rem; }
    .lead { color: #475569; margin-bottom: 1.5rem; }
    .note { background: #e8f6fc; border: 1px solid #52b0ea; padding: 12px 14px; border-radius: 12px; margin-bottom: 1.5rem; }
    .card { background: #fff; border: 1px solid #e2e8f0; border-radius: 14px; padding: 16px 18px; margin: 12px 0; box-shadow: 0 8px 24px -20px rgba(15,23,42,.45); }
    .card strong { display: block; font-size: 1.05rem; margin-bottom: 4px; }
    .card span { color: #64748b; font-size: 0.92rem; }
    .card a { display: inline-block; margin-top: 10px; color: #0369a1; font-weight: 600; }
  </style>
</head>
<body>
  <h1>Exemples de factures / avoirs</h1>
  <p class="lead">Template unique Raleway, logo, charte orange/bleu, sous-lignes enfants.</p>
  <div class="note">Tous les PDF partagent le même template. Recharge sans cache si besoin.</div>
  ${links
    .map(
      (s) => `<div class="card">
    <strong>${escapeHtml(s.title)}</strong>
    <span>${escapeHtml(s.scenario)}</span><br />
    <a href="./${s.id}.pdf" target="_blank" rel="noopener">Ouvrir le PDF</a>
  </div>`
    )
    .join('\n')}
</body>
</html>`;

  await writeFile(join(outDir, 'index.html'), index, 'utf8');
  console.log('Index:', join(outDir, 'index.html'));
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
