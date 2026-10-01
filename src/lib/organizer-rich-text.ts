function escapeHtml(value: string) {
  return value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

function stripHtmlTags(value: string) {
  return value
    .replace(/<br\s*\/?>/gi, '\n')
    .replace(/<\/(p|div|section|article|blockquote|h[1-6])>/gi, '\n\n')
    .replace(/<li>/gi, '- ')
    .replace(/<\/li>/gi, '\n')
    .replace(/<\/(ul|ol)>/gi, '\n')
    .replace(/<[^>]+>/g, ' ')
    .replace(/&nbsp;|&#160;/gi, ' ')
    .replace(/&amp;/gi, '&')
    .replace(/&lt;/gi, '<')
    .replace(/&gt;/gi, '>')
    .replace(/&quot;/gi, '"')
    .replace(/&#39;|&apos;/gi, "'")
    .replace(/\r/g, '')
    .replace(/\s+\n/g, '\n')
    .replace(/\n\s+/g, '\n')
    .replace(/\n{3,}/g, '\n\n')
    .replace(/[ \t]{2,}/g, ' ')
    .trim();
}

function applyFrenchNbspBeforePunctuation(value: string) {
  return value.replace(/ ([!?;:])/g, '&nbsp;$1');
}

const ORGANIZER_DURATION_META_PATTERN = /<!--\s*resacolo:duration:(\d*):(\d*)\s*-->/gi;
const ORGANIZER_PAYMENT_AIDS_META_PATTERN = /<!--\s*resacolo:payment-aids:([a-z_,\s-]*)\s*-->/gi;

type SanitizeOrganizerRichTextOptions = {
  /** Au collage Word/Docs : retire le soulignement global souvent importé par erreur. */
  stripUnderline?: boolean;
};

function stripOrganizerDescriptionMeta(value?: string | null) {
  return (value ?? '')
    .replace(ORGANIZER_DURATION_META_PATTERN, '')
    .replace(ORGANIZER_PAYMENT_AIDS_META_PATTERN, '')
    .trim();
}

export function extractOrganizerPresentationHtmlForEditor(value?: string | null) {
  return sanitizeOrganizerRichText(stripOrganizerDescriptionMeta(value) || null);
}

export function convertPlainTextToRichTextHtml(value: string) {
  const normalized = value
    .replace(/\r\n/g, '\n')
    .replace(/\r/g, '\n')
    .replace(/^\n+|\n+$/g, '');
  if (!normalized.trim()) return '';

  const parts = normalized.split(/(\n{2,})/);
  const htmlParts: string[] = [];

  for (const part of parts) {
    if (/^\n+$/.test(part)) {
      // \n\n sépare deux paragraphes ; chaque \n supplémentaire crée un paragraphe vide.
      const emptyParagraphs = Math.max(0, part.length - 2);
      for (let index = 0; index < emptyParagraphs; index += 1) {
        htmlParts.push('<p><br /></p>');
      }
      continue;
    }
    if (part.trim() === '') continue;
    htmlParts.push(`<p>${escapeHtml(part).replace(/\n/g, '<br />')}</p>`);
  }

  return htmlParts.join('');
}

function normalizeEmptyParagraphs(html: string) {
  return html
    .replace(/<p>(?:\s|&nbsp;|&#160;)*<\/p>/gi, '<p><br /></p>')
    .replace(/<p>(?:\s|&nbsp;|&#160;)*(?:<br\s*\/?>\s*)+(?:\s|&nbsp;|&#160;)*<\/p>/gi, '<p><br /></p>');
}

function unwrapFullDocumentUnderline(html: string) {
  const withoutOuterWhitespace = html.trim();
  const fullWrap = withoutOuterWhitespace.match(/^<u>([\s\S]*)<\/u>$/i);
  if (fullWrap) return fullWrap[1];

  // Word colle souvent chaque paragraphe entièrement souligné.
  const paragraphMatches = [...withoutOuterWhitespace.matchAll(/<p\b[^>]*>([\s\S]*?)<\/p>/gi)];
  if (paragraphMatches.length === 0) return html;
  const allFullyUnderlined = paragraphMatches.every((match) => {
    const inner = match[1].trim();
    return /^<u\b[^>]*>[\s\S]*<\/u>$/i.test(inner) || inner === '<br />' || inner === '<br>';
  });
  if (!allFullyUnderlined) return html;
  return withoutOuterWhitespace.replace(/<\/?u(?=[\s>/])[^>]*>/gi, '');
}

export function sanitizeOrganizerRichText(
  value?: string | null,
  options: SanitizeOrganizerRichTextOptions = {}
) {
  const input = (value ?? '').trim();
  if (!input) return '';

  let html = /<\/?[a-z][\s\S]*>/i.test(input) ? input : convertPlainTextToRichTextHtml(input);

  html = html.replace(
    /<\s*(script|style|iframe|object|embed|form|input|button|textarea|select)[^>]*>[\s\S]*?<\s*\/\s*\1>/gi,
    ''
  );
  html = html.replace(/<!--[\s\S]*?-->/g, '');
  html = html.replace(/<\s*\/?\s*(html|head|body|meta|link|xml)[^>]*>/gi, '');
  // Tags Word / Office
  html = html.replace(/<\/?(?:o:p|w:[a-z]+|m:[a-z]+)[^>]*>/gi, '');
  html = html.replace(/<(\/?)div\b/gi, '<$1p');
  html = html.replace(/<(\/?)span\b[^>]*>/gi, '');
  html = html.replace(/<(\/?)font\b[^>]*>/gi, '');
  html = html.replace(/\son\w+\s*=\s*(['"]).*?\1/gi, '');
  html = html.replace(/\son\w+\s*=\s*[^\s>]+/gi, '');
  html = html.replace(/\s(?:style|class|id|dir|lang|data-[\w-]+)\s*=\s*(['"]).*?\1/gi, '');
  html = html.replace(/<(?!\/?(p|br|strong|b|em|i|u|ul|ol|li)\b)[^>]+>/gi, '');

  if (options.stripUnderline) {
    html = html.replace(/<\/?u(?=[\s>/])[^>]*>/gi, '');
  } else {
    html = unwrapFullDocumentUnderline(html);
  }

  html = html.replace(/<((?:strong|em|ul|ol|li|br|p|b|i|u))\b([^>]*)>/gi, '<$1>');
  html = html.replace(/<br[^>]*>/gi, '<br />');
  html = normalizeEmptyParagraphs(html);
  // Evite les enchaînements excessifs de paragraphes vides (plus de 2 d'affilée)
  html = html.replace(/(?:<p><br \/><\/p>){3,}/gi, '<p><br /></p><p><br /></p>');

  return applyFrenchNbspBeforePunctuation(html.trim());
}

/** Nettoyage dédié au collage (Word, Docs, mail…) : structure + gras/italique/listes. */
export function sanitizeOrganizerRichTextFromPaste(html?: string | null, plainText?: string | null) {
  const rawHtml = (html ?? '').trim();
  if (rawHtml && /<\/?[a-z][\s\S]*>/i.test(rawHtml)) {
    return sanitizeOrganizerRichText(rawHtml, { stripUnderline: true });
  }
  return sanitizeOrganizerRichText(convertPlainTextToRichTextHtml(plainText ?? ''));
}

export function extractOrganizerRichTextPlainText(value?: string | null) {
  const description = extractOrganizerDurationMeta(value).description;
  if (!description) return '';
  return stripHtmlTags(sanitizeOrganizerRichText(description));
}

export function extractOrganizerDurationMeta(value?: string | null) {
  const raw = value ?? '';
  const match = raw.match(/<!--\s*resacolo:duration:(\d*):(\d*)\s*-->/i);
  const parseValue = (input?: string) => {
    if (!input) return null;
    const parsed = Number(input);
    return Number.isFinite(parsed) && parsed > 0 ? parsed : null;
  };

  return {
    description: stripOrganizerDescriptionMeta(raw) || null,
    stayDurationMinDays: parseValue(match?.[1]),
    stayDurationMaxDays: parseValue(match?.[2])
  };
}

export function embedOrganizerDurationMeta(
  description: string | null | undefined,
  stayDurationMinDays: number | null,
  stayDurationMaxDays: number | null
) {
  const cleanedDescription = stripOrganizerDescriptionMeta(description);

  if (stayDurationMinDays == null && stayDurationMaxDays == null) {
    return cleanedDescription || null;
  }

  const meta = `<!-- resacolo:duration:${stayDurationMinDays ?? ''}:${stayDurationMaxDays ?? ''} -->`;
  return cleanedDescription ? `${cleanedDescription}\n${meta}` : meta;
}

export function buildOrganizerPresentationHtml(description: string | null | undefined, publicAgeRange: string) {
  const sanitized = sanitizeOrganizerRichText(description);
  if (sanitized) return sanitized;

  return convertPlainTextToRichTextHtml(
    `Cet organisateur de séjours collectifs propose des colonies de vacances et séjours pour les ${publicAgeRange}.`
  );
}

export function extractOrganizerPresentationSummary(description: string | null | undefined, publicAgeRange: string) {
  const sanitized = sanitizeOrganizerRichText(description);
  const text = stripHtmlTags(sanitized);
  if (text) {
    const [firstParagraph] = text.split(/\n{2,}|\n/).map((item) => item.trim()).filter(Boolean);
    if (firstParagraph) return firstParagraph;
  }

  return `Cet organisateur de séjours collectifs propose des colonies de vacances et séjours pour les ${publicAgeRange}.`;
}
