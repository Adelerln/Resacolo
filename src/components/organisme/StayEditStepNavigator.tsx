'use client';

import { useEffect, useMemo, useState } from 'react';
import { cn } from '@/lib/utils';

export type StayEditStepId = 'sessions' | 'sejour' | 'transports' | 'options' | 'assurances' | 'seo';

type Step = { id: StayEditStepId; label: string };

const DEFAULT_STEPS: Step[] = [
  { id: 'sessions', label: 'Sessions' },
  { id: 'sejour', label: 'Séjour' },
  { id: 'transports', label: 'Transports' },
  { id: 'options', label: 'Options' },
  { id: 'assurances', label: 'Assurances' },
  { id: 'seo', label: 'SEO' }
];

function normalizeHash(value: string): string {
  return value.replace(/^#/, '').trim();
}

export default function StayEditStepNavigator({
  steps = DEFAULT_STEPS,
  rootMargin = '-30% 0px -60% 0px'
}: {
  steps?: Step[];
  rootMargin?: string;
}) {
  const stepIds = useMemo(() => steps.map((s) => s.id), [steps]);
  const [active, setActive] = useState<StayEditStepId>(() => {
    const initial = normalizeHash(typeof window !== 'undefined' ? window.location.hash : '');
    return (stepIds.includes(initial as StayEditStepId) ? (initial as StayEditStepId) : steps[0]?.id) ?? 'sejour';
  });

  useEffect(() => {
    const onHashChange = () => {
      const h = normalizeHash(window.location.hash);
      if (stepIds.includes(h as StayEditStepId)) setActive(h as StayEditStepId);
    };
    window.addEventListener('hashchange', onHashChange);
    return () => window.removeEventListener('hashchange', onHashChange);
  }, [stepIds]);

  useEffect(() => {
    const els = steps
      .map((s) => document.getElementById(s.id))
      .filter((el): el is HTMLElement => Boolean(el));
    if (els.length === 0) return;

    const observer = new IntersectionObserver(
      (entries) => {
        const visible = entries
          .filter((e) => e.isIntersecting)
          .sort((a, b) => (b.intersectionRatio ?? 0) - (a.intersectionRatio ?? 0))[0];
        const id = visible?.target?.id;
        if (id && stepIds.includes(id as StayEditStepId)) setActive(id as StayEditStepId);
      },
      { root: null, threshold: [0.05, 0.15, 0.3, 0.5], rootMargin }
    );

    for (const el of els) observer.observe(el);
    return () => observer.disconnect();
  }, [steps, stepIds, rootMargin]);

  return (
    <div className="space-y-3 rounded-2xl border border-slate-200 bg-white p-4 sm:p-6">
      <div>
        <h2 className="text-lg font-semibold text-slate-900">Modification du séjour</h2>
        <p className="mt-1 text-sm text-slate-600">Même tunnel que la validation d’un draft (étapes).</p>
      </div>

      <nav aria-label="Étapes de modification du séjour">
        <ul className="flex snap-x snap-mandatory gap-2 overflow-x-auto pb-1 sm:flex-wrap sm:justify-between sm:gap-3 sm:overflow-visible">
          {steps.map((step) => {
            const isActive = active === step.id;
            return (
              <li key={step.id} className="snap-start shrink-0 sm:flex-1 sm:min-w-0">
                <a
                  href={`#${step.id}`}
                  aria-current={isActive ? 'step' : undefined}
                  className={cn(
                    'flex h-full min-h-[64px] w-[110px] items-center justify-center rounded-xl border px-2 py-2.5 text-center text-[11px] font-semibold transition sm:w-full',
                    isActive
                      ? 'border-orange-400 bg-orange-50/90 ring-2 ring-orange-200/80 text-orange-900'
                      : 'border-slate-200 bg-slate-50/80 text-slate-800 hover:border-slate-300 hover:bg-white'
                  )}
                >
                  {step.label}
                </a>
              </li>
            );
          })}
        </ul>
      </nav>
    </div>
  );
}

