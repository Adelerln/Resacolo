import 'server-only';

import PDFDocument from 'pdfkit';
import { readFile } from 'fs/promises';
import { RESACOLO_COMPANY, RESACOLO_INVOICE_LATE_PAYMENT_MENTIONS } from '@/lib/resacolo-company';
import { formatOrderReservationCode } from '@/lib/order-workflow';
import {
  CLIENT_TRAVEL_INVOICE_LOGO_WHITE_PATH,
  CLIENT_TRAVEL_INVOICE_RALEWAY_BOLD_PATH,
  CLIENT_TRAVEL_INVOICE_RALEWAY_REGULAR_PATH,
  formatClientTravelInvoiceNumber
} from '@/lib/mnemos/client-travel-invoice-template.server';

const BLUE = '#52b0ea';
const BLUE_SOFT = '#e8f6fc';
const ORANGE = '#fa8000';
const MUTED = '#64748b';
const INK = '#1d1f25';

type PdfKitLine = {
  label: string;
  quantity?: number;
  amountCents: number;
  children?: Array<{ name: string; dates: string }>;
};

type PdfKitPayment = {
  date: string;
  label: string;
  amountCents: number;
};

export type ClientTravelInvoicePdfKitInput = {
  invoiceNumber: number;
  invoiceYear: number;
  issuedAt: string;
  paidAt: string | null;
  isProvisional: boolean;
  orderId: string;
  organizerName: string | null;
  billingName: string;
  billingAddressLines: string[];
  billingEmail: string | null;
  paymentModeLabel: string;
  totalCents: number;
  paidCents: number;
  remainingBalanceCents: number;
  lines: PdfKitLine[];
  payments?: PdfKitPayment[];
};

function euros(cents: number) {
  const formatted = (cents / 100).toLocaleString('fr-FR', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2
  });
  return `${formatted.replace(/\u202f/g, ' ').replace(/\u00a0/g, ' ')} EUR`;
}

function formatDate(iso: string) {
  return new Date(iso).toLocaleDateString('fr-FR');
}

/**
 * Fallback fiable : PDFKit embarque correctement les TTF Raleway
 * (contrairement à l’ancien moteur PDF maison / WinAnsi brut).
 */
