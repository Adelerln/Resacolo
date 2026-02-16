'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { mockOrganizers } from '@/lib/mockOrganizers';
import { OrganizerDetailModal } from './OrganizerDetailModal';

const SKY_BLUE = '#60A5FA';

interface OrganisateursGridWithModalProps {
  initialSlug?: string | null;
}

export function OrganisateursGridWithModal({ initialSlug }: OrganisateursGridWithModalProps) {
  const router = useRouter();
  const [selectedSlug, setSelectedSlug] = useState<string | null>(initialSlug ?? null);

  useEffect(() => {
    if (initialSlug) setSelectedSlug(initialSlug);
  }, [initialSlug]);

  const handleClose = () => {
    setSelectedSlug(null);
    router.replace('/organisateurs', { scroll: false });
  };

  return (
    <>
      <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-4">
        {mockOrganizers.map((org) => (
          <article
            key={org.slug}
            className="flex flex-col overflow-hidden rounded-xl border border-slate-200 bg-white shadow-md transition hover:shadow-lg"
          >
            <div className="flex min-h-[140px] flex-1 flex-col items-center justify-center px-4 py-8">
              {org.logoUrl ? (
                <img
                  src={org.logoUrl}
                  alt={org.name}
                  className="max-h-20 w-auto object-contain"
                />
              ) : (
                <div className="flex h-16 w-full items-center justify-center rounded-lg bg-slate-100">
                  <span className="text-xs font-semibold uppercase text-slate-400">
                    {org.name.slice(0, 2)}
                  </span>
                </div>
              )}
            </div>
            <div className="border-t border-slate-100 px-4 py-4">
              <h3 className="text-center text-sm font-bold uppercase leading-tight text-[#3B82F6]">
                {org.name}
              </h3>
              <ul className="mt-3 space-y-1 text-center text-xs text-slate-500">
                <li>Création : {org.creationYear}</li>
                <li>Public : {org.publicAgeRange}</li>
              </ul>
            </div>
            <button
              type="button"
              onClick={() => setSelectedSlug(org.slug)}
              className="flex w-full items-center justify-center rounded-b-xl px-4 py-3 text-sm font-semibold text-white transition hover:opacity-95"
              style={{ backgroundColor: SKY_BLUE }}
            >
              PLUS DE DÉTAILS
            </button>
          </article>
        ))}
      </div>

      {selectedSlug && (
        <OrganizerDetailModal
          slug={selectedSlug}
          onClose={handleClose}
        />
      )}
    </>
  );
}
