'use client';

import { Waves, Camera, MountainSnow } from 'lucide-react';

const ORANGE = '#F97316';
const BLUE = '#3B82F6';

export function SlotMachineVisual() {
  return (
    <div className="flex justify-center">
      <div
        className="relative flex items-center gap-0 rounded-2xl px-6 py-8 shadow-xl sm:px-8 sm:py-10"
        style={{
          backgroundColor: ORANGE,
          boxShadow: `0 20px 40px -12px ${ORANGE}40, 0 0 0 4px rgba(255,255,255,0.1)`
        }}
      >
        {/* 3 reels */}
        <div className="flex gap-2 sm:gap-3">
          {[
            { Icon: Waves, color: BLUE },
            { Icon: Camera, color: ORANGE },
            { Icon: MountainSnow, color: ORANGE }
          ].map(({ Icon, color }, i) => (
            <div
              key={i}
              className="flex h-24 w-14 flex-shrink-0 items-center justify-center rounded-lg bg-white shadow-inner sm:h-28 sm:w-16"
            >
              <Icon className="h-8 w-8 sm:h-9 sm:w-9" style={{ color }} />
            </div>
          ))}
        </div>
        {/* Lever */}
        <div
          className="absolute -right-3 top-1/2 h-12 w-6 -translate-y-1/2 rounded-r-full sm:-right-4 sm:h-14 sm:w-7"
          style={{
            backgroundColor: '#EA580C',
            boxShadow: '2px 0 8px rgba(0,0,0,0.2)'
          }}
        />
      </div>
    </div>
  );
}
