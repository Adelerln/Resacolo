import Link from 'next/link';
import { requireRole } from '@/lib/auth/require';

export default function OrganizerLayout({ children }: { children: React.ReactNode }) {
  requireRole('ORGANISATEUR');

  return (
    <div className="min-h-screen bg-slate-50">
      <header className="border-b border-slate-200 bg-white">
        <div className="mx-auto flex max-w-6xl items-center justify-between px-6 py-4">
          <Link href="/organizer" className="text-lg font-semibold text-slate-900">
            Espace Organisateur
          </Link>
          <nav className="flex items-center gap-6 text-sm text-slate-600">
            <Link href="/organizer/stays">Sejours</Link>
            <Link href="/organizer/requests">Demandes</Link>
            <form action="/api/auth/logout" method="post">
              <button className="text-sm font-semibold text-slate-600">Deconnexion</button>
            </form>
          </nav>
        </div>
      </header>
      <main className="mx-auto max-w-6xl px-6 py-10">{children}</main>
    </div>
  );
}
