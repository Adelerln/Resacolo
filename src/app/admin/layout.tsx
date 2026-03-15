import Image from 'next/image';
import Link from 'next/link';
import { requireRole } from '@/lib/auth/require';

export default function AdminLayout({ children }: { children: React.ReactNode }) {
  requireRole('ADMIN');

  return (
    <div className="min-h-screen bg-slate-50">
      <div className="flex min-h-screen">
        <aside className="w-64 border-r border-slate-200 bg-white">
          <div className="px-6 py-6">
            <Link href="/admin" className="text-lg font-semibold text-slate-900">
              Admin Resacolo
            </Link>
            <p className="mt-1 text-xs text-slate-500">Pilotage plateforme</p>
          </div>
          <nav className="px-3 text-sm text-slate-600">
            <Link
              href="/admin/sejours"
              className="mb-1 block rounded-lg px-3 py-2 transition hover:bg-slate-100"
            >
              Séjours
            </Link>
            <Link
              href="/admin/dashboard"
              className="mb-1 block rounded-lg px-3 py-2 transition hover:bg-slate-100"
            >
              Dashboard
            </Link>
            <Link
              href="/admin/reservations"
              className="mb-1 block rounded-lg px-3 py-2 transition hover:bg-slate-100"
            >
              Réservations
            </Link>
            <Link
              href="/admin/utilisateurs"
              className="mb-1 block rounded-lg px-3 py-2 transition hover:bg-slate-100"
            >
              Utilisateurs
            </Link>
            <Link
              href="/admin/organizers"
              className="mb-1 block rounded-lg px-3 py-2 transition hover:bg-slate-100"
            >
              Organisateurs
            </Link>
          </nav>
          <div className="mt-auto px-6 pb-6 pt-4">
            <form action="/api/auth/logout" method="post">
              <button className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm font-semibold text-slate-600 hover:border-slate-300">
                Déconnexion
              </button>
            </form>
            <div className="mt-4 flex items-center justify-start">
              <Image
                src="/image/logo-resacolo.png"
                alt="Resacolo"
                width={120}
                height={32}
                className="h-8 w-auto opacity-70"
              />
            </div>
          </div>
        </aside>
        <main className="flex-1 px-6 py-10">{children}</main>
      </div>
    </div>
  );
}
