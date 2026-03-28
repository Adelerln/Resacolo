'use client';

import { useEffect, useRef, useState } from 'react';

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

  const shouldAnimate = logos.length > 0;

  // Défilement continu, fluide, façon bandeau
  useEffect(() => {
    if (!shouldAnimate) return;
    const track = trackRef.current;
    if (!track) return;

    let frameId: number;
    let offset = 0;
    const speed = 0.4; // pixels par frame (~24px/s à 60fps)

    const loop = () => {
      const firstGroup = track.firstElementChild as HTMLDivElement | null;
      if (!firstGroup) return;

      offset -= speed;
      if (Math.abs(offset) >= firstGroup.offsetWidth) {
        offset = 0;
      }

      track.style.transform = `translate3d(${offset}px, 0, 0)`;
      frameId = window.requestAnimationFrame(loop);
    };

    frameId = window.requestAnimationFrame(loop);

    return () => {
      window.cancelAnimationFrame(frameId);
      track.style.transform = 'translate3d(0, 0, 0)';
    };
  }, [shouldAnimate, logos.length]);

  const content = (
    <div
      className={`rounded-3xl border border-slate-200 bg-white/80 px-6 py-6 shadow-sm ${
        embedded ? 'w-full' : 'mx-auto max-w-5xl'
      }`}
    >
      <p className="text-xs uppercase tracking-wide text-slate-500">Organisateurs partenaires</p>
      {loading && logos.length === 0 ? (
        <p className="mt-4 text-sm text-slate-500">Chargement des logos…</p>
      ) : (
        <div className="mt-6 overflow-hidden">
          <div ref={trackRef} className="flex w-max items-center will-change-transform">
            {[0, 1].map((copyIndex) => (
              <div key={copyIndex} className="flex shrink-0 items-center gap-8 pr-8">
                {logos.map((org) => (
                  <div
                    key={`${org.id}-${copyIndex}`}
                    className="flex h-[108px] w-[150px] items-center justify-center"
                    aria-hidden={copyIndex === 1 ? true : undefined}
                  >
                    <img
                      src={org.logoUrl}
                      alt={copyIndex === 1 ? '' : org.name}
                      className="max-h-[88px] w-auto object-contain opacity-95"
                      loading="lazy"
                      decoding="async"
                    />
                  </div>
                ))}
              </div>
            ))}
          </div>
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
