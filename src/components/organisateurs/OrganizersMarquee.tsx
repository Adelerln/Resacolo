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

  // Défilement continu, fluide, façon bandeau
  useEffect(() => {
    if (!shouldAnimate) return;
    const track = trackRef.current;
    if (!track) return;

    let frameId: number;
    const speed = 0.4; // pixels par frame (~24px/s à 60fps)

    const loop = () => {
      if (!track) return;
      track.scrollLeft += speed;
      const halfWidth = track.scrollWidth / 2;
      if (track.scrollLeft >= halfWidth) {
        track.scrollLeft = 0;
      }
      frameId = window.requestAnimationFrame(loop);
    };

    frameId = window.requestAnimationFrame(loop);

    return () => window.cancelAnimationFrame(frameId);
  }, [shouldAnimate, repeated.length]);

  const scrollByAmount = (direction: 'left' | 'right') => {
    const track = trackRef.current;
    if (!track) return;
    const delta = direction === 'left' ? -220 : 220;
    track.scrollTo({
      left: track.scrollLeft + delta,
      behavior: 'smooth'
    });
  };

  const content = (
    <div className="mx-auto max-w-5xl rounded-3xl border border-slate-200 bg-white/80 px-6 py-6 shadow-sm">
      <p className="text-xs uppercase tracking-wide text-slate-500">Organisateurs partenaires</p>
      {loading && logos.length === 0 ? (
        <p className="mt-4 text-sm text-slate-500">Chargement des logos…</p>
      ) : (
        <div className="mt-6 flex items-center justify-between gap-4">
          <button
            type="button"
            onClick={() => scrollByAmount('left')}
            className="rounded-full border border-slate-200 bg-white/90 p-2 text-slate-600 shadow-sm transition hover:text-slate-900"
            aria-label="Faire défiler vers la gauche"
          >
            <ChevronLeft size={20} />
          </button>
          <div ref={trackRef} className="flex-1 overflow-hidden">
            <div className="flex w-max items-center gap-8">
              {repeated.map((org, index) => {
                const isDuplicate = index >= logos.length;
                return (
                  <div
                    key={`${org.id}-${index}`}
                    className="flex h-[108px] w-[150px] items-center justify-center"
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
      <div className="section-container flex justify-center">{content}</div>
    </section>
  );
}

