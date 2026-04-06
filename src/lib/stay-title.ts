const TITLE_LOWERCASE_WORDS = new Set([
  'a',
  'à',
  'au',
  'aux',
  'de',
  'du',
  'des',
  'en',
  'et',
  'l',
  'la',
  'le',
  'les',
  'ou',
  'par',
  'pour',
  'sur',
  'un',
  'une'
]);

function normalizeWhitespace(value: string | null | undefined): string {
  if (!value) return '';
  return value.replace(/\s+/g, ' ').trim();
}

function simplifyForMatch(value: string | null | undefined): string {
  return normalizeWhitespace(value)
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^\w\s']/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

function toStartCaseWord(word: string): string {
  if (!word) return '';
  const lower = word.toLocaleLowerCase('fr-FR');
  return lower.charAt(0).toLocaleUpperCase('fr-FR') + lower.slice(1);
}

export function normalizeStayTitle(value: string | null | undefined): string {
  const normalized = normalizeWhitespace(value);
  if (!normalized) return '';

  return normalized
    .split(' ')
    .filter(Boolean)
    .map((word, index) => {
      if (word.includes("'")) {
        const [prefix, suffix] = word.split("'", 2);
        const normalizedPrefix = prefix ? prefix.toLocaleLowerCase('fr-FR') : '';
        const normalizedSuffix = suffix ? toStartCaseWord(suffix) : '';
        if (index === 0) {
          return `${toStartCaseWord(prefix)}'${normalizedSuffix}`;
        }
        return `${normalizedPrefix}'${normalizedSuffix}`;
      }

      const key = simplifyForMatch(word);
      if (index > 0 && TITLE_LOWERCASE_WORDS.has(key)) {
        return word.toLocaleLowerCase('fr-FR');
      }
      return toStartCaseWord(word);
    })
    .join(' ')
    .replace(/\s+/g, ' ')
    .trim();
}
