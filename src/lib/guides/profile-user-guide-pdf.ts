/**
 * Générateur de guides d'utilisation PDF par profil (Admin, Organisateur, Partenaire, Commercial).
 *
 * - Moteur : PDFKit (même approche que `client-travel-invoice-pdfkit.server.ts`).
 * - Typographie : Raleway (Regular / Medium / SemiBold / Bold) embarquée depuis `public/fonts`.
 * - Ce module est volontairement autonome (aucun alias `@/`, aucun `server-only`) afin de pouvoir
 *   être exécuté directement par `scripts/generate-profile-guides.mjs`.
 *
 * Le contenu éditorial des guides vit dans `profile-user-guide-content.ts`.
 */
import PDFDocument from 'pdfkit';
import { readFile } from 'node:fs/promises';
import { join } from 'node:path';

/* -------------------------------------------------------------------------- */
/*  Modèle de contenu                                                          */
/* -------------------------------------------------------------------------- */

export type GuideStep = {
  /** Intitulé court de l'étape (impératif). */
  title: string;
  /** Détail pratique. Supporte `**gras**` et les sauts de ligne `\n`. */
  detail?: string;
};

export type GuideBlock =
  | { type: 'p'; text: string }
  | { type: 'h3'; text: string }
  | { type: 'steps'; steps: GuideStep[] }
  | { type: 'bullets'; items: string[] }
  | { type: 'tip'; title?: string; text: string }
  | { type: 'important'; title?: string; text: string }
  | { type: 'table'; headers: string[]; rows: string[][]; widths?: number[] };

export type GuideChapter = {
  title: string;
  /** Une phrase : à quoi sert ce module (affichée dans le sommaire et sous le titre). */
  summary: string;
  /** Chemin de l'écran dans l'application (ex. `/admin/reservations`). */
  path?: string;
  /** Profils / rôles ayant accès à ce module. */
  access?: string;
  blocks: GuideBlock[];
};

export type ProfileGuide = {
  slug: string;
  /** Nom du fichier PDF généré (ex. `Resacolo-Guide-Admin.pdf`). */
  fileName: string;
  /** Nom du profil affiché en grand sur la couverture. */
  profileName: string;
  /** Sous-titre de couverture (une ligne). */
  profileTagline: string;
  /** URL de l'espace (affichée sur la couverture). */
  spaceUrl: string;
  /** Public cible (carte de couverture). */
  audience: string;
  /** Paragraphe d'introduction de la couverture. */
  abstract: string;
  /** Points clés « Ce que vous allez apprendre ». */
  learningGoals: string[];
  chapters: GuideChapter[];
};

export type RenderProfileGuideOptions = {
  /** Racine du dépôt Resacolo (pour `public/fonts` et `public/image`). Défaut : `process.cwd()`. */
  rootDir?: string;
  /** Date d'édition affichée sur la couverture. Défaut : maintenant. */
  date?: Date;
};

/* -------------------------------------------------------------------------- */
/*  Charte graphique                                                           */
/* -------------------------------------------------------------------------- */

const COLOR = {
  blue: '#52b0ea',
  blueBright: '#37b5f5',
  blueLight: '#6ec7ff',
  blueDeep: '#1f7fb8',
  blueTint: '#eaf6fd',
  orange: '#fa8500',
  orangeTint: '#fff3e0',
  orangeDeep: '#c46800',
  ink: '#404040',
  inkStrong: '#1d1f25',
  muted: '#767b86',
  line: '#e3e7ec',
  surface: '#f8f8f8',
  white: '#ffffff'
} as const;

const FONT = {
  regular: 'Raleway',
  medium: 'Raleway-Medium',
  semibold: 'Raleway-SemiBold',
  bold: 'Raleway-Bold'
} as const;

const PAGE_W = 595.28;
const PAGE_H = 841.89;
const MARGIN_X = 48;
const CONTENT_W = PAGE_W - MARGIN_X * 2;
const CONTENT_TOP = 78;
const CONTENT_BOTTOM = 790;

const LOGO_COLOR_PATH = 'public/image/accueil/images_accueil/logo-resacolo.png';
const LOGO_WHITE_PATH = 'public/image/footer/logo_footer/logo-resacolo-RVB-blanc_logo-final copie 2.png';

const FOOTER_LABEL = 'Resacolo — Guide d’utilisation';

/* -------------------------------------------------------------------------- */
/*  Utilitaires                                                                */
/* -------------------------------------------------------------------------- */

type PdfDoc = InstanceType<typeof PDFDocument>;

type TextStyle = {
  font?: string;
  size?: number;
  color?: string;
  width?: number;
  align?: 'left' | 'center' | 'right' | 'justify';
  lineGap?: number;
  characterSpacing?: number;
  lineBreak?: boolean;
  height?: number;
  ellipsis?: boolean;
};

