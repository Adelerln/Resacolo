'use client';

import Link from 'next/link';
import { useState } from 'react';
import { ExternalLink, Info } from 'lucide-react';
import type { Stay } from '@/types/stay';
import { FILTER_LABELS } from '@/lib/constants';

interface StayCardProps {
  stay: Stay;
}

function formatPrice(price?: number | null) {
  if (!price) return 'Tarif sur demande';
  return new Intl.NumberFormat('fr-FR', {
    style: 'currency',
    currency: 'EUR',
    maximumFractionDigits: 0
  }).format(price);
}

function formatLabel(group: keyof typeof FILTER_LABELS, value: string) {
  return FILTER_LABELS[group][value as keyof (typeof FILTER_LABELS)[typeof group]] ?? value;
}

export function StayCard({ stay }: StayCardProps) {
  const [expanded, setExpanded] = useState(false);

  return (
    <article className="flex flex-col gap-4 rounded-xl border border-slate-200 bg-white p-6 shadow-sm">
      <header className="flex flex-col gap-3 md:flex-row md:items-start md:justify-between">
        <div>
          <p className="text-xs uppercase tracking-wide text-brand-600">{stay.organizer.name}</p>
          <h3 className="text-xl font-semibold text-slate-900">
            <Link href={`/sejours/${stay.slug}`}>{stay.title}</Link>
          </h3>
          <p className="text-sm text-slate-500">
            {stay.location} · {stay.duration} · {stay.ageRange}
          </p>
        </div>
        <div className="flex flex-col items-start gap-2 text-right md:items-end">
          <p className="text-lg font-semibold text-brand-600">{formatPrice(stay.priceFrom)}</p>
          <a
            href={stay.sourceUrl ?? stay.organizer.website}
            target="_blank"
            rel="noreferrer"
            className="inline-flex items-center gap-1 text-xs font-medium text-brand-600 hover:text-brand-700"
          >
            Voir sur le site <ExternalLink className="h-3 w-3" />
          </a>
        </div>
      </header>
      <p className="text-sm text-slate-600">{stay.summary}</p>
      <div className="flex flex-wrap gap-2">
        {stay.filters.categories.map((category) => (
          <span key={category} className="rounded-full bg-brand-50 px-3 py-1 text-xs font-medium text-brand-700">
            {formatLabel('categories', category)}
          </span>
        ))}
        {stay.filters.audiences.map((audience) => (
          <span key={audience} className="rounded-full bg-slate-100 px-3 py-1 text-xs font-medium text-slate-700">
            {formatLabel('audiences', audience)}
          </span>
        ))}
      </div>
      <div className="space-y-2 text-sm text-slate-600">
        <div className="flex items-center justify-between">
          <button
            type="button"
            onClick={() => setExpanded((prev) => !prev)}
            className="text-xs font-medium uppercase tracking-wide text-brand-600"
          >
            {expanded ? 'Masquer le détail' : 'Voir un aperçu'}
          </button>
          <Link
            href={`/sejours/${stay.slug}`}
            className="inline-flex items-center gap-1 text-xs font-medium text-brand-600 hover:text-brand-700"
          >
            Fiche complète <Info className="h-3 w-3" />
          </Link>
        </div>
        {expanded && (
          <div className="space-y-3">
            <div>
              <h4 className="text-sm font-semibold text-slate-800">Programme</h4>
              <p className="mt-1 whitespace-pre-line text-sm leading-relaxed text-slate-600">{stay.description}</p>
            </div>
            {stay.highlights.length > 0 && (
              <div>
                <h4 className="text-sm font-semibold text-slate-800">Moments forts</h4>
                <ul className="mt-1 list-disc space-y-1 pl-5 text-sm text-slate-600">
                  {stay.highlights.map((highlight) => (
                    <li key={highlight}>{highlight}</li>
                  ))}
                </ul>
              </div>
            )}
            <div className="grid gap-2 text-xs">
              <p>
                <span className="font-medium text-slate-700">Périodes :</span>{' '}
                {stay.period.map((period) => formatLabel('periods', period)).join(', ')}
              </p>
              <p>
                <span className="font-medium text-slate-700">Transport :</span>{' '}
                {stay.filters.transport.map((value) => formatLabel('transport', value)).join(', ')}
              </p>
            </div>
          </div>
        )}
      </div>
    </article>
  );
}
