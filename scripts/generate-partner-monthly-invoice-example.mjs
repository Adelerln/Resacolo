/**
 * Génère un exemple de facture mensuelle partenaire (même template que les factures client).
 * Run: node scripts/generate-partner-monthly-invoice-example.mjs
 */
import { mkdir, writeFile } from 'node:fs/promises';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { chromium } from 'playwright';

const __dirname = dirname(fileURLToPath(import.meta.url));
const outDir = join(__dirname, '../public/docs/exemples-factures');
const logoPath = join(__dirname, '../public/image/footer/logo_footer/logo-resacolo-RVB-blanc_logo-final copie 2.png');

function euros(cents) {
  return `${(cents / 100).toLocaleString('fr-FR', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2
  })} €`;
}

const organizers = [
  { name: 'UCPA Jeunesse', stays: 14, avgCents: 48000 },
  { name: 'Vacances Ouvertes', stays: 11, avgCents: 42000 },
  { name: 'Ligue de l’enseignement 75', stays: 9, avgCents: 39000 },
  { name: 'FFCamps', stays: 8, avgCents: 51000 },
  { name: 'Objectif Nature', stays: 5, avgCents: 56000 },
  { name: 'Autres organismes', stays: 3, avgCents: 35000 }
];

const lines = organizers.map((org) => {
  const amountCents = org.stays * org.avgCents;
  return {
    label: `Prise en charge CSE — ${org.stays} séjour${org.stays > 1 ? 's' : ''} · ${org.name} (PU moyen ${euros(org.avgCents)})`,
    amountCents
  };
});

const totalStays = organizers.reduce((sum, org) => sum + org.stays, 0);
const totalCents = lines.reduce((sum, line) => sum + line.amountCents, 0);

const LATE_PAYMENT_1 =
  'En cas de non-paiement à la date de règlement, des pénalités de retard au taux d’intérêt appliqué par la Banque centrale européenne à son opération de refinancement la plus récente majoré de 10 points de pourcentage seront exigibles le jour suivant ladite date, sans qu’un rappel soit nécessaire.';
const LATE_PAYMENT_2 = 'Indemnité forfaitaire pour frais de recouvrement : 40 €.';