/** Typographie française : espaces insécables avant `: ; ? !` et autour des guillemets. */
function typo(input: string): string {
  return input
    .replace(/\u202f/g, '\u00a0')
    .replace(/ ([:;?!»])/g, '\u00a0$1')
    .replace(/(«) /g, '$1\u00a0');
}

function stripMarkup(input: string): string {
  return input.replace(/\*\*/g, '');
}

function capitalize(input: string): string {
  return input.charAt(0).toUpperCase() + input.slice(1);
}

function formatEditionDate(date: Date): string {
  return capitalize(date.toLocaleDateString('fr-FR', { month: 'long', year: 'numeric' }));
}

function formatLongDate(date: Date): string {
  return date.toLocaleDateString('fr-FR', { day: 'numeric', month: 'long', year: 'numeric' });
}

type ChapterLayout = {
  chapter: GuideChapter;
  number: number;
  /** Numéro de page (1 = couverture). */
  page: number;
};

/* -------------------------------------------------------------------------- */
/*  Moteur de mise en page                                                     */
/* -------------------------------------------------------------------------- */

class GuideRenderer {
  private readonly doc: PdfDoc;
  private y = CONTENT_TOP;
  private logoColor: Buffer | null = null;
  private logoWhite: Buffer | null = null;
  private logoColorRatio = 0.26;
  private logoWhiteRatio = 0.26;
  private readonly guide: ProfileGuide;
  private readonly date: Date;
  private readonly layouts: ChapterLayout[] = [];

  constructor(guide: ProfileGuide, date: Date) {
    this.guide = guide;
    this.date = date;
    this.doc = new PDFDocument({
      size: 'A4',
      margin: 0,
      autoFirstPage: false,
      bufferPages: true,
      compress: true,
      info: {
        Title: `Resacolo — Guide d’utilisation — ${guide.profileName}`,
        Author: 'Resacolo',
        Creator: 'Resacolo',
        Producer: 'Resacolo (PDFKit)',
        Subject: `Guide d’utilisation du profil ${guide.profileName}`,
        Keywords: `Resacolo, guide, ${guide.profileName}, colonies de vacances`
      }
    });
  }

  async render(rootDir: string): Promise<Buffer> {
    const doc = this.doc;
    const chunks: Buffer[] = [];
    doc.on('data', (chunk: Buffer) => chunks.push(chunk));
    const done = new Promise<Buffer>((resolve, reject) => {
      doc.on('end', () => resolve(Buffer.concat(chunks)));
      doc.on('error', reject);
    });

    await this.loadAssets(rootDir);

    // Page 1 : couverture — Page 2 : sommaire (rempli après coup, une fois les numéros de page connus)
    doc.addPage();
    this.drawCover();
    doc.addPage();
    // Page 3 : début des chapitres
    this.newContentPage();

    this.guide.chapters.forEach((chapter, index) => {
      this.drawChapter(chapter, index + 1);
    });

    this.drawToc();
    this.drawRunningElements();

    doc.end();
    return done;
  }

  /* ----------------------------- Chargement ------------------------------- */

  private async loadAssets(rootDir: string) {
    const doc = this.doc;
    const [regular, medium, semibold, bold, logoColor, logoWhite] = await Promise.all([
      readFile(join(rootDir, 'public/fonts/Raleway-Regular.ttf')),
      readFile(join(rootDir, 'public/fonts/Raleway-Medium.ttf')),
      readFile(join(rootDir, 'public/fonts/Raleway-SemiBold.ttf')),
      readFile(join(rootDir, 'public/fonts/Raleway-Bold.ttf')),
      readFile(join(rootDir, LOGO_COLOR_PATH)).catch(() => null),
      readFile(join(rootDir, LOGO_WHITE_PATH)).catch(() => null)
    ]);
    doc.registerFont(FONT.regular, regular);
    doc.registerFont(FONT.medium, medium);
    doc.registerFont(FONT.semibold, semibold);
    doc.registerFont(FONT.bold, bold);

    this.logoColor = logoColor;
    this.logoWhite = logoWhite;
    this.logoColorRatio = this.imageRatio(logoColor) ?? this.logoColorRatio;
    this.logoWhiteRatio = this.imageRatio(logoWhite) ?? this.logoWhiteRatio;
  }

  private imageRatio(buffer: Buffer | null): number | null {
    if (!buffer) return null;
    try {
      const image = (this.doc as unknown as { openImage: (src: Buffer) => { width: number; height: number } }).openImage(
        buffer
      );
      return image.height / image.width;
    } catch {
      return null;
    }
  }

  /* ------------------------------ Primitives ------------------------------ */

  private applyFont(style: TextStyle) {
    this.doc
      .font(style.font ?? FONT.regular)
      .fontSize(style.size ?? 10)
      .fillColor(style.color ?? COLOR.ink);
  }

