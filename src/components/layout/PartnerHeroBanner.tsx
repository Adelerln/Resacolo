'use client';

import Link from 'next/link';
import type { CSSProperties } from 'react';
import type { PublicSitePartnerBranding } from '@/types/partner-branding';
import { hasRenderablePartnerHero } from '@/lib/partner-hero';

function computeOverlay(primaryColor: string | null) {
  if (!primaryColor) return 'linear-gradient(135deg, #ea580c 0%, #f97316 55%, #fb923c 100%)';
  return `linear-gradient(135deg, ${primaryColor} 0%, ${primaryColor}dd 55%, ${primaryColor}bb 100%)`;
}

export function PartnerHeroBanner({
  branding
}: {
  branding: PublicSitePartnerBranding;
}) {
  if (!branding) return null;
  if (
    !hasRenderablePartnerHero({
      heroEnabled: branding.heroEnabled,
      heroTitle: branding.heroTitle,
      heroBody: branding.heroBody
    })
  ) {
    return null;
  }

  const style = {
    '--partner-hero-bg': computeOverlay(branding.primaryColor)
  } as CSSProperties;

  return (
    <section className="border-b border-slate-200 bg-[image:var(--partner-hero-bg)] text-white" style={style}>
      <div className="mx-auto w-full max-w-6xl px-4 py-7 sm:px-6 sm:py-8 lg:px-8">
        <div className="flex flex-col gap-4 sm:gap-5">
          {branding.heroTitle?.trim() ? (
            <h2 className="max-w-4xl text-2xl font-bold leading-tight sm:text-3xl">{branding.heroTitle}</h2>
          ) : null}
          {branding.heroBody?.trim() ? (
            <p className="max-w-3xl whitespace-pre-line text-sm font-medium leading-relaxed text-white/95 sm:text-base">
              {branding.heroBody}
            </p>
          ) : null}
          {branding.heroCtaLabel?.trim() && branding.heroCtaUrl?.trim() ? (
            <div>
              <Link
                href={branding.heroCtaUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex min-h-[44px] items-center rounded-lg bg-white px-4 py-2.5 text-sm font-semibold text-slate-900 shadow-sm transition hover:bg-slate-100 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white focus-visible:ring-offset-2 focus-visible:ring-offset-transparent"
              >
                {branding.heroCtaLabel}
              </Link>
            </div>
          ) : null}
        </div>
      </div>
    </section>
  );
}
