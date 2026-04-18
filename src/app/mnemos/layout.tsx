import Link from 'next/link';
import { ArrowLeft } from 'lucide-react';
import { requireRole } from '@/lib/auth/require';

const mnemosNav = [
  { href: '/mnemos/organizers', label: 'Organismes' },
  { href: '/mnemos/billing', label: 'Facturation période' },
  { href: '/mnemos/inquiries', label: 'Demandes renseignements' },
  { href: '/mnemos/support', label: 'Support organismes' },
  { href: '/mnemos/chatbot', label: 'Chatbot' }
];

export default async function MnemosLayout({ children }: { children: React.ReactNode }) {
  await requireRole('ADMIN');

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100">
      <div className="border-b border-violet-900/60 bg-slate-900 px-4 py-3 lg:hidden">
        <div className="flex items-center justify-between gap-3">
          <Link
            href="/"
            className="inline-flex items-center gap-1 text-xs font-medium text-slate-400 hover:text-white"
          >
            <ArrowLeft className="h-3.5 w-3.5" />
            Site
          </Link>
          <span className="text-base font-semibold tracking-tight text-violet-200">Mnemos</span>
        </div>
        <nav className="mt-3 flex gap-2 overflow-x-auto pb-1 text-sm text-slate-300">
          {mnemosNav.map((item) => (
            <Link
              key={item.href}
              href={item.href}
              className="inline-flex shrink-0 rounded-full border border-violet-800/80 bg-slate-900 px-3 py-1.5 transition hover:border-violet-500 hover:text-white"
            >
              {item.label}
            </Link>
          ))}
        </nav>
      </div>
      <div className="flex min-h-screen">
        <aside className="hidden w-60 flex-col border-r border-violet-900/50 bg-slate-900 lg:flex">
          <div className="px-5 py-6">
            <Link
              href="/"
              className="inline-flex items-center gap-1 text-xs font-medium text-slate-400 hover:text-white"
            >
              <ArrowLeft className="h-3.5 w-3.5" />
              Retour site public
            </Link>
            <div className="mt-4">
              <p className="text-xs font-semibold uppercase tracking-widest text-violet-400">Interne</p>
              <h1 className="mt-1 text-lg font-bold text-white">Mnemos</h1>
              <p className="mt-1 text-xs text-slate-500">Back-office opérationnel</p>
            </div>
          </div>
          <nav className="flex-1 space-y-0.5 px-2 text-sm">
            {mnemosNav.map((item) => (
              <Link
                key={item.href}
                href={item.href}
                className="block rounded-lg px-3 py-2 text-slate-300 transition hover:bg-violet-950/50 hover:text-white"
              >
                {item.label}
              </Link>
            ))}
          </nav>
          <div className="mt-auto border-t border-violet-900/40 px-4 py-4">
            <form action="/api/auth/logout" method="post">
              <button
                type="submit"
                className="w-full rounded-lg border border-slate-600 px-3 py-2 text-sm font-medium text-slate-200 hover:border-slate-500"
              >
                Déconnexion
              </button>
            </form>
          </div>
        </aside>
        <main className="min-w-0 flex-1 bg-slate-950 px-4 py-6 sm:px-6 lg:px-8 lg:py-8">{children}</main>
      </div>
    </div>
  );
}