  private textOptions(style: TextStyle) {
    return {
      width: style.width,
      align: style.align,
      lineGap: style.lineGap ?? 0,
      characterSpacing: style.characterSpacing ?? 0,
      lineBreak: style.lineBreak,
      height: style.height,
      ellipsis: style.ellipsis
    };
  }

  private text(content: string, x: number, y: number, style: TextStyle = {}) {
    this.applyFont(style);
    this.doc.text(typo(content), x, y, this.textOptions(style));
  }

  private measure(content: string, style: TextStyle & { width: number }): number {
    this.applyFont(style);
    return this.doc.heightOfString(typo(stripMarkup(content)), {
      width: style.width,
      lineGap: style.lineGap ?? 0,
      characterSpacing: style.characterSpacing ?? 0
    });
  }

  /** Texte courant avec support de `**gras**`. Retourne la hauteur occupée (mesurée en SemiBold, par prudence). */
  private rich(content: string, x: number, y: number, style: TextStyle & { width: number }): number {
    const hasBold = content.includes('**');
    const measureFont = hasBold ? FONT.semibold : style.font ?? FONT.regular;
    const height = this.measure(content, { ...style, font: measureFont });

    const segments = typo(content)
      .split('**')
      .map((value, index) => ({ value, bold: index % 2 === 1 }))
      .filter((segment) => segment.value.length > 0);

    segments.forEach((segment, index) => {
      const last = index === segments.length - 1;
      this.applyFont({
        ...style,
        font: segment.bold ? FONT.semibold : style.font ?? FONT.regular,
        color: segment.bold ? COLOR.inkStrong : style.color ?? COLOR.ink
      });
      const options = {
        width: style.width,
        lineGap: style.lineGap ?? 0,
        align: style.align,
        continued: !last
      };
      if (index === 0) {
        this.doc.text(segment.value, x, y, options);
      } else {
        this.doc.text(segment.value, options);
      }
    });

    return height;
  }

  /** Texte centré horizontalement et verticalement dans un cercle. */
  private textInCircle(label: string, cx: number, cy: number, size: number, color: string, font: string = FONT.bold) {
    this.applyFont({ font, size, color });
    const lineHeight = this.doc.currentLineHeight();
    this.doc.text(label, cx - 20, cy - lineHeight / 2 + size * 0.04, {
      width: 40,
      align: 'center',
      lineBreak: false
    });
  }

  private pill(label: string, x: number, y: number, opts: { fill?: string; stroke?: string; color: string; size?: number }) {
    const size = opts.size ?? 8;
    this.applyFont({ font: FONT.semibold, size, color: opts.color });
    const width = this.doc.widthOfString(typo(label)) + 16;
    const height = size + 9;
    const shape = this.doc.roundedRect(x, y, width, height, height / 2);
    if (opts.fill && opts.stroke) shape.lineWidth(0.8).fillAndStroke(opts.fill, opts.stroke);
    else if (opts.fill) shape.fill(opts.fill);
    else if (opts.stroke) shape.lineWidth(0.8).stroke(opts.stroke);
    this.text(label, x + 8, y + (height - this.doc.currentLineHeight()) / 2 + 0.5, {
      font: FONT.semibold,
      size,
      color: opts.color,
      lineBreak: false
    });
    return { width, height };
  }

  private drawLogo(kind: 'color' | 'white', x: number, y: number, width: number) {
    const buffer = kind === 'color' ? this.logoColor : this.logoWhite;
    const ratio = kind === 'color' ? this.logoColorRatio : this.logoWhiteRatio;
    if (buffer) {
      try {
        this.doc.image(buffer, x, y, { width });
        return width * ratio;
      } catch {
        // repli typographique ci-dessous
      }
    }
    this.text('RESACOLO', x, y, {
      font: FONT.bold,
      size: width / 6,
      color: kind === 'color' ? COLOR.blue : COLOR.white,
      lineBreak: false
    });
    return width * 0.26;
  }

  private newContentPage() {
    this.doc.addPage();
    this.y = CONTENT_TOP;
  }

  private ensure(height: number) {
    if (this.y + height > CONTENT_BOTTOM) this.newContentPage();
  }

  private pageNumber(): number {
    const range = this.doc.bufferedPageRange();
    return range.start + range.count;
  }

  /* -------------------------------- Couverture ---------------------------- */

