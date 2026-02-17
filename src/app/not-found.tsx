import Link from 'next/link';
import { Home, MapPin } from 'lucide-react';
import { NotFoundIllustration } from '@/components/404/NotFoundIllustration';

const BLUE = '#3B82F6';
const ORANGE = '#F97316';

export default function NotFound() {
  return (
    <div className="flex min-h-[70vh] flex-col items-center justify-center bg-[#FFFFFF] px-4 py-12 sm:py-16">
      <div className="mx-auto flex w-full max-w-lg flex-col items-center text-center">
        {/* 1. Hero Illustration */}
        <div className="mb-8 w-full max-w-xs flex-shrink-0 sm:mb-10">
          <NotFoundIllustration />
        </div>

        {/* 2. Main Message */}
        <p
          className="font-display text-6xl font-extrabold tracking-tight sm:text-7xl md:text-8xl"
          style={{ color: BLUE }}
          aria-hidden
        >
          404
        </p>
        <h1 className="mt-4 font-display text-xl font-bold text-slate-800 sm:text-2xl">
          Oups ! Cette destination semble introuvable.
        </h1>
        <p className="mt-3 max-w-md text-slate-500 leading-relaxed sm:text-base">
          Il semblerait que vous ayez pris un petit chemin de traverse. Pas de panique, le camp de base
          n&apos;est jamais très loin !
        </p>

        {/* 3. Recovery Actions */}
        <div className="mt-10 flex flex-col items-center gap-4">
          <Link
            href="/"
            className="inline-flex w-full items-center justify-center gap-2 rounded-xl px-8 py-4 font-semibold text-white shadow-md transition hover:opacity-95 sm:w-auto"
            style={{ backgroundColor: ORANGE }}
          >
            <Home className="h-5 w-5" />
            Retourner à l&apos;accueil
          </Link>
          <Link
            href="/sejours"
            className="inline-flex items-center gap-2 text-sm font-medium transition hover:underline"
            style={{ color: BLUE }}
          >
            <MapPin className="h-4 w-4" />
            Voir tous nos séjours
          </Link>
        </div>
      </div>
    </div>
  );
}
