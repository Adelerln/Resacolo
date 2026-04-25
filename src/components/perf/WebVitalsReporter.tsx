'use client';

import { useEffect, useRef } from 'react';
import { useReportWebVitals } from 'next/web-vitals';
import { usePathname } from 'next/navigation';
import { PERF_BUDGETS, isTrackedWebVitalMetric, resolvePerfPageTemplate } from '@/lib/perf/budgets';

type DeviceType = 'mobile' | 'tablet' | 'desktop';
type WebVitalRating = 'good' | 'needs-improvement' | 'poor';

type WebVitalMetric = {
  id: string;
  name: string;
  value: number;
  rating?: WebVitalRating;
  delta?: number;
  startTime?: number;
  navigationType?: string;
  entries?: PerformanceEntry[];
};

type WebVitalPayload = {
  route: string;
  pageTemplate: string;
  metricName: string;
  metricValue: number;
  rating: 'good' | 'needs-improvement' | 'poor' | null;
  navigationType: string | null;
  deviceType: DeviceType;
  connectionType: string | null;
  withinBudget: boolean | null;
  budgetTarget: number | null;
  userAgent: string | null;
  details: Record<string, unknown>;
};

const BLOCKED_PREFIXES = ['/admin', '/organisme', '/partenaire', '/mnemos', '/back-office'];
const USER_AGENT_MAX_LENGTH = 240;

function detectDeviceType(): DeviceType {
  if (typeof window === 'undefined') return 'desktop';
  const width = window.innerWidth;
  if (width < 768) return 'mobile';
  if (width < 1024) return 'tablet';
  return 'desktop';
}

function detectConnectionType() {
  if (typeof navigator === 'undefined') return null;
  const connection = (navigator as Navigator & { connection?: { effectiveType?: string } }).connection;
  return typeof connection?.effectiveType === 'string' ? connection.effectiveType : null;
}

function sanitizeUserAgent(value: string | null) {
  if (!value) return null;
  const trimmed = value.trim();
  if (!trimmed) return null;
  return trimmed.length > USER_AGENT_MAX_LENGTH ? trimmed.slice(0, USER_AGENT_MAX_LENGTH) : trimmed;
}

function sendPayload(payload: WebVitalPayload) {
  if (typeof navigator !== 'undefined' && typeof navigator.sendBeacon === 'function') {
    const body = new Blob([JSON.stringify(payload)], { type: 'application/json' });
    if (navigator.sendBeacon('/api/perf/web-vitals', body)) {
      return;
    }
  }

  void fetch('/api/perf/web-vitals', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    keepalive: true,
    body: JSON.stringify(payload)
  });
}

export function WebVitalsReporter() {
  const pathname = usePathname();
  const pathnameRef = useRef(pathname);

  useEffect(() => {
    pathnameRef.current = pathname;
  }, [pathname]);

  useReportWebVitals((metric: WebVitalMetric) => {
    if (!isTrackedWebVitalMetric(metric.name)) return;

    const route = pathnameRef.current || (typeof window !== 'undefined' ? window.location.pathname : '');
    if (!route || BLOCKED_PREFIXES.some((prefix) => route.startsWith(prefix))) return;

    const pageTemplate = resolvePerfPageTemplate(route);
    if (!pageTemplate) return;

    const budgetTarget = PERF_BUDGETS[pageTemplate][metric.name];
    const metricValue = Number(metric.value);
    const isFiniteValue = Number.isFinite(metricValue);
    const withinBudget =
      isFiniteValue && Number.isFinite(budgetTarget) ? metricValue <= Number(budgetTarget) : null;

    sendPayload({
      route,
      pageTemplate,
      metricName: metric.name,
      metricValue: isFiniteValue ? metricValue : 0,
      rating: metric.rating ?? null,
      navigationType: metric.navigationType ?? null,
      deviceType: detectDeviceType(),
      connectionType: detectConnectionType(),
      withinBudget,
      budgetTarget,
      userAgent: sanitizeUserAgent(typeof navigator !== 'undefined' ? navigator.userAgent : null),
      details: {
        id: metric.id,
        startTime: metric.startTime,
        delta: metric.delta,
        entries: metric.entries?.length ?? 0
      }
    });
  });

  return null;
}
