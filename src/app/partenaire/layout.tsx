import Image from 'next/image';
import Link from 'next/link';
import { requireRole } from '@/lib/auth/require';

export default function PartnerLayout({ children }: { children: React.ReactNode }) {
  requireRole('PARTENAIRE');

  return (
    <div className="min-h-screen bg-slate-50">
      <header className="border-b border-slate-200 bg-white">
        <div className="section-container flex items-center justify-between gap-3 py-3 sm:py-4">
          <Link href="/partenaire" className="flex items-center gap-3 text-lg font-semibold text-slate-900">
            <Image
              src="/image/accueil/images_accueil/logo-resacolo.png"
              alt="Resacolo"
              width={120}
              height={32}
              className="h-8 w-auto"
            />
            <span className="hidden sm:inline">Espace Partenaire</span>
          </Link>
          <nav className="hidden items-center gap-5 text-sm text-slate-600 md:flex lg:gap-6">
            <Link href="/partenaire/beneficiaires">Bénéficiaires</Link>
            <Link href="/partenaire/catalogue">Catalogue</Link>
            <Link href="/partenaire/financement">Financement</Link>
            <Link href="/partenaire/marque-blanche">Marque blanche</Link>
            <Link href="/partenaire/reservations">Réservations</Link>
            <form action="/api/auth/logout" method="post">
              <button className="text-sm font-semibold text-slate-600">Déconnexion</button>
            </form>
          </nav>
        </div>
        <nav className="section-container flex gap-2 overflow-x-auto pb-3 md:hidden">
          <Link
            href="/partenaire/beneficiaires"
            className="inline-flex shrink-0 rounded-full border border-slate-200 px-3 py-1.5 text-xs font-semibold text-slate-700"
          >
            Bénéficiaires
          </Link>
          <Link
            href="/partenaire/catalogue"
            className="inline-flex shrink-0 rounded-full border border-slate-200 px-3 py-1.5 text-xs font-semibold text-slate-700"
          >
            Catalogue
          </Link>
          <Link
            href="/partenaire/financement"
            className="inline-flex shrink-0 rounded-full border border-slate-200 px-3 py-1.5 text-xs font-semibold text-slate-700"
          >
            Financement
          </Link>
          <Link
            href="/partenaire/marque-blanche"
            className="inline-flex shrink-0 rounded-full border border-slate-200 px-3 py-1.5 text-xs font-semibold text-slate-700"
          >
            Marque blanche
          </Link>
          <Link
            href="/partenaire/reservations"
            className="inline-flex shrink-0 rounded-full border border-slate-200 px-3 py-1.5 text-xs font-semibold text-slate-700"
          >
            Réservations
          </Link>
          <form action="/api/auth/logout" method="post" className="shrink-0">
            <button className="rounded-full border border-slate-200 px-3 py-1.5 text-xs font-semibold text-slate-700">
              Déconnexion
            </button>
          </form>
        </nav>
      </header>
      <main className="section-container py-6 sm:py-8 lg:py-10">{children}</main>
    </div>
  );
}
