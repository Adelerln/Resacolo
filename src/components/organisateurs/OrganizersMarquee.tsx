'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
import { ChevronLeft, ChevronRight } from 'lucide-react';

type OrganizerLogo = {
  id: string;
  name: string;
  logoUrl: string;
};

type OrganizersMarqueeProps = {
  embedded?: boolean;
};

export function OrganizersMarquee({ embedded = false }: OrganizersMarqueeProps) {
  const [logos, setLogos] = useState<OrganizerLogo[]>([]);
  const [loading, setLoading] = useState(true);
  const trackRef = useRef<HTMLDivElement | null>(null);
  const step = 174;
  const [edgePadding, setEdgePadding] = useState(0);

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
    return [...logos, ...logos];
  }, [logos]);

  const shouldAnimate = logos.length > 0;

  useEffect(() => {
    if (!shouldAnimate) return;
    const track = trackRef.current;
    if (!track) return;

    track.scrollLeft = Math.round(track.scrollLeft / step) * step;

    const intervalId = window.setInterval(() => {
      const next = Math.round((track.scrollLeft + step) / step) * step;
      track.scrollLeft = next;
      if (track.scrollLeft >= track.scrollWidth / 2) {
        track.scrollLeft = 0;
      }
    }, 2000);

    return () => window.clearInterval(intervalId);
  }, [shouldAnimate, logos.length]);

  useEffect(() => {
    const track = trackRef.current;
    if (!track) return;

    const updatePadding = () => {
      const remainder = track.clientWidth % step;
      setEdgePadding(remainder > 0 ? remainder / 2 : 0);
    };

    updatePadding();
    const observer = new ResizeObserver(updatePadding);
    observer.observe(track);

    return () => observer.disconnect();
  }, [step]);

  const scrollByAmount = (direction: 'left' | 'right') => {
    const track = trackRef.current;
    if (!track) return;
    const delta = direction === 'left' ? -step : step;
    const next = Math.round((track.scrollLeft + delta) / step) * step;
    track.scrollLeft = next < 0 ? 0 : next;
  };

  const content = (
    <div className="rounded-3xl border border-slate-200 bg-white/80 px-6 py-6 shadow-sm">
      <p className="text-xs uppercase tracking-wide text-slate-500">Organisateurs partenaires</p>
      {loading && logos.length === 0 ? (
        <p className="mt-4 text-sm text-slate-500">Chargement des logos…</p>
      ) : (
        <div className="mt-6 flex items-center gap-4">
          <button
            type="button"
            onClick={() => scrollByAmount('left')}
            className="rounded-full border border-slate-200 bg-white/90 p-2 text-slate-600 shadow-sm transition hover:text-slate-900"
            aria-label="Faire défiler vers la gauche"
          >
            <ChevronLeft size={20} />
          </button>
          <div ref={trackRef} className="w-full max-w-[870px] overflow-hidden snap-x snap-mandatory">
            <div className="flex w-max items-center gap-6" style={{ paddingLeft: edgePadding, paddingRight: edgePadding }}>
              {repeated.map((org, index) => {
                const isDuplicate = index >= logos.length;
                return (
                  <div
                    key={`${org.id}-${index}`}
                    className="flex h-[108px] w-[150px] items-center justify-center snap-start snap-always"
                    aria-hidden={isDuplicate ? true : undefined}
                  >
                    <img
                      src={org.logoUrl}
                      alt={isDuplicate ? '' : org.name}
                      className="max-h-[88px] w-auto object-contain opacity-95"
                      loading="lazy"
                      decoding="async"
                    />
                  </div>
                );
              })}
            </div>
          </div>
          <button
            type="button"
            onClick={() => scrollByAmount('right')}
            className="rounded-full border border-slate-200 bg-white/90 p-2 text-slate-600 shadow-sm transition hover:text-slate-900"
            aria-label="Faire défiler vers la droite"
          >
            <ChevronRight size={20} />
          </button>
        </div>
      )}
    </div>
  );

  if (embedded) {
    return content;
  }

  return (
    <section className="py-10">
      <div className="section-container">{content}</div>
    </section>
  );
}
