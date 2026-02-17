'use client';

import Image from 'next/image';
import { useState } from 'react';
import { BookOpen } from 'lucide-react';

const LOGO_URL = 'https://www.choisirsacolo.fr/logo.png';

export function ChoisirSaColoLogo() {
  const [failed, setFailed] = useState(false);

  if (failed) {
    return (
      <div className="flex h-32 w-32 items-center justify-center rounded-2xl border border-slate-200 bg-slate-100 sm:h-40 sm:w-40">
        <BookOpen className="h-16 w-16 text-slate-400" />
      </div>
    );
  }

  return (
    <div className="relative h-48 w-48 sm:h-56 sm:w-56">
      <Image
        src={LOGO_URL}
        alt="Choisir sa Colo - ResoColo (mascotte Ptitreso)"
        fill
        className="object-contain"
        unoptimized
        onError={() => setFailed(true)}
      />
    </div>
  );
}