  private drawCover() {
    const doc = this.doc;
    const { guide } = this;

    // Fond bas de page
    doc.rect(0, 0, PAGE_W, PAGE_H).fill(COLOR.surface);

    // Grande barre de marque
    const barHeight = 372;
    doc.save();
    doc.rect(0, 0, PAGE_W, barHeight).clip();
    doc.rect(0, 0, PAGE_W, barHeight).fill(COLOR.blue);
    doc.fillOpacity(0.38).circle(PAGE_W - 40, 30, 190).fill(COLOR.blueLight);
    doc.fillOpacity(0.5).circle(-30, barHeight - 10, 130).fill(COLOR.blueBright);
    doc.fillOpacity(0.18).circle(PAGE_W - 150, barHeight - 40, 80).fill(COLOR.white);
    doc.fillOpacity(0.12).circle(150, 40, 60).fill(COLOR.white);
    doc.fillOpacity(1);
    doc.restore();
    doc.rect(0, barHeight, PAGE_W, 8).fill(COLOR.orange);

    // Logo blanc
    this.drawLogo('white', MARGIN_X, 52, 176);

    // Étiquette
    const tag = 'GUIDE D’UTILISATION';
    this.applyFont({ font: FONT.bold, size: 8.5, color: COLOR.white, characterSpacing: 1.6 });
    const tagWidth = doc.widthOfString(tag) + tag.length * 1.6 + 30;
    doc.roundedRect(MARGIN_X, 150, tagWidth, 24, 12).lineWidth(1).strokeColor(COLOR.white).stroke();
    this.text(tag, MARGIN_X + 14, 150 + (24 - doc.currentLineHeight()) / 2 + 0.5, {
      font: FONT.bold,
      size: 8.5,
      color: COLOR.white,
      characterSpacing: 1.6,
      lineBreak: false
    });

    // Nom du profil
    const nameStyle = { font: FONT.bold, size: 50, color: COLOR.white, width: CONTENT_W, lineGap: -2 };
    this.text(guide.profileName, MARGIN_X, 196, nameStyle);
    const nameHeight = this.measure(guide.profileName, nameStyle);

    // Guide d'utilisation + Resacolo
    const subtitleY = 196 + nameHeight + 6;
    this.text('Guide d’utilisation', MARGIN_X, subtitleY, {
      font: FONT.medium,
      size: 24,
      color: COLOR.white,
      lineBreak: false
    });
    this.text('Resacolo', MARGIN_X, subtitleY + 36, {
      font: FONT.semibold,
      size: 13,
      color: COLOR.blueTint,
      characterSpacing: 3,
      lineBreak: false
    });
    const editionLabel = formatEditionDate(this.date);
    this.text(editionLabel, MARGIN_X, barHeight - 40, {
      font: FONT.semibold,
      size: 11,
      color: COLOR.white,
      lineBreak: false
    });
    const editionWidth = doc.widthOfString(editionLabel);
    doc.circle(MARGIN_X + editionWidth + 14, barHeight - 33, 2.2).fill(COLOR.orange);
    this.text(guide.profileTagline, MARGIN_X + editionWidth + 26, barHeight - 40, {
      font: FONT.medium,
      size: 11,
      color: COLOR.blueTint,
      width: CONTENT_W - 130,
      lineBreak: false
    });

    // Introduction
    let y = barHeight + 8 + 38;
    const abstractStyle = { font: FONT.medium, size: 12, color: COLOR.inkStrong, width: CONTENT_W, lineGap: 4 };
    this.text(guide.abstract, MARGIN_X, y, abstractStyle);
    y += this.measure(guide.abstract, abstractStyle) + 26;

    // Ce que vous allez apprendre
    this.text('CE QUE VOUS ALLEZ APPRENDRE', MARGIN_X, y, {
      font: FONT.bold,
      size: 8.5,
      color: COLOR.blueDeep,
      characterSpacing: 1.4,
      lineBreak: false
    });
    y += 20;
    for (const goal of guide.learningGoals) {
      doc.circle(MARGIN_X + 9, y + 8, 9).fill(COLOR.orange);
      // coche dessinée (la police ne contient pas ✓)
      doc
        .lineWidth(1.8)
        .lineCap('round')
        .lineJoin('round')
        .moveTo(MARGIN_X + 5, y + 8.2)
        .lineTo(MARGIN_X + 8, y + 11.2)
        .lineTo(MARGIN_X + 13.2, y + 5.2)
        .strokeColor(COLOR.white)
        .stroke();
      const goalStyle = { font: FONT.medium, size: 10.5, color: COLOR.ink, width: CONTENT_W - 32, lineGap: 2 };
      this.text(goal, MARGIN_X + 28, y + 2, goalStyle);
      y += Math.max(26, this.measure(goal, goalStyle) + 12);
    }

    // Cartes d'information (bas de couverture)
    const cardY = PAGE_H - 150;
    const gap = 14;
    const cardW = (CONTENT_W - gap * 2) / 3;
    const cards: Array<{ label: string; value: string }> = [
      { label: 'PROFIL', value: guide.audience },
      { label: 'ESPACE', value: guide.spaceUrl },
      { label: 'ÉDITION', value: formatLongDate(this.date) }
    ];
    cards.forEach((card, index) => {
      const x = MARGIN_X + index * (cardW + gap);
      doc.roundedRect(x, cardY, cardW, 70, 8).fill(COLOR.white);
      doc.roundedRect(x, cardY, cardW, 70, 8).lineWidth(0.8).strokeColor(COLOR.line).stroke();
      doc.rect(x, cardY + 14, 3, 42).fill(COLOR.orange);
      this.text(card.label, x + 16, cardY + 15, {
        font: FONT.bold,
        size: 7.5,
        color: COLOR.blueDeep,
        characterSpacing: 1.2,
        lineBreak: false
      });
      this.text(card.value, x + 16, cardY + 30, {
        font: FONT.semibold,
        size: 10,
        color: COLOR.inkStrong,
        width: cardW - 28,
        lineGap: 2
      });
    });

    // Pied de couverture
    doc.rect(0, PAGE_H - 28, PAGE_W, 28).fill(COLOR.blue);
    doc.rect(0, PAGE_H - 28, 120, 4).fill(COLOR.orange);
    this.text('resacolo.com', MARGIN_X, PAGE_H - 19, {
      font: FONT.semibold,
      size: 8.5,
      color: COLOR.white,
      lineBreak: false
    });
    this.text('Colonies de vacances — réservation en ligne', 0, PAGE_H - 19, {
      font: FONT.medium,
      size: 8.5,
      color: COLOR.white,
      width: PAGE_W - MARGIN_X,
      align: 'right',
      lineBreak: false
    });
  }

