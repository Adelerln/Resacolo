import Image from 'next/image';
import Link from 'next/link';
import { requireRole } from '@/lib/auth/require';

export default function PartnerLayout({ children }: { children: React.ReactNode }) {
  requireRole('PARTENAIRE');

  return (
    <div className="min-h-screen bg-slate-50">
      <header className="border-b border-slate-200 bg-white">
        <div className="mx-auto flex max-w-6xl items-center justify-between px-6 py-4">
          <Link href="/partenaire" className="flex items-center gap-3 text-lg font-semibold text-slate-900">
            <Image
              src="/image/logo-resacolo.png"
              alt="Resacolo"
              width={120}
              height={32}
              className="h-8 w-auto"
            />
            <span>Espace Partenaire</span>
          </Link>
          <nav className="flex items-center gap-6 text-sm text-slate-600">
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
      </header>
      <main className="mx-auto max-w-6xl px-6 py-10">{children}</main>
    </div>
  );
}
