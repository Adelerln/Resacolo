'use client';

import { useRef, type ReactNode } from 'react';
import { ChevronLeft, ChevronRight } from 'lucide-react';

type HorizontalCardsCarouselProps = {
  children: ReactNode;
  scrollStep?: number;
};

export function HorizontalCardsCarousel({ children, scrollStep = 320 }: HorizontalCardsCarouselProps) {
  const viewportRef = useRef<HTMLDivElement | null>(null);

  const scrollBy = (direction: -1 | 1) => {
    viewportRef.current?.scrollBy({ left: direction * scrollStep, behavior: 'smooth' });
  };

  return (
    <div className="relative">
      <button
        type="button"
        onClick={() => scrollBy(-1)}
        aria-label="Défiler vers la gauche"
        className="absolute left-0 top-1/2 z-10 hidden h-10 w-10 -translate-x-[calc(100%+10px)] -translate-y-1/2 items-center justify-center rounded-full bg-white/95 text-slate-700 shadow-md transition hover:bg-white md:flex"
      >
        <ChevronLeft className="h-5 w-5" />
      </button>
      <button
        type="button"
        onClick={() => scrollBy(1)}
        aria-label="Défiler vers la droite"
        className="absolute right-0 top-1/2 z-10 hidden h-10 w-10 translate-x-[calc(100%+10px)] -translate-y-1/2 items-center justify-center rounded-full bg-white/95 text-slate-700 shadow-md transition hover:bg-white md:flex"
      >
        <ChevronRight className="h-5 w-5" />
      </button>
      <div ref={viewportRef} className="-mx-4 overflow-x-auto px-4 pb-3 scroll-smooth">
        {children}
      </div>
    </div>
  );
}