  /* -------------------------------- Chapitres ----------------------------- */

  private drawChapter(chapter: GuideChapter, number: number) {
    const doc = this.doc;

    // Titre + début de contenu toujours ensemble
    this.ensure(170);
    this.layouts.push({ chapter, number, page: this.pageNumber() });

    // Barre de titre bleue
    const barH = 44;
    const top = this.y;
    doc.roundedRect(MARGIN_X, top, CONTENT_W, barH, 8).fill(COLOR.blue);
    doc.save();
    doc.roundedRect(MARGIN_X, top, CONTENT_W, barH, 8).clip();
    doc.fillOpacity(0.35).circle(MARGIN_X + CONTENT_W - 20, top - 10, 52).fill(COLOR.blueLight);
    doc.fillOpacity(1);
    doc.restore();
    doc.roundedRect(MARGIN_X, top, 5, barH, 2).fill(COLOR.orange);
    this.text(String(number).padStart(2, '0'), MARGIN_X + 20, top + 7, {
      font: FONT.bold,
      size: 24,
      color: COLOR.white,
      lineBreak: false
    });
    this.text(chapter.title, MARGIN_X + 66, top + (barH - 17) / 2 + 1, {
      font: FONT.bold,
      size: 15,
      color: COLOR.white,
      width: CONTENT_W - 86,
      lineBreak: false
    });
    this.y = top + barH + 12;

    // Pastilles : chemin + accès
    if (chapter.path || chapter.access) {
      let x = MARGIN_X;
      if (chapter.path) {
        const pill = this.pill(chapter.path, x, this.y, { fill: COLOR.blueTint, stroke: COLOR.blueLight, color: COLOR.blueDeep });
        x += pill.width + 8;
      }
      if (chapter.access) {
        this.pill(`Accès : ${chapter.access}`, x, this.y, { fill: COLOR.orangeTint, color: COLOR.orangeDeep });
      }
      this.y += 26;
    }

    // Résumé
    const summaryStyle = { font: FONT.medium, size: 10.5, color: COLOR.inkStrong, width: CONTENT_W, lineGap: 3 };
    this.text(chapter.summary, MARGIN_X, this.y, summaryStyle);
    this.y += this.measure(chapter.summary, summaryStyle) + 14;

    for (const block of chapter.blocks) {
      this.drawBlock(block);
    }
    this.y += 14;
  }

  private drawBlock(block: GuideBlock) {
    switch (block.type) {
      case 'p':
        return this.drawParagraph(block.text);
      case 'h3':
        return this.drawSubheading(block.text);
      case 'steps':
        return this.drawSteps(block.steps);
      case 'bullets':
        return this.drawBullets(block.items);
      case 'tip':
        return this.drawCallout('tip', block.title ?? 'Astuce', block.text);
      case 'important':
        return this.drawCallout('important', block.title ?? 'À retenir', block.text);
      case 'table':
        return this.drawTable(block.headers, block.rows, block.widths);
    }
  }

  private drawParagraph(content: string) {
    const style = { font: FONT.regular, size: 10, color: COLOR.ink, width: CONTENT_W, lineGap: 3 };
    const height = this.measure(content, style);
    this.ensure(height + 4);
    this.rich(content, MARGIN_X, this.y, style);
    this.y += height + 10;
  }

