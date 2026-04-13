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
    .replace(/<\/p>/gi, '\n')
    .replace(/<[^>]+>/g, ' ')
    .replace(/\s+\n/g, '\n')
    .replace(/\n{3,}/g, '\n\n')
    .replace(/[ \t]{2,}/g, ' ')
    .trim();
}

const ORGANIZER_DURATION_META_PATTERN = /<!--\s*resacolo:duration:(\d*):(\d*)\s*-->/i;

export function convertPlainTextToRichTextHtml(value: string) {
  const paragraphs = value
    .trim()
    .split(/\n{2,}/)
    .map((paragraph) => paragraph.trim())
    .filter(Boolean);

  if (paragraphs.length === 0) return '';

  return paragraphs
    .map((paragraph) => `<p>${escapeHtml(paragraph).replace(/\n/g, '<br />')}</p>`)
    .join('');
}

export function sanitizeOrganizerRichText(value?: string | null) {
  const input = (value ?? '').trim();
  if (!input) return '';

  let html = /<\/?[a-z][\s\S]*>/i.test(input) ? input : convertPlainTextToRichTextHtml(input);

  html = html.replace(
    /<\s*(script|style|iframe|object|embed|form|input|button|textarea|select)[^>]*>[\s\S]*?<\s*\/\s*\1>/gi,
    ''
  );
  html = html.replace(/<!--[\s\S]*?-->/g, '');
  html = html.replace(/<\s*\/?\s*(html|head|body)[^>]*>/gi, '');
  html = html.replace(/<(\/?)div\b/gi, '<$1p');
  html = html.replace(/<(\/?)span\b[^>]*>/gi, '');
  html = html.replace(/\son\w+\s*=\s*(['"]).*?\1/gi, '');
  html = html.replace(/\son\w+\s*=\s*[^\s>]+/gi, '');
  html = html.replace(/\s(?:style|class|id|data-[\w-]+)\s*=\s*(['"]).*?\1/gi, '');
  html = html.replace(/<(?!\/?(p|br|strong|b|em|i|u|ul|ol|li)\b)[^>]+>/gi, '');
  html = html.replace(/<p>\s*<\/p>/gi, '');
  html = html.replace(/<(strong|b|em|i|u|li|p|ul|ol)([^>]*)>/gi, '<$1>');
  html = html.replace(/<br>/gi, '<br />');

  return html.trim();
}

export function extractOrganizerDurationMeta(value?: string | null) {
  const raw = value ?? '';
  const match = raw.match(ORGANIZER_DURATION_META_PATTERN);
  const parseValue = (input?: string) => {
    if (!input) return null;
    const parsed = Number(input);
    return Number.isFinite(parsed) && parsed > 0 ? parsed : null;
  };

  return {
    description: raw.replace(ORGANIZER_DURATION_META_PATTERN, '').trim() || null,
    stayDurationMinDays: parseValue(match?.[1]),
    stayDurationMaxDays: parseValue(match?.[2])
  };
}

export function embedOrganizerDurationMeta(
  description: string | null | undefined,
  stayDurationMinDays: number | null,
  stayDurationMaxDays: number | null
) {
  const cleanedDescription = (description ?? '').replace(ORGANIZER_DURATION_META_PATTERN, '').trim();

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
