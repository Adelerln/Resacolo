const HERO_TITLE_MAX_LENGTH = 80;
const HERO_BODY_MAX_LENGTH = 280;
const HERO_CTA_LABEL_MAX_LENGTH = 40;
const HERO_CTA_URL_MAX_LENGTH = 500;

export type PartnerHeroInput = {
  heroEnabled: boolean;
  heroTitle: string | null;
  heroBody: string | null;
  heroCtaLabel: string | null;
  heroCtaUrl: string | null;
};

function normalizeOptionalText(value: FormDataEntryValue | null, maxLength: number) {
  const normalized = String(value ?? '').trim();
  if (!normalized) return null;
  return normalized.slice(0, maxLength);
}

function isAllowedHeroUrl(value: string) {
  if (value.startsWith('/')) return true;
  try {
    const parsed = new URL(value);
    return parsed.protocol === 'https:' || parsed.protocol === 'http:';
  } catch {
    return false;
  }
}

export function parsePartnerHeroInput(formData: FormData): PartnerHeroInput {
  const heroEnabled = formData.get('hero_enabled') === 'on';
  const heroTitle = normalizeOptionalText(formData.get('hero_title'), HERO_TITLE_MAX_LENGTH);
  const heroBody = normalizeOptionalText(formData.get('hero_body'), HERO_BODY_MAX_LENGTH);
  const heroCtaLabel = normalizeOptionalText(formData.get('hero_cta_label'), HERO_CTA_LABEL_MAX_LENGTH);
  const heroCtaUrl = normalizeOptionalText(formData.get('hero_cta_url'), HERO_CTA_URL_MAX_LENGTH);

  if (heroCtaUrl && !isAllowedHeroUrl(heroCtaUrl)) {
    throw new Error("L'URL du bouton hero doit commencer par /, https:// ou http://.");
  }

  return {
    heroEnabled,
    heroTitle,
    heroBody,
    heroCtaLabel,
    heroCtaUrl
  };
}

export function hasRenderablePartnerHero(input: {
  heroEnabled: boolean | null | undefined;
  heroTitle: string | null | undefined;
  heroBody: string | null | undefined;
}) {
  return Boolean(input.heroEnabled && (input.heroTitle?.trim() || input.heroBody?.trim()));
}