  private drawSubheading(content: string) {
    this.ensure(70);
    this.doc.rect(MARGIN_X, this.y + 2, 4, 13).fill(COLOR.orange);
    this.text(content, MARGIN_X + 12, this.y, {
      font: FONT.bold,
      size: 12,
      color: COLOR.blueDeep,
      width: CONTENT_W - 12,
      lineBreak: false
    });
    this.y += 24;
  }

  private drawBullets(items: string[]) {
    const style = { font: FONT.regular, size: 10, color: COLOR.ink, width: CONTENT_W - 20, lineGap: 3 };
    for (const item of items) {
      const height = this.measure(item, style);
      this.ensure(height + 6);
      this.doc.circle(MARGIN_X + 5, this.y + 5.2, 2.6).fill(COLOR.orange);
      this.rich(item, MARGIN_X + 18, this.y, style);
      this.y += height + 6;
    }
    this.y += 6;
  }

  private drawSteps(steps: GuideStep[]) {
    const doc = this.doc;
    const textX = MARGIN_X + 38;
    const textW = CONTENT_W - 38;
    const titleStyle = { font: FONT.semibold, size: 11, color: COLOR.inkStrong, width: textW, lineGap: 2 };
    const detailStyle = { font: FONT.regular, size: 9.8, color: COLOR.ink, width: textW, lineGap: 3 };

    steps.forEach((step, index) => {
      const titleH = this.measure(step.title, titleStyle);
      const detailH = step.detail ? this.measure(step.detail, detailStyle) : 0;
      const height = Math.max(26, titleH + (detailH ? detailH + 3 : 0) + 2);
      const isLast = index === steps.length - 1;

      this.ensure(height + 6);
      const top = this.y;

      // Rail vertical entre les étapes
      if (!isLast) {
        doc
          .moveTo(MARGIN_X + 13, top + 28)
          .lineTo(MARGIN_X + 13, top + height + 13)
          .lineWidth(1.6)
          .strokeColor(COLOR.blueLight)
          .stroke();
      }

      // Badge orange numéroté
      doc.circle(MARGIN_X + 13, top + 13, 13).fill(COLOR.orange);
      doc.circle(MARGIN_X + 13, top + 13, 13).lineWidth(2.2).strokeColor(COLOR.orangeTint).stroke();
      this.textInCircle(String(index + 1), MARGIN_X + 13, top + 13, 11.5, COLOR.white);

      this.text(step.title, textX, top + 2, titleStyle);
      if (step.detail) {
        this.rich(step.detail, textX, top + 2 + titleH + 3, detailStyle);
      }
      this.y = top + height + 12;
    });
    this.y += 4;
  }

  private drawCallout(kind: 'tip' | 'important', title: string, content: string) {
    const doc = this.doc;
    const palette =
      kind === 'tip'
        ? { fill: COLOR.blueTint, bar: COLOR.blue, accent: COLOR.blueDeep, icon: 'i' }
        : { fill: COLOR.orangeTint, bar: COLOR.orange, accent: COLOR.orangeDeep, icon: '!' };
    const padX = 16;
    const padY = 12;
    const iconW = 30;
    const textW = CONTENT_W - padX * 2 - iconW;
    const bodyStyle = { font: FONT.regular, size: 9.8, color: COLOR.ink, width: textW, lineGap: 3 };
    const bodyH = this.measure(content, bodyStyle);
    const height = padY * 2 + 14 + bodyH;

    this.ensure(height + 8);
    const top = this.y;
    doc.roundedRect(MARGIN_X, top, CONTENT_W, height, 6).fill(palette.fill);
    doc.save();
    doc.roundedRect(MARGIN_X, top, CONTENT_W, height, 6).clip();
    doc.rect(MARGIN_X, top, 4, height).fill(palette.bar);
    doc.restore();

    doc.circle(MARGIN_X + padX + 9, top + padY + 8, 9).fill(palette.bar);
    this.textInCircle(palette.icon, MARGIN_X + padX + 9, top + padY + 8, 10.5, COLOR.white);

    this.text(title.toUpperCase(), MARGIN_X + padX + iconW, top + padY + 2, {
      font: FONT.bold,
      size: 8.2,
      color: palette.accent,
      characterSpacing: 1.1,
      lineBreak: false
    });
    this.rich(content, MARGIN_X + padX + iconW, top + padY + 16, bodyStyle);
    this.y = top + height + 14;
  }