const html = `<!DOCTYPE html>
<html lang="fr">
<head>
  <meta charset="utf-8" />
  <title>Facture 26-P01-0007 — Partenaire juillet 2026</title>
  <style>
    @page { size: A4; margin: 0; }
    * { box-sizing: border-box; }
    body {
      margin: 0;
      font-family: Helvetica, Arial, sans-serif;
      color: #0f172a;
      background: #cbd5e1;
    }
    .page {
      width: 210mm;
      min-height: 297mm;
      margin: 0 auto;
      background: #fff;
      position: relative;
      padding-bottom: 28mm;
    }
    .banner {
      height: 50px;
      background: #fa8000;
      color: #fff;
      display: flex;
      align-items: center;
      justify-content: space-between;
      padding: 0 36px;
    }
    .banner img { height: 28px; width: auto; display: block; }
    .banner .brand-fallback {
      font-size: 20px;
      font-weight: 700;
      letter-spacing: 0.03em;
    }
    .banner .doc-type { font-size: 13px; font-weight: 700; }
    .content { padding: 18px 36px 0; }
    .parties {
      display: grid;
      grid-template-columns: 1fr 1fr;
      gap: 24px;
      margin-top: 8px;
    }
    .company { font-size: 9.5px; line-height: 1.45; color: #334155; }
    .company strong { display: block; font-size: 10.5px; color: #0f172a; margin-bottom: 2px; }
    .customer { font-size: 9.5px; line-height: 1.45; color: #334155; }
    .customer .name { font-size: 12px; font-weight: 700; color: #0f172a; margin-bottom: 4px; }
    .divider {
      margin: 16px 0 14px;
      border: 0;
      border-top: 1px solid #e2e8f0;
    }
    .meta { font-size: 9.5px; line-height: 1.55; color: #334155; }
    .meta .title { font-size: 15px; font-weight: 700; color: #0f172a; margin-bottom: 6px; }
    .meta .sub { color: #94a3b8; }
    .vat-note { margin-top: 8px; font-size: 8px; color: #747b85; }
    table.lines {
      width: 100%;
      border-collapse: collapse;
      margin-top: 16px;
      font-size: 8.5px;
    }
    table.lines thead th {
      background: #f5f7f9;
      border: 1px solid #e2e8f0;
      text-align: left;
      padding: 8px 10px;
      font-size: 8.5px;
      font-weight: 700;
    }
    table.lines thead th.amount { text-align: right; }
    table.lines tbody td {
      border-bottom: 1px solid #ebedef;
      padding: 8px 10px;
      vertical-align: top;
    }
    table.lines tbody td.amount { text-align: right; white-space: nowrap; }
    .bottom {
      margin-top: 20px;
      display: flex;
      justify-content: flex-end;
    }
    .summary {
      width: 223px;
      background: #fa8000;
      color: #fff;
      border-radius: 4px;
      padding: 12px 16px;
    }
    .summary .row {
      display: flex;
      justify-content: space-between;
      align-items: baseline;
      font-size: 11px;
      font-weight: 700;
    }
    .summary .row.paid {
      margin-top: 12px;
      font-size: 9px;
      font-weight: 500;
    }
    .footer {
      position: absolute;
      left: 36px;
      right: 36px;
      bottom: 16px;
      border-top: 1px solid #e2e8f0;
      padding-top: 10px;
      font-size: 6.5px;
      line-height: 1.45;
      color: #595f6b;
    }
    .footer p { margin: 0 0 4px; }
  </style>
</head>
<body>
  <div class="page">
    <div class="banner">
      <img src="/image/footer/logo_footer/logo-resacolo-RVB-blanc_logo-final%20copie%202.png" alt="Resacolo" onerror="this.style.display='none';this.nextElementSibling.style.display='block';" />
      <div class="brand-fallback" style="display:none">RESACOLO</div>
      <div class="doc-type">Facture</div>
    </div>

    <div class="content">
      <div class="parties">
        <div class="company">
          <strong>RESACOLO SAS</strong>
          24/26 rue Bichat<br />
          75010 PARIS<br />
          <span style="color:#595f6b">SIRET 904 862 158 00014</span><br />
          <span style="color:#595f6b">TVA intracommunautaire FR67904862158</span>
        </div>
        <div class="customer">
          <div class="name">CSE Partenaire Test Resacolo</div>
          12 avenue des Familles<br />
          75015 PARIS<br />
          <span style="color:#595f6b">partenaire@test.resacolo.com</span>
        </div>
      </div>

      <hr class="divider" />

      <div class="meta">
        <div class="title">Facture 26-P01-0007</div>
        <div class="sub">Période juillet 2026 · ${totalStays} séjours</div>
        <div>Date d’émission : 05/08/2026</div>
        <div>Date de règlement : 20/08/2026</div>
        <div>Mode de règlement : Virement bancaire</div>
        <div>Objet : Prises en charge CSE sur les réservations de juillet 2026</div>
        <div class="vat-note">Régime particulier - Agences de voyage. TVA non détaillée sur cette facture.</div>
      </div>

      <table class="lines">
        <thead>
          <tr>
            <th>Désignation</th>
            <th class="amount">Montant TTC</th>
          </tr>
        </thead>
        <tbody>
          ${lines
            .map(
              (line) => `<tr>
            <td>${line.label}</td>
            <td class="amount">${euros(line.amountCents)}</td>
          </tr>`
            )
            .join('')}
        </tbody>
      </table>

      <div class="bottom">
        <div class="summary">
          <div class="row"><span>TOTAL TTC</span><span>${euros(totalCents)}</span></div>
          <div class="row paid"><span>RESTANT DÛ</span><span>${euros(totalCents)}</span></div>
        </div>
      </div>
    </div>

    <div class="footer">
      <p>${LATE_PAYMENT_1}</p>
      <p>${LATE_PAYMENT_2}</p>
      <p>RESACOLO, SAS au capital de 1 000 EUR, 24/26 rue Bichat, 75010 PARIS</p>
      <p>RCS PARIS 904 862 158 | SIRET 904 862 158 00014 | TVA FR67904862158 | Atout France IM075220017</p>
    </div>
  </div>
</body>
</html>`;

async function main() {
  await mkdir(outDir, { recursive: true });
  const htmlPath = join(outDir, 'facture-partenaire-juillet-2026.html');
  const pdfPath = join(outDir, 'facture-partenaire-juillet-2026.pdf');
  const indexPath = join(outDir, 'index.html');
  await writeFile(htmlPath, html, 'utf8');

  await writeFile(
    indexPath,
    `<!DOCTYPE html>
<html lang="fr">
<head>
  <meta charset="utf-8" />
  <title>Exemples de factures Resacolo</title>
  <style>
    body { font-family: system-ui, sans-serif; max-width: 720px; margin: 40px auto; padding: 0 16px; color: #0f172a; }
    a { color: #ea580c; }
    li { margin: 10px 0; }
  </style>
</head>
<body>
  <h1>Exemples de factures</h1>
  <ul>
    <li><a href="./facture-partenaire-juillet-2026.html">Facture partenaire mensuelle — juillet 2026 (50 séjours)</a></li>
    <li><a href="./facture-partenaire-juillet-2026.pdf">Même facture en PDF</a></li>
  </ul>
</body>
</html>`,
    'utf8'
  );

  try {
    const browser = await chromium.launch({ headless: true });
    const page = await browser.newPage();
    await page.goto(`file://${htmlPath}`, { waitUntil: 'networkidle' });
    await page.pdf({
      path: pdfPath,
      format: 'A4',
      printBackground: true,
      margin: { top: '0', right: '0', bottom: '0', left: '0' }
    });
    await browser.close();
    console.log(`PDF:  ${pdfPath}`);
  } catch (error) {
    console.warn('Playwright indisponible — génération PDF via Chrome système si possible.');
    console.warn(String(error?.message ?? error).split('\n')[0]);
  }

  console.log(`OK — ${totalStays} séjours, total ${euros(totalCents)}`);
  console.log(`HTML: ${htmlPath}`);
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
