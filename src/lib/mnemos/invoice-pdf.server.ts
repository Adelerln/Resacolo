import 'server-only';

import { readFile } from 'fs/promises';
import { join } from 'path';
import { deflateSync, inflateSync } from 'zlib';
import type { SupabaseClient } from '@supabase/supabase-js';
import type { Database } from '@/types/supabase';
import type { LedgerLinePreview } from './ledger-period-preview.server';

const INVOICE_PDF_BUCKET = 'invoice-pdfs';
const RESACOLO_LOGO_PATH = join(process.cwd(), 'public/image/accueil/images_accueil/logo-resacolo.png');
const RALEWAY_REGULAR_PATH = join(process.cwd(), 'public/fonts/Raleway-Regular.ttf');
const RALEWAY_BOLD_PATH = join(process.cwd(), 'public/fonts/Raleway-Bold.ttf');
const VAT_RATE = 0.2;

type MnemosInvoicePdfInput = {
  invoiceId: string;
  invoiceNumber: number;
  invoiceYear: number;
  invoiceType: 'publication' | 'commission';
  organizerName: string;
  issuedAt: string;
  periodStartIso: string;
  periodEndIso: string;
  lines: LedgerLinePreview[];
};

type PdfLine = {
  label: string;
  date: string;
  channel: string;
  totalCents: number;
  vatCents: number;
  netCents: number;
};

type PdfImage = {
  name: string;
  width: number;
  height: number;
  rgb: Buffer;
  alpha: Buffer | null;
};

type PdfFonts = {
  regular: Buffer;
  bold: Buffer;
};

function euros(cents: number) {
  return (cents / 100).toLocaleString('fr-FR', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2
  }) + ' EUR';
}

function formatDate(iso: string) {
  return new Date(iso).toLocaleDateString('fr-FR');
}

function normalizePdfText(value: string) {
  return value
    .replace(/\u2013|\u2014/g, '-')
    .replace(/\u2026/g, '...')
    .replace(/\u00a0/g, ' ');
}

function toWinAnsiOctal(char: string) {
  const code = char.codePointAt(0) ?? 63;
  const winAnsi: Record<number, number> = {
    0x20ac: 128,
    0x2018: 145,
    0x2019: 146,
    0x201c: 147,
    0x201d: 148,
    0x2022: 149
  };
  const byte = winAnsi[code] ?? (code <= 255 ? code : 63);
  return `\\${byte.toString(8).padStart(3, '0')}`;
}

function pdfText(value: string) {
  return normalizePdfText(value)
    .replace(/\\/g, '\\\\')
    .replace(/\(/g, '\\(')
    .replace(/\)/g, '\\)')
    .replace(/[^\x20-\x7e]/g, (char) => toWinAnsiOctal(char));
}

function wrapText(value: string, maxChars: number) {
  const words = normalizePdfText(value).split(/\s+/).filter(Boolean);
  const lines: string[] = [];
  let current = '';

  words.forEach((word) => {
    const next = current ? `${current} ${word}` : word;
    if (next.length > maxChars && current) {
      lines.push(current);
      current = word;
    } else {
      current = next;
    }
  });

  if (current) lines.push(current);
  return lines.length ? lines : [''];
}

class PdfPage {
  private commands: string[] = [];

  text(
    value: string,
    x: number,
    y: number,
    options?: { size?: number; font?: 'regular' | 'bold'; align?: 'left' | 'right'; color?: string }
  ) {
    const size = options?.size ?? 10;
    const font = options?.font === 'bold' ? 'F2' : 'F1';
    const color = options?.color ?? '0 0 0';
    const approxWidth = normalizePdfText(value).length * size * 0.5;
    const tx = options?.align === 'right' ? x - approxWidth : x;
    this.commands.push(`${color} rg BT /${font} ${size} Tf ${tx.toFixed(2)} ${y.toFixed(2)} Td (${pdfText(value)}) Tj ET`);
  }

  line(x1: number, y1: number, x2: number, y2: number, color = '0.82 0.86 0.91') {
    this.commands.push(`${color} RG ${x1} ${y1} m ${x2} ${y2} l S`);
  }

  rect(x: number, y: number, width: number, height: number, color: string) {
    this.commands.push(`${color} rg ${x} ${y} ${width} ${height} re f`);
  }

  strokeRect(x: number, y: number, width: number, height: number, color = '0.82 0.86 0.91') {
    this.commands.push(`${color} RG ${x} ${y} ${width} ${height} re S`);
  }

  image(name: string, x: number, y: number, width: number, height: number) {
    this.commands.push(`q ${width} 0 0 ${height} ${x} ${y} cm /${name} Do Q`);
  }