  private drawTable(headers: string[], rows: string[][], widths?: number[]) {
    const doc = this.doc;
    const total = (widths ?? headers.map(() => 1)).reduce((sum, value) => sum + value, 0);
    const columns = (widths ?? headers.map(() => 1)).map((value) => (value / total) * CONTENT_W);
    const padX = 8;
    const padY = 6;
    const headStyle = { font: FONT.semibold, size: 8.4, color: COLOR.white, lineGap: 1 };
    const cellStyle = { font: FONT.regular, size: 9.2, color: COLOR.ink, lineGap: 2 };

    const rowHeight = (cells: string[], style: typeof cellStyle) =>
      Math.max(
        ...cells.map((cell, index) =>
          this.measure(cell, {
            ...style,
            // 1re colonne rendue en SemiBold (plus large) : on mesure avec la même fonte
            font: index === 0 ? FONT.semibold : style.font,
            width: columns[index] - padX * 2
          })
        ),
        10
      ) +
      padY * 2;

    const drawHeader = () => {
      const height = rowHeight(headers, headStyle);
      this.ensure(height + 40);
      doc.roundedRect(MARGIN_X, this.y, CONTENT_W, height, 4).fill(COLOR.blueDeep);
      let x = MARGIN_X;
      headers.forEach((header, index) => {
        this.text(header.toUpperCase(), x + padX, this.y + padY + 1, {
          ...headStyle,
          width: columns[index] - padX * 2,
          characterSpacing: 0.6
        });
        x += columns[index];
      });
      this.y += height;
    };

    drawHeader();
    rows.forEach((row, rowIndex) => {
      const height = rowHeight(row, cellStyle);
      if (this.y + height > CONTENT_BOTTOM) {
        this.newContentPage();
        drawHeader();
      }
      doc.rect(MARGIN_X, this.y, CONTENT_W, height).fill(rowIndex % 2 === 0 ? COLOR.surface : COLOR.white);
      doc
        .moveTo(MARGIN_X, this.y + height)
        .lineTo(MARGIN_X + CONTENT_W, this.y + height)
        .lineWidth(0.5)
        .strokeColor(COLOR.line)
        .stroke();
      let x = MARGIN_X;
      row.forEach((cell, index) => {
        const isFirst = index === 0;
        this.rich(cell, x + padX, this.y + padY, {
          ...cellStyle,
          font: isFirst ? FONT.semibold : FONT.regular,
          color: isFirst ? COLOR.inkStrong : COLOR.ink,
          width: columns[index] - padX * 2
        });
        x += columns[index];
      });
      this.y += height;
    });
    this.y += 16;
  }

  /* -------------------------------- Sommaire ------------------------------ */

