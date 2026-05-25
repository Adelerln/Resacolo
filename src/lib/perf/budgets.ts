export const TRACKED_WEB_VITAL_METRICS = ['LCP', 'INP', 'CLS', 'FCP', 'TTFB'] as const;

export type TrackedWebVitalMetric = (typeof TRACKED_WEB_VITAL_METRICS)[number];

export const PERF_PAGE_TEMPLATES = ['home', 'catalog', 'stay-detail', 'checkout'] as const;

export type PerfPageTemplate = (typeof PERF_PAGE_TEMPLATES)[number];

export const PERF_BUDGETS: Record<PerfPageTemplate, Record<TrackedWebVitalMetric, number>> = {
  home: {
    LCP: 2500,
    INP: 200,
    CLS: 0.1,
    FCP: 1800,
    TTFB: 800
  },
  catalog: {
    LCP: 2500,
    INP: 200,
    CLS: 0.1,
    FCP: 1800,
    TTFB: 900
  },
  'stay-detail': {
    LCP: 2500,
    INP: 200,
    CLS: 0.1,
    FCP: 1900,
    TTFB: 900
  },
  checkout: {
    LCP: 2500,
    INP: 200,
    CLS: 0.1,
    FCP: 1900,
    TTFB: 900
  }
};

export function isTrackedWebVitalMetric(value: unknown): value is TrackedWebVitalMetric {
  return typeof value === 'string' && TRACKED_WEB_VITAL_METRICS.includes(value as TrackedWebVitalMetric);
}

export function isPerfPageTemplate(value: unknown): value is PerfPageTemplate {
  return typeof value === 'string' && PERF_PAGE_TEMPLATES.includes(value as PerfPageTemplate);
}

export function resolvePerfPageTemplate(pathname: string): PerfPageTemplate | null {
  if (pathname === '/') return 'home';
  if (pathname === '/sejours') return 'catalog';
  if (pathname.startsWith('/sejours/')) return 'stay-detail';
  if (pathname.startsWith('/checkout')) return 'checkout';
  return null;
}