  stream() {
    return this.commands.join('\n');
  }
}

function pdfObject(body: string | Buffer) {
  return Buffer.isBuffer(body) ? body : Buffer.from(body, 'latin1');
}

function imageObject(image: PdfImage, smaskObjectId: number | null) {
  const compressed = deflateSync(image.rgb);
  const header = [
    `<< /Type /XObject /Subtype /Image /Width ${image.width} /Height ${image.height}`,
    '/ColorSpace /DeviceRGB /BitsPerComponent 8 /Filter /FlateDecode',
    smaskObjectId ? `/SMask ${smaskObjectId} 0 R` : '',
    `/Length ${compressed.length} >>\nstream\n`
  ].filter(Boolean).join(' ');
  return Buffer.concat([Buffer.from(header, 'latin1'), compressed, Buffer.from('\nendstream', 'latin1')]);
}

function alphaObject(image: PdfImage) {
  if (!image.alpha) return null;
  const compressed = deflateSync(image.alpha);
  const header = `<< /Type /XObject /Subtype /Image /Width ${image.width} /Height ${image.height} /ColorSpace /DeviceGray /BitsPerComponent 8 /Filter /FlateDecode /Length ${compressed.length} >>\nstream\n`;
  return Buffer.concat([Buffer.from(header, 'latin1'), compressed, Buffer.from('\nendstream', 'latin1')]);
}

function fontFileObject(font: Buffer) {
  const compressed = deflateSync(font);
  return Buffer.concat([
    Buffer.from(`<< /Length ${compressed.length} /Length1 ${font.length} /Filter /FlateDecode >>\nstream\n`, 'latin1'),
    compressed,
    Buffer.from('\nendstream', 'latin1')
  ]);
}

function fontDescriptorObject(fontName: string, fontFileObjectId: number) {
  return pdfObject(
    `<< /Type /FontDescriptor /FontName /${fontName} /Flags 32 /FontBBox [-220 -260 1220 1000] /ItalicAngle 0 /Ascent 930 /Descent -240 /CapHeight 720 /StemV 80 /FontFile2 ${fontFileObjectId} 0 R >>`
  );
}

function trueTypeFontObject(fontName: string, descriptorObjectId: number) {
  const widths = Array.from({ length: 224 }, () => '500').join(' ');
  return pdfObject(
    `<< /Type /Font /Subtype /TrueType /BaseFont /${fontName} /Encoding /WinAnsiEncoding /FirstChar 32 /LastChar 255 /Widths [${widths}] /FontDescriptor ${descriptorObjectId} 0 R >>`
  );
}

function buildPdf(lines: string[], images: PdfImage[] = [], fonts: PdfFonts | null = null) {
  const content = lines.join('\n');
  const objects: Buffer[] = [
    pdfObject(`<< /Length ${Buffer.byteLength(content, 'latin1')} >>\nstream\n${content}\nendstream`)
  ];
  const contentObject = 1;
  let fontRegular: number;
  let fontBold: number;

  if (fonts) {
    const regularFile = objects.push(fontFileObject(fonts.regular));
    const regularDescriptor = objects.push(fontDescriptorObject('Raleway-Regular', regularFile));
    fontRegular = objects.push(trueTypeFontObject('Raleway-Regular', regularDescriptor));
    const boldFile = objects.push(fontFileObject(fonts.bold));
    const boldDescriptor = objects.push(fontDescriptorObject('Raleway-Bold', boldFile));
    fontBold = objects.push(trueTypeFontObject('Raleway-Bold', boldDescriptor));
  } else {
    fontRegular = objects.push(pdfObject('<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica /Encoding /WinAnsiEncoding >>'));
    fontBold = objects.push(pdfObject('<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica-Bold /Encoding /WinAnsiEncoding >>'));
  }

  const imageObjectIds = new Map<string, number>();

  images.forEach((image) => {
    const alpha = alphaObject(image);
    const alphaObjectId = alpha ? objects.push(alpha) : null;
    const objectId = objects.push(imageObject(image, alphaObjectId));
    imageObjectIds.set(image.name, objectId);
  });

  const pageId = objects.length + 1;
  const pagesId = pageId + 1;
  const catalogId = pagesId + 1;
  const xObjects = Array.from(imageObjectIds.entries())
    .map(([name, objectId]) => `/${name} ${objectId} 0 R`)
    .join(' ');
  const xObjectResources = xObjects ? `/XObject << ${xObjects} >>` : '';
  objects.push(
    pdfObject(`<< /Type /Page /Parent ${pagesId} 0 R /MediaBox [0 0 595 842] /Resources << /Font << /F1 ${fontRegular} 0 R /F2 ${fontBold} 0 R >> ${xObjectResources} >> /Contents ${contentObject} 0 R >>`),
    pdfObject(`<< /Type /Pages /Kids [${pageId} 0 R] /Count 1 >>`),
    pdfObject(`<< /Type /Catalog /Pages ${pagesId} 0 R >>`)
  );

  let pdf = '%PDF-1.4\n';
  const offsets = [0];
  objects.forEach((object, index) => {
    offsets.push(Buffer.byteLength(pdf, 'latin1'));
    pdf += `${index + 1} 0 obj\n`;
    pdf += object.toString('latin1');
    pdf += '\nendobj\n';
  });
  const xrefOffset = Buffer.byteLength(pdf, 'latin1');
  pdf += `xref\n0 ${objects.length + 1}\n0000000000 65535 f \n`;
  offsets.slice(1).forEach((offset) => {
    pdf += `${String(offset).padStart(10, '0')} 00000 n \n`;
  });
  pdf += `trailer\n<< /Size ${objects.length + 1} /Root ${catalogId} 0 R >>\nstartxref\n${xrefOffset}\n%%EOF\n`;
  return Buffer.from(pdf, 'latin1');
}

