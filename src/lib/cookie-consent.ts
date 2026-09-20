export const COOKIE_CONSENT_STORAGE_KEY = 'resacolo_cookie_consent_v1';
export const COOKIE_CONSENT_VERSION = 1;
/** Durée de validité du consentement (recommandation CNIL : 13 mois). */
export const COOKIE_CONSENT_MAX_AGE_MS = 13 * 30 * 24 * 60 * 60 * 1000;

export type CookieConsentPreferences = {
  version: number;
  necessary: true;
  analytics: boolean;
  decidedAt: string;
};

export type CookieConsentDecision = Pick<CookieConsentPreferences, 'analytics'>;

export function createCookieConsentPreferences(
  decision: CookieConsentDecision
): CookieConsentPreferences {
  return {
    version: COOKIE_CONSENT_VERSION,
    necessary: true,
    analytics: Boolean(decision.analytics),
    decidedAt: new Date().toISOString()
  };
}

export function parseCookieConsentPreferences(raw: string | null): CookieConsentPreferences | null {
  if (!raw) return null;
  try {
    const parsed = JSON.parse(raw) as Partial<CookieConsentPreferences>;
    if (parsed.version !== COOKIE_CONSENT_VERSION) return null;
    if (parsed.necessary !== true) return null;
    if (typeof parsed.analytics !== 'boolean') return null;
    if (typeof parsed.decidedAt !== 'string' || !parsed.decidedAt.trim()) return null;

    const decidedAtMs = Date.parse(parsed.decidedAt);
    if (!Number.isFinite(decidedAtMs)) return null;
    if (Date.now() - decidedAtMs > COOKIE_CONSENT_MAX_AGE_MS) return null;

    return {
      version: COOKIE_CONSENT_VERSION,
      necessary: true,
      analytics: parsed.analytics,
      decidedAt: parsed.decidedAt
    };
  } catch {
    return null;
  }
}

export function readCookieConsentPreferences(): CookieConsentPreferences | null {
  if (typeof window === 'undefined') return null;
  try {
    return parseCookieConsentPreferences(window.localStorage.getItem(COOKIE_CONSENT_STORAGE_KEY));
  } catch {
    return null;
  }
}

export function writeCookieConsentPreferences(preferences: CookieConsentPreferences) {
  if (typeof window === 'undefined') return;
  window.localStorage.setItem(COOKIE_CONSENT_STORAGE_KEY, JSON.stringify(preferences));
  window.dispatchEvent(
    new CustomEvent('resacolo:cookie-consent-changed', { detail: preferences })
  );
}

export function hasAnalyticsConsent(preferences: CookieConsentPreferences | null | undefined) {
  return Boolean(preferences?.analytics);
}