  private drawToc() {
    const doc = this.doc;
    doc.switchToPage(1);

    // Titre
    doc.rect(MARGIN_X, 70, 44, 5).fill(COLOR.orange);
    this.text('Sommaire', MARGIN_X, 84, {
      font: FONT.bold,
      size: 30,
      color: COLOR.inkStrong,
      lineBreak: false
    });
    this.text(`Guide d’utilisation — ${this.guide.profileName}`, MARGIN_X, 124, {
      font: FONT.medium,
      size: 11,
      color: COLOR.muted,
      lineBreak: false
    });

    let y = 160;
    const rowH = Math.min(44, Math.max(34, (CONTENT_BOTTOM - 190 - 190) / Math.max(this.layouts.length, 1)));
    for (const entry of this.layouts) {
      doc.circle(MARGIN_X + 14, y + 14, 14).fill(COLOR.blue);
      this.textInCircle(String(entry.number), MARGIN_X + 14, y + 14, 11.5, COLOR.white);

      this.text(entry.chapter.title, MARGIN_X + 40, y + 1, {
        font: FONT.semibold,
        size: 11.5,
        color: COLOR.inkStrong,
        width: CONTENT_W - 100,
        lineBreak: false
      });
      this.text(entry.chapter.summary, MARGIN_X + 40, y + 17, {
        font: FONT.regular,
        size: 8.6,
        color: COLOR.muted,
        width: CONTENT_W - 110,
        height: 11,
        ellipsis: true
      });
      this.text(String(entry.page), PAGE_W - MARGIN_X - 40, y + 2, {
        font: FONT.bold,
        size: 13,
        color: COLOR.blueDeep,
        width: 40,
        align: 'right',
        lineBreak: false
      });
      doc
        .moveTo(MARGIN_X + 40, y + rowH - 4)
        .lineTo(PAGE_W - MARGIN_X, y + rowH - 4)
        .dash(1, { space: 3 })
        .lineWidth(0.6)
        .strokeColor(COLOR.line)
        .stroke()
        .undash();
      y += rowH;
    }

    // Légende « Comment lire ce guide »
    const legendTop = Math.max(y + 18, CONTENT_BOTTOM - 168);
    doc.roundedRect(MARGIN_X, legendTop, CONTENT_W, 160, 10).fill(COLOR.surface);
    doc.roundedRect(MARGIN_X, legendTop, CONTENT_W, 160, 10).lineWidth(0.8).strokeColor(COLOR.line).stroke();
    this.text('COMMENT LIRE CE GUIDE', MARGIN_X + 20, legendTop + 16, {
      font: FONT.bold,
      size: 8.5,
      color: COLOR.blueDeep,
      characterSpacing: 1.4,
      lineBreak: false
    });

    const legend: Array<{ kind: 'step' | 'tip' | 'important' | 'path'; title: string; text: string }> = [
      { kind: 'step', title: 'Étapes numérotées', text: 'Suivez-les dans l’ordre : chaque pastille orange correspond à une action à réaliser.' },
      { kind: 'tip', title: 'Astuces', text: 'Encadrés bleus : raccourcis et conseils pour gagner du temps.' },
      { kind: 'important', title: 'À retenir', text: 'Encadrés orange : règles à respecter pour éviter une erreur.' },
      { kind: 'path', title: 'Chemin d’accès', text: 'La pastille indique l’adresse de l’écran dans votre espace.' }
    ];
    const colW = (CONTENT_W - 40 - 20) / 2;
    legend.forEach((item, index) => {
      const x = MARGIN_X + 20 + (index % 2) * (colW + 20);
      const itemY = legendTop + 42 + Math.floor(index / 2) * 56;
      if (item.kind === 'step') {
        doc.circle(x + 11, itemY + 11, 11).fill(COLOR.orange);
        this.textInCircle('1', x + 11, itemY + 11, 10, COLOR.white);
      } else if (item.kind === 'tip') {
        doc.circle(x + 11, itemY + 11, 11).fill(COLOR.blue);
        this.textInCircle('i', x + 11, itemY + 11, 10, COLOR.white);
      } else if (item.kind === 'important') {
        doc.circle(x + 11, itemY + 11, 11).fill(COLOR.orange);
        this.textInCircle('!', x + 11, itemY + 11, 10, COLOR.white);
      } else {
        doc.roundedRect(x, itemY + 3, 22, 16, 8).fill(COLOR.blueTint);
        doc.roundedRect(x, itemY + 3, 22, 16, 8).lineWidth(0.8).strokeColor(COLOR.blueLight).stroke();
      }
      this.text(item.title, x + 32, itemY, { font: FONT.semibold, size: 9.8, color: COLOR.inkStrong, lineBreak: false });
      this.text(item.text, x + 32, itemY + 14, {
        font: FONT.regular,
        size: 8.6,
        color: COLOR.ink,
        width: colW - 34,
        lineGap: 2
      });
    });
  }

  /* ------------------------ En-têtes et pieds de page --------------------- */

  private drawRunningElements() {
    const doc = this.doc;
    const range = doc.bufferedPageRange();
    const total = range.count;

    for (let index = 1; index < total; index += 1) {
      doc.switchToPage(range.start + index);

      // En-tête
      this.drawLogo('color', MARGIN_X, 26, 78);
      this.text(`Guide d’utilisation · ${this.guide.profileName}`, 0, 31, {
        font: FONT.medium,
        size: 8,
        color: COLOR.muted,
        width: PAGE_W - MARGIN_X,
        align: 'right',
        lineBreak: false
      });
      doc.moveTo(MARGIN_X, 54).lineTo(PAGE_W - MARGIN_X, 54).lineWidth(0.8).strokeColor(COLOR.line).stroke();
      doc.moveTo(MARGIN_X, 54).lineTo(MARGIN_X + 46, 54).lineWidth(2).strokeColor(COLOR.orange).stroke();

      // Pied de page
      doc.moveTo(MARGIN_X, 800).lineTo(PAGE_W - MARGIN_X, 800).lineWidth(0.6).strokeColor(COLOR.line).stroke();
      this.text(FOOTER_LABEL, MARGIN_X, 808, {
        font: FONT.medium,
        size: 8,
        color: COLOR.muted,
        lineBreak: false
      });
      this.text(`Page ${index + 1} / ${total}`, 0, 808, {
        font: FONT.semibold,
        size: 8,
        color: COLOR.blueDeep,
        width: PAGE_W - MARGIN_X,
        align: 'right',
        lineBreak: false
      });
      doc.rect(0, PAGE_H - 6, PAGE_W, 6).fill(COLOR.blue);
      doc.rect(0, PAGE_H - 6, 90, 6).fill(COLOR.orange);
    }
  }
}

/* -------------------------------------------------------------------------- */
/*  API publique                                                               */
/* -------------------------------------------------------------------------- */

export async function renderProfileGuidePdf(
  guide: ProfileGuide,
  options: RenderProfileGuideOptions = {}
): Promise<Buffer> {
  const rootDir = options.rootDir ?? process.cwd();
  const date = options.date ?? new Date();
  const renderer = new GuideRenderer(guide, date);
  return renderer.render(rootDir);
}