function paeth(left: number, up: number, upLeft: number) {
  const p = left + up - upLeft;
  const pa = Math.abs(p - left);
  const pb = Math.abs(p - up);
  const pc = Math.abs(p - upLeft);
  if (pa <= pb && pa <= pc) return left;
  if (pb <= pc) return up;
  return upLeft;
}

function parsePngRgba(buffer: Buffer): PdfImage {
  const signature = buffer.subarray(0, 8).toString('hex');
  if (signature !== '89504e470d0a1a0a') {
    throw new Error('Logo Resacolo invalide: PNG attendu.');
  }

  let offset = 8;
  let width = 0;
  let height = 0;
  let colorType = 0;
  const idatChunks: Buffer[] = [];

  while (offset < buffer.length) {
    const length = buffer.readUInt32BE(offset);
    const type = buffer.subarray(offset + 4, offset + 8).toString('ascii');
    const data = buffer.subarray(offset + 8, offset + 8 + length);
    if (type === 'IHDR') {
      width = data.readUInt32BE(0);
      height = data.readUInt32BE(4);
      const bitDepth = data[8];
      colorType = data[9];
      if (bitDepth !== 8 || colorType !== 6) {
        throw new Error('Logo Resacolo invalide: PNG RGBA 8 bits attendu.');
      }
    } else if (type === 'IDAT') {
      idatChunks.push(data);
    } else if (type === 'IEND') {
      break;
    }
    offset += length + 12;
  }

  const inflated = inflateSync(Buffer.concat(idatChunks));
  const bytesPerPixel = 4;
  const rowLength = width * bytesPerPixel;
  const rgba = Buffer.alloc(width * height * bytesPerPixel);
  let sourceOffset = 0;

  for (let row = 0; row < height; row += 1) {
    const filter = inflated[sourceOffset];
    sourceOffset += 1;
    const current = Buffer.from(inflated.subarray(sourceOffset, sourceOffset + rowLength));
    sourceOffset += rowLength;
    const previousRowStart = (row - 1) * rowLength;

    for (let index = 0; index < rowLength; index += 1) {
      const left = index >= bytesPerPixel ? current[index - bytesPerPixel] : 0;
      const up = row > 0 ? rgba[previousRowStart + index] : 0;
      const upLeft = row > 0 && index >= bytesPerPixel ? rgba[previousRowStart + index - bytesPerPixel] : 0;
      if (filter === 1) current[index] = (current[index] + left) & 0xff;
      if (filter === 2) current[index] = (current[index] + up) & 0xff;
      if (filter === 3) current[index] = (current[index] + Math.floor((left + up) / 2)) & 0xff;
      if (filter === 4) current[index] = (current[index] + paeth(left, up, upLeft)) & 0xff;
    }
    current.copy(rgba, row * rowLength);
  }

  const rgb = Buffer.alloc(width * height * 3);
  const alpha = Buffer.alloc(width * height);
  let hasAlpha = false;
  for (let pixel = 0; pixel < width * height; pixel += 1) {
    rgb[pixel * 3] = rgba[pixel * 4];
    rgb[pixel * 3 + 1] = rgba[pixel * 4 + 1];
    rgb[pixel * 3 + 2] = rgba[pixel * 4 + 2];
    alpha[pixel] = rgba[pixel * 4 + 3];
    if (alpha[pixel] !== 255) hasAlpha = true;
  }

  return { name: 'ResacoloLogo', width, height, rgb, alpha: hasAlpha ? alpha : null };
}