export async function renderClientTravelInvoicePdfKit(
  input: ClientTravelInvoicePdfKitInput
): Promise<Buffer> {
  const [regularFont, boldFont, logo] = await Promise.all([
    readFile(CLIENT_TRAVEL_INVOICE_RALEWAY_REGULAR_PATH),
    readFile(CLIENT_TRAVEL_INVOICE_RALEWAY_BOLD_PATH),
    readFile(CLIENT_TRAVEL_INVOICE_LOGO_WHITE_PATH).catch(() => null)
  ]);

  const invoiceNumber = formatClientTravelInvoiceNumber(input.invoiceYear, input.invoiceNumber);
  const docLabel = input.isProvisional ? 'Facture provisoire' : 'Facture';
  const paidAtLabel = input.paidAt
    ? formatDate(input.paidAt)
    : input.remainingBalanceCents > 0
      ? 'en attente de solde'
      : formatDate(input.issuedAt);

  const doc = new PDFDocument({
    size: 'A4',
    margin: 0,
    autoFirstPage: true,
    compress: true,
    info: {
      Title: `${docLabel} ${invoiceNumber}`,
      Author: 'Resacolo',
      Creator: 'Resacolo'
    }
  });

  const chunks: Buffer[] = [];
  doc.on('data', (chunk: Buffer) => chunks.push(chunk));
  const done = new Promise<Buffer>((resolve, reject) => {
    doc.on('end', () => resolve(Buffer.concat(chunks)));
    doc.on('error', reject);
  });

  doc.registerFont('Raleway', regularFont);
  doc.registerFont('Raleway-Bold', boldFont);

  doc.rect(0, 0, 595, 96).fill(BLUE);
  if (logo) {
    try {
      doc.image(logo, 28, 28, { width: 150 });
    } catch {
      doc.fillColor('#ffffff').font('Raleway-Bold').fontSize(22).text('RESACOLO', 28, 36);
    }
  } else {
    doc.fillColor('#ffffff').font('Raleway-Bold').fontSize(22).text('RESACOLO', 28, 36);
  }
  doc.roundedRect(430, 34, 136, 28, 6).lineWidth(1).strokeColor('#ffffff').stroke();
  doc
    .fillColor('#ffffff')
    .font('Raleway-Bold')
    .fontSize(11)
    .text(docLabel, 430, 42, { width: 136, align: 'center' });
  doc.rect(0, 96, 595, 4).fill(ORANGE);

  let y = 118;
  doc
    .fillColor(INK)
    .font('Raleway-Bold')
    .fontSize(11)
    .text(`${RESACOLO_COMPANY.legalName} ${RESACOLO_COMPANY.legalForm}`, 28, y);
  doc
    .font('Raleway')
    .fontSize(9)
    .text(RESACOLO_COMPANY.addressLine1, 28, y + 14)
    .text(`${RESACOLO_COMPANY.postalCode} ${RESACOLO_COMPANY.city.toUpperCase()}`, 28, y + 26);
  doc
    .fillColor(MUTED)
    .fontSize(8)
    .text(`SIRET ${RESACOLO_COMPANY.siret}`, 28, y + 40)
    .text(`TVA intracommunautaire ${RESACOLO_COMPANY.vatNumber}`, 28, y + 52);

  doc.fillColor(INK).font('Raleway-Bold').fontSize(11).text(input.billingName, 320, y);
  let customerY = y + 14;
  doc.font('Raleway').fontSize(9).fillColor(INK);
  for (const line of input.billingAddressLines.slice(0, 4)) {
    doc.text(line, 320, customerY, { width: 240 });
    customerY += 12;
  }
  if (input.billingEmail) {
    doc.fillColor(MUTED).fontSize(8).text(input.billingEmail, 320, customerY, { width: 240 });
  }

  y = 200;
  doc.moveTo(28, y).lineTo(567, y).strokeColor(BLUE_SOFT).lineWidth(1).stroke();

  y += 16;
  doc.fillColor(INK).font('Raleway-Bold').fontSize(15).text(`${docLabel} ${invoiceNumber}`, 28, y);
  y += 18;
  doc
    .fillColor(MUTED)
    .font('Raleway')
    .fontSize(9)
    .text(`Commande ${formatOrderReservationCode(input.orderId)}`, 28, y);
  y += 14;
  doc.fillColor(INK).text(`Date d'émission : ${formatDate(input.issuedAt)}`, 28, y);
  y += 13;
  doc.text(`Date de règlement : ${paidAtLabel}`, 28, y);
  y += 13;
  doc.text(`Mode de règlement : ${input.paymentModeLabel}`, 28, y);
  y += 13;
  if (input.organizerName) {
    doc.text(`Organisateur : ${input.organizerName}`, 28, y);
    y += 13;
  }

  y += 8;
  doc.roundedRect(28, y, 539, 24, 4).fill(BLUE_SOFT);
  doc
    .fillColor(MUTED)
    .font('Raleway')
    .fontSize(8)
    .text('Régime particulier - Agences de voyage (art. 266, 1-e du CGI)', 36, y + 8);

  y += 36;
  doc.rect(28, y, 539, 22).fill(BLUE_SOFT);
  doc
    .fillColor('#0f3a55')
    .font('Raleway-Bold')
    .fontSize(8.5)
    .text('Désignation', 36, y + 7)
    .text('Qté', 340, y + 7, { width: 30, align: 'right' })
    .text('PU TTC', 380, y + 7, { width: 70, align: 'right' })
    .text('Montant TTC', 460, y + 7, { width: 100, align: 'right' });
  y += 28;

  for (const line of input.lines) {
    const quantity = Math.max(1, line.quantity ?? 1);
    const unitCents = Math.round(line.amountCents / quantity);
    const labelHeight = doc.heightOfString(line.label, { width: 290, lineGap: 1 });
    const children = line.children ?? [];
    const rowHeight = Math.max(24, labelHeight + children.length * 11 + 10);
    if (y + rowHeight > 560) break;

    doc.moveTo(28, y - 4).lineTo(567, y - 4).strokeColor('#e8eef5').stroke();
    doc.fillColor(INK).font('Raleway-Bold').fontSize(9).text(line.label, 36, y, {
      width: 290,
      lineGap: 1
    });
    let childY = y + labelHeight + 2;
    doc.font('Raleway').fontSize(8).fillColor(MUTED);
    for (const child of children.slice(0, 4)) {
      doc.text([child.name, child.dates].filter(Boolean).join('  '), 44, childY, { width: 280 });
      childY += 11;
    }
    doc
      .fillColor(INK)
      .font('Raleway')
      .fontSize(9)
      .text(String(quantity), 340, y, { width: 30, align: 'right' })
      .text(euros(unitCents), 380, y, { width: 70, align: 'right' })
      .text(euros(line.amountCents), 460, y, { width: 100, align: 'right' });
    y += rowHeight;
  }

  const payments = input.payments ?? [];
  const summaryHasPaid = input.paidCents > 0;
  const summaryHasBalance = input.remainingBalanceCents > 0;
  const paymentRows = Math.max(1, Math.min(payments.length, 6));
  const payBoxH = 42 + paymentRows * 14;
  const summaryHeight = 36 + (summaryHasPaid ? 16 : 0) + (summaryHasBalance ? 18 : 0);
  const blocksTop = 600;
  const blocksH = Math.max(payBoxH, summaryHeight);

  doc.roundedRect(28, blocksTop, 290, blocksH, 4).strokeColor('#d7eaf5').lineWidth(1).stroke();
  doc.rect(28, blocksTop, 290, 3).fill(BLUE);
  let payY = blocksTop + 12;
  doc.fillColor('#0f3a55').font('Raleway-Bold').fontSize(10).text('Récapitulatif des paiements', 38, payY);
  payY += 16;
  doc.fillColor(MUTED).font('Raleway-Bold').fontSize(7.5);
  doc.text('Date', 38, payY);
  doc.text('Mode', 100, payY);
  doc.text('Montant', 200, payY, { width: 100, align: 'right' });
  payY += 12;
  doc.font('Raleway').fontSize(8);
  if (payments.length === 0) {
    doc.fillColor(MUTED).text('Aucun paiement enregistré', 38, payY);
  } else {
    for (const payment of payments.slice(0, 6)) {
      doc.fillColor(INK).text(payment.date, 38, payY);
      doc.text(payment.label.slice(0, 28), 100, payY, { width: 95 });
      doc.text(euros(payment.amountCents), 200, payY, { width: 100, align: 'right' });
      payY += 14;
    }
  }

  doc.roundedRect(336, blocksTop, 231, blocksH, 4).fill(BLUE);
  let summaryY = blocksTop + 14;
  doc.fillColor('#ffffff').font('Raleway-Bold').fontSize(11);
  doc.text('TOTAL TTC', 348, summaryY);
  doc.text(euros(input.totalCents), 348, summaryY, { width: 207, align: 'right' });
  summaryY += 18;
  if (summaryHasPaid) {
    doc.font('Raleway').fontSize(9);
    doc.text('Déjà réglé', 348, summaryY);
    doc.text(euros(input.paidCents), 348, summaryY, { width: 207, align: 'right' });
    summaryY += 16;
  }
  if (summaryHasBalance) {
    doc.font('Raleway-Bold').fontSize(11);
    doc.text('RESTANT DÛ', 348, summaryY);
    doc.text(euros(input.remainingBalanceCents), 348, summaryY, { width: 207, align: 'right' });
  }

  doc.moveTo(28, 780).lineTo(567, 780).strokeColor(BLUE_SOFT).stroke();
  doc.fillColor(MUTED).font('Raleway').fontSize(6.5);
  doc.text(RESACOLO_INVOICE_LATE_PAYMENT_MENTIONS[0], 28, 788, { width: 539 });
  doc.text(RESACOLO_INVOICE_LATE_PAYMENT_MENTIONS[1], 28, 800, { width: 539 });
  doc.fontSize(7).text(
    `${RESACOLO_COMPANY.legalName}, ${RESACOLO_COMPANY.legalForm} au capital de ${RESACOLO_COMPANY.shareCapitalLabel}, ${RESACOLO_COMPANY.addressLine1}, ${RESACOLO_COMPANY.postalCode} ${RESACOLO_COMPANY.city.toUpperCase()}`,
    28,
    814,
    { width: 539 }
  );

  doc.end();
  return done;
}
