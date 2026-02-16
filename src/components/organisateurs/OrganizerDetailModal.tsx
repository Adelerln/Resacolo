'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { X } from 'lucide-react';
import { StayCard } from '@/components/sejours/StayCard';
import type { Stay } from '@/types/stay';
import type { MockOrganizer } from '@/lib/mockOrganizers';

interface OrganizerDetailModalProps {
  slug: string;
  onClose: () => void;
}

type ApiResponse = {
  organizer: MockOrganizer;
  stays: Stay[];
};

export function OrganizerDetailModal({ slug, onClose }: OrganizerDetailModalProps) {
  const [data, setData] = useState<ApiResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);

  useEffect(() => {
    document.body.style.overflow = 'hidden';
    return () => {
      document.body.style.overflow = '';
    };
  }, []);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    setError(false);
    fetch(`/api/organisateurs/${encodeURIComponent(slug)}`)
      .then((res) => {
        if (!res.ok) throw new Error('Not found');
        return res.json();
      })
      .then((json: ApiResponse) => {
        if (!cancelled) setData(json);
      })
      .catch(() => {
        if (!cancelled) setError(true);
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [slug]);

  const handleBackdropClick = (e: React.MouseEvent) => {
    if (e.target === e.currentTarget) onClose();
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm"
      onClick={handleBackdropClick}
      role="dialog"
      aria-modal="true"
      aria-labelledby="organizer-modal-title"
    >
      <div
        className="flex max-h-[90vh] w-full max-w-2xl flex-col rounded-2xl bg-white shadow-2xl"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex flex-shrink-0 items-center justify-end border-b border-slate-200 px-4 py-3">
          <button
            type="button"
            onClick={onClose}
            className="rounded-full p-2 text-slate-500 hover:bg-slate-100 hover:text-slate-700"
            aria-label="Fermer"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        <div className="flex-1 overflow-y-auto">
          {loading && (
            <div className="flex items-center justify-center py-16">
              <div className="h-8 w-8 animate-spin rounded-full border-2 border-[#3B82F6] border-t-transparent" />
            </div>
          )}

          {error && (
            <div className="px-6 py-16 text-center text-slate-600">
              <p>Impossible de charger cet organisateur.</p>
              <button
                type="button"
                onClick={onClose}
                className="mt-4 text-sm font-medium text-[#3B82F6] hover:underline"
              >
                Fermer
              </button>
            </div>
          )}

          {data && !loading && (
            <div className="px-6 pb-8">
              <header className="flex flex-col items-center gap-4 border-b border-slate-200 py-8 text-center">
                {data.organizer.logoUrl ? (
                  <img
                    src={data.organizer.logoUrl}
                    alt={data.organizer.name}
                    className="h-20 w-auto object-contain"
                  />
                ) : (
                  <div className="flex h-20 w-20 items-center justify-center rounded-xl bg-slate-100">
                    <span className="text-xl font-bold uppercase text-slate-400">
                      {data.organizer.name.slice(0, 2)}
                    </span>
                  </div>
                )}
                <div>
                  <h2
                    id="organizer-modal-title"
                    className="font-display text-xl font-bold uppercase text-[#3B82F6] sm:text-2xl"
                  >
                    {data.organizer.name}
                  </h2>
                  <p className="mt-1 text-sm text-slate-500">
                    Création : {data.organizer.creationYear} · Public : {data.organizer.publicAgeRange}
                  </p>
                </div>
              </header>

              <section className="mt-8">
                <h3 className="mb-3 font-display text-lg font-semibold text-slate-900">
                  Présentation de l&apos;organisme
                </h3>
                <div className="rounded-xl border border-slate-200 bg-slate-50/50 p-4 text-slate-600 text-sm">
                  {data.organizer.description ? (
                    <p className="leading-relaxed">{data.organizer.description}</p>
                  ) : (
                    <p className="leading-relaxed">
                      Présentation à venir. Cet organisateur fait partie du collectif ResaColo et propose des colonies
                      de vacances pour les {data.organizer.publicAgeRange}.
                      {data.organizer.website && (
                        <>
                          {' '}
                          <a
                            href={data.organizer.website}
                            target="_blank"
                            rel="noreferrer"
                            className="font-medium text-[#3B82F6] hover:underline"
                          >
                            Visiter le site
                          </a>
                        </>
                      )}
                    </p>
                  )}
                </div>
              </section>

              <section className="mt-8">
                <h3 className="mb-4 font-display text-lg font-semibold text-slate-900">
                  Séjours proposés par cet organisme
                </h3>
                {data.stays.length > 0 ? (
                  <ul className="space-y-4">
                    {data.stays.map((stay) => (
                      <li key={stay.id}>
                        <StayCard stay={stay} />
                      </li>
                    ))}
                  </ul>
                ) : (
                  <div className="rounded-xl border border-slate-200 bg-slate-50/50 p-6 text-center text-slate-600 text-sm">
                    <p>Aucun séjour référencé pour le moment.</p>
                    <Link
                      href="/sejours"
                      className="mt-3 inline-block font-medium text-[#3B82F6] hover:underline"
                    >
                      Voir tous les séjours
                    </Link>
                  </div>
                )}
              </section>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