async function loadResacoloLogo() {
  return parsePngRgba(await readFile(RESACOLO_LOGO_PATH));
}

async function loadRalewayFonts(): Promise<PdfFonts | null> {
  try {
    const [regular, bold] = await Promise.all([
      readFile(RALEWAY_REGULAR_PATH),
      readFile(RALEWAY_BOLD_PATH)
    ]);
    return { regular, bold };
  } catch {
    return null;
  }
}

function toPdfLine(line: LedgerLinePreview): PdfLine {
  const totalCents = line.amount_cents;
  const netCents = Math.round(totalCents / (1 + VAT_RATE));
  const vatCents = totalCents - netCents;
  return {
    label: line.note?.trim() || (line.stay_id ? `Séjour ${line.stay_id.slice(0, 8)}` : 'Prestation Resacolo'),
    date: formatDate(line.occurred_at),
    channel: line.channel,
    totalCents,
    vatCents,
    netCents
  };
}

function renderInvoicePdf(input: MnemosInvoicePdfInput, logo: PdfImage | null, fonts: PdfFonts | null) {
  const page = new PdfPage();
  const invoiceLines = input.lines.map(toPdfLine);
  const totalCents = invoiceLines.reduce((sum, line) => sum + line.totalCents, 0);
  const totalNetCents = invoiceLines.reduce((sum, line) => sum + line.netCents, 0);
  const totalVatCents = totalCents - totalNetCents;
  const title = input.invoiceType === 'commission' ? 'Commissionnement' : 'Publication';
  const invoiceNumber = `${String(input.invoiceYear).slice(2)}-B01-${String(input.invoiceNumber).padStart(3, '0')}`;

  page.rect(0, 792, 595, 50, '0.98 0.50 0.00');
  if (logo) {
    page.image(logo.name, 34, 803, 150, 29);
  } else {
    page.text('RESACOLO', 40, 812, { size: 20, font: 'bold', color: '0.21 0.71 0.96' });
  }
  page.text(title, 555, 814, { size: 12, font: 'bold', align: 'right', color: '1 1 1' });
  page.text('24/26 rue Bichat', 40, 770, { size: 10 });
  page.text('75010 PARIS', 40, 756, { size: 10 });
  page.text('SIRET N° 904 862 158 00014', 40, 742, { size: 9 });

  page.text(input.organizerName, 380, 770, { size: 13, font: 'bold' });
  page.text(`Facture ${invoiceNumber}`, 380, 746, { size: 14, font: 'bold' });
  page.text(`du ${formatDate(input.issuedAt)}`, 380, 730, { size: 10 });
  page.text(`Période du ${formatDate(input.periodStartIso)} au ${formatDate(input.periodEndIso)}`, 40, 705, { size: 10 });

  let y = 672;
  page.rect(35, y - 8, 525, 24, '0.95 0.97 0.99');
  page.strokeRect(35, y - 8, 525, 24);
  page.text('Date', 45, y, { size: 8, font: 'bold' });
  page.text('Prestation', 105, y, { size: 8, font: 'bold' });
  page.text('Canal', 315, y, { size: 8, font: 'bold' });
  page.text('TTC', 410, y, { size: 8, font: 'bold', align: 'right' });
  page.text('TVA', 480, y, { size: 8, font: 'bold', align: 'right' });
  page.text('HT', 550, y, { size: 8, font: 'bold', align: 'right' });
  y -= 26;

  const visibleLines = invoiceLines.length > 14 ? invoiceLines.slice(0, 13) : invoiceLines;
  const overflowLines = invoiceLines.slice(visibleLines.length);

  visibleLines.forEach((line) => {
    const wrapped = wrapText(line.label, 38).slice(0, 2);
    const rowHeight = Math.max(28, wrapped.length * 12 + 10);
    page.line(35, y + 10, 560, y + 10);
    page.text(line.date, 45, y, { size: 8 });
    wrapped.forEach((part, index) => page.text(part, 105, y - index * 11, { size: 8 }));
    page.text(line.channel, 315, y, { size: 8 });
    page.text(euros(line.totalCents), 410, y, { size: 8, align: 'right' });
    page.text(euros(line.vatCents), 480, y, { size: 8, align: 'right' });
    page.text(euros(line.netCents), 550, y, { size: 8, align: 'right' });
    y -= rowHeight;
  });

  if (overflowLines.length > 0) {
    const overflowTotal = overflowLines.reduce((sum, line) => sum + line.totalCents, 0);
    const overflowNet = overflowLines.reduce((sum, line) => sum + line.netCents, 0);
    const overflowVat = overflowTotal - overflowNet;
    page.line(35, y + 10, 560, y + 10);
    page.text(`Autres lignes regroupées (${overflowLines.length})`, 105, y, { size: 8 });
    page.text(euros(overflowTotal), 410, y, { size: 8, align: 'right' });
    page.text(euros(overflowVat), 480, y, { size: 8, align: 'right' });
    page.text(euros(overflowNet), 550, y, { size: 8, align: 'right' });
    y -= 28;
  }

  const vatBoxY = Math.max(205, y - 30);
  page.text('Code', 45, vatBoxY, { size: 8, font: 'bold' });
  page.text('Base HT', 95, vatBoxY, { size: 8, font: 'bold' });
  page.text('Taux TVA', 170, vatBoxY, { size: 8, font: 'bold' });
  page.text('Montant TVA', 245, vatBoxY, { size: 8, font: 'bold' });
  page.line(40, vatBoxY - 6, 320, vatBoxY - 6);
  page.text('2', 45, vatBoxY - 22, { size: 8 });
  page.text(euros(totalNetCents), 95, vatBoxY - 22, { size: 8 });
  page.text('20 %', 170, vatBoxY - 22, { size: 8 });
  page.text(euros(totalVatCents), 245, vatBoxY - 22, { size: 8 });

  page.rect(365, vatBoxY - 52, 195, 82, '0.98 0.50 0.00');
  page.text('TOTAL HT', 380, vatBoxY, { size: 10, font: 'bold' });
  page.text(euros(totalNetCents), 545, vatBoxY, { size: 10, font: 'bold', align: 'right' });
  page.text('TOTAL TVA', 380, vatBoxY - 22, { size: 10, font: 'bold' });
  page.text(euros(totalVatCents), 545, vatBoxY - 22, { size: 10, font: 'bold', align: 'right' });
  page.text('TOTAL TTC', 380, vatBoxY - 44, { size: 11, font: 'bold' });
  page.text(euros(totalCents), 545, vatBoxY - 44, { size: 11, font: 'bold', align: 'right' });

  page.text('IBAN : FR76 1027 8023 3700 0202 7370 255', 40, 120, { size: 9 });
  page.text('BIC : CMCIFR2A', 40, 106, { size: 9 });
  page.line(40, 88, 555, 88);
  page.text('Resacolo, SAS à associé unique au capital de 1 000 EUR, domiciliée au 24/26 rue Bichat 75010 PARIS', 40, 70, { size: 8 });
  page.text('SIRET N° 904 862 158 00014 | Code APE 6311Z | TVA intracommunautaire n° FR67904862158', 40, 56, { size: 8 });

  return buildPdf([page.stream()], logo ? [logo] : [], fonts);
}

