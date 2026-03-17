'use client';

import { useEffect, useMemo, useState } from 'react';

type OrganizerLogo = {
  id: string;
  name: string;
  logoUrl: string;
};

export function OrganizersMarquee() {
  const [logos, setLogos] = useState<OrganizerLogo[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let isActive = true;

    const loadLogos = async () => {
      try {
        const response = await fetch('/api/organizers/logos', { cache: 'no-store' });
        if (!response.ok) throw new Error('Failed to load organizer logos');
        const data = (await response.json()) as { logos: OrganizerLogo[] };
        if (!isActive) return;
        setLogos(data.logos ?? []);
      } catch {
        if (!isActive) return;
        setLogos([]);
      } finally {
        if (isActive) setLoading(false);
      }
    };

    loadLogos();
    return () => {
      isActive = false;
    };
  }, []);

  const repeated = useMemo(() => {
    if (logos.length === 0) return [];
    if (logos.length < 8) return logos;
    return [...logos, ...logos];
  }, [logos]);

  const shouldAnimate = repeated.length > logos.length;

  return (
    <section className="py-10">
      <div className="section-container">
        <div className="rounded-3xl border border-slate-200 bg-white/80 px-6 py-6 shadow-sm">
          <p className="text-xs uppercase tracking-wide text-slate-500">Organisateurs partenaires</p>
          {loading && logos.length === 0 ? (
            <p className="mt-4 text-sm text-slate-500">Chargement des logos…</p>
          ) : (
            <div className="mt-6 overflow-hidden">
              <div className={`flex w-max items-center gap-10 ${shouldAnimate ? 'animate-marquee' : ''}`}>
                {repeated.map((org, index) => {
                  const isDuplicate = index >= logos.length;
                  return (
                    <div
                      key={`${org.id}-${index}`}
                      className="flex h-20 w-40 items-center justify-center"
                      aria-hidden={isDuplicate ? true : undefined}
                    >
                      <img
                        src={org.logoUrl}
                        alt={isDuplicate ? '' : org.name}
                        className="max-h-16 w-auto object-contain opacity-90"
                        loading="lazy"
                        decoding="async"
                      />
                    </div>
                  );
                })}
              </div>
            </div>
          )}
        </div>
      </div>
    </section>
  );
}
