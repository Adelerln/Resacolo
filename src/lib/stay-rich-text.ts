/**
 * HTML autorisé dans les rubriques éditoriales d’un séjour :
 * gras + listes à puces uniquement (pas d’italique ni de souligné).
 */

function escapeHtml(value: string) {
  return value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

export function convertPlainTextToStayRichTextHtml(value: string) {
  const normalized = value
    .replace(/\r\n/g, '\n')
    .replace(/\r/g, '\n')
    .replace(/^\n+|\n+$/g, '');
  if (!normalized.trim()) return '';

  const parts = normalized.split(/(\n{2,})/);
  const htmlParts: string[] = [];

  for (const part of parts) {
    if (/^\n+$/.test(part)) {
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

export function looksLikeStayRichTextHtml(value?: string | null) {
  const input = (value ?? '').trim();
  if (!input) return false;
  return /<\/?(?:p|br|strong|b|ul|ol|li)\b/i.test(input);
}

export function sanitizeStayRichText(value?: string | null) {
  const input = (value ?? '').trim();
  if (!input) return '';

  let html = /<\/?[a-z][\s\S]*>/i.test(input) ? input : convertPlainTextToStayRichTextHtml(input);

  html = html.replace(
    /<\s*(script|style|iframe|object|embed|form|input|button|textarea|select)[^>]*>[\s\S]*?<\s*\/\s*\1>/gi,
    ''
  );
  html = html.replace(/<!--[\s\S]*?-->/g, '');
  html = html.replace(/<\s*\/?\s*(html|head|body|meta|link|xml)[^>]*>/gi, '');
  html = html.replace(/<\/?(?:o:p|w:[a-z]+|m:[a-z]+)[^>]*>/gi, '');
  html = html.replace(/<(\/?)div\b/gi, '<$1p');
  html = html.replace(/<(\/?)span\b[^>]*>/gi, '');
  html = html.replace(/<(\/?)font\b[^>]*>/gi, '');
  // Pas d’italique / souligné sur les fiches séjour.
  html = html.replace(/<\/?(?:em|i|u)\b[^>]*>/gi, '');
  html = html.replace(/\son\w+\s*=\s*(['"]).*?\1/gi, '');
  html = html.replace(/\son\w+\s*=\s*[^\s>]+/gi, '');
  html = html.replace(/\s(?:style|class|id|dir|lang|data-[\w-]+)\s*=\s*(['"]).*?\1/gi, '');
  html = html.replace(/<(?!\/?(p|br|strong|b|ul|ol|li)\b)[^>]+>/gi, '');
  html = html.replace(/<((?:strong|ul|ol|li|br|p|b))\b([^>]*)>/gi, '<$1>');
  html = html.replace(/<br[^>]*>/gi, '<br />');
  html = normalizeEmptyParagraphs(html);
  html = html.replace(/(?:<p><br \/><\/p>){3,}/gi, '<p><br /></p><p><br /></p>');
  html = html.trim();

  // Contenu « vide » (paragraphes blancs uniquement) → chaîne vide.
  const plainProbe = html
    .replace(/<br\s*\/?>/gi, '')
    .replace(/<[^>]+>/g, '')
    .replace(/&nbsp;|&#160;/gi, ' ')
    .trim();
  if (!plainProbe) return '';

  return html;
}

export function sanitizeStayRichTextFromPaste(html?: string | null, plainText?: string | null) {
  const rawHtml = (html ?? '').trim();
  if (rawHtml && /<\/?[a-z][\s\S]*>/i.test(rawHtml)) {
    return sanitizeStayRichText(rawHtml);
  }
  return sanitizeStayRichText(convertPlainTextToStayRichTextHtml(plainText ?? ''));
}

export function stripStayRichTextToPlain(value?: string | null) {
  const sanitized = sanitizeStayRichText(value);
  if (!sanitized) return '';
  return sanitized
    .replace(/<br\s*\/?>/gi, '\n')
    .replace(/<\/(p|div|li)>/gi, '\n')
    .replace(/<li>/gi, '- ')
    .replace(/<[^>]+>/g, '')
    .replace(/&nbsp;|&#160;/gi, ' ')
    .replace(/&amp;/gi, '&')
    .replace(/&lt;/gi, '<')
    .replace(/&gt;/gi, '>')
    .replace(/&quot;/gi, '"')
    .replace(/&#39;|&apos;/gi, "'")
    .replace(/\n{3,}/g, '\n\n')
    .trim();
}