async function ensureInvoicePdfBucket(supabase: SupabaseClient<Database>) {
  const { error } = await supabase.storage.getBucket(INVOICE_PDF_BUCKET);
  if (!error) return;

  const { error: createError } = await supabase.storage.createBucket(INVOICE_PDF_BUCKET, {
    public: false,
    allowedMimeTypes: ['application/pdf']
  });
  if (createError && !/already exists/i.test(createError.message)) {
    throw createError;
  }
}

export async function createAndUploadMnemosInvoicePdf(
  supabase: SupabaseClient<Database>,
  input: MnemosInvoicePdfInput
) {
  await ensureInvoicePdfBucket(supabase);

  let logo: PdfImage | null = null;
  try {
    logo = await loadResacoloLogo();
  } catch {
    logo = null;
  }
  const fonts = await loadRalewayFonts();
  const pdf = renderInvoicePdf(input, logo, fonts);
  const path = `mnemos/${input.invoiceYear}/${input.invoiceId}.pdf`;
  const { error } = await supabase.storage.from(INVOICE_PDF_BUCKET).upload(path, pdf, {
    contentType: 'application/pdf',
    upsert: true
  });

  if (error) throw error;
  return path;
}

export async function createSignedMnemosInvoicePdfUrl(
  supabase: SupabaseClient<Database>,
  pathOrUrl: string | null | undefined
) {
  const value = pathOrUrl?.trim();
  if (!value) return null;
  if (/^https?:\/\//i.test(value)) return value;
  const { data, error } = await supabase.storage.from(INVOICE_PDF_BUCKET).createSignedUrl(value, 60 * 60);
  if (error) return null;
  return data.signedUrl;
}
