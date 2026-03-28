'use client';

import Image from 'next/image';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { LayoutDashboard, MapPin, Settings } from 'lucide-react';
import clsx from 'clsx';

const sectionGestionSejours = [
  { href: '/back-office', label: 'Tableau de bord', icon: LayoutDashboard },
  { href: '/back-office/sejours', label: 'Séjours', icon: MapPin }
];

const sectionParametres = [
  { href: '/back-office/parametres', label: 'Paramètres', icon: Settings }
];

export function BackOfficeShell({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();

  return (
    <div className="flex min-h-screen flex-col bg-slate-100">
      {/* Top bar */}
      <header className="flex items-center justify-between border-b border-slate-200 bg-white px-4 py-3 shadow-sm sm:px-6">
        <div className="flex items-center gap-4">
          <Link
            href="/"
            className="flex items-center gap-2 text-slate-700 transition hover:text-brand-500"
          >
            <Image
              src="/image/accueil/images_accueil/logo-resacolo.png"
              alt="Resacolo"
              width={120}
              height={34}
              className="h-8 w-auto"
            />
          </Link>
          <span className="hidden text-sm font-medium text-slate-400 sm:inline">/</span>
          <span className="font-display text-sm font-semibold text-slate-800 sm:text-base">
            Back Office
          </span>
        </div>
        <Link
          href="/"
          className="text-sm font-medium text-slate-600 transition hover:text-brand-500"
        >
          Retour au site
        </Link>
      </header>

      <div className="flex flex-1">
        {/* Sidebar */}
        <aside className="hidden w-56 shrink-0 border-r border-slate-200 bg-white sm:block">
          <nav className="sticky top-0 flex flex-col gap-4 p-3">
            <div>
              <span className="mb-1.5 block px-3 text-xs font-semibold uppercase tracking-wider text-slate-400">
                Gestion des séjours
              </span>
              <div className="flex flex-col gap-0.5">
                {sectionGestionSejours.map((item) => {
                  const isActive =
                    item.href === '/back-office'
                      ? pathname === '/back-office'
                      : pathname.startsWith(item.href);
                  return (
                    <Link
                      key={item.href}
                      href={item.href}
                      className={clsx(
                        'flex items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-medium transition',
                        isActive
                          ? 'bg-brand-50 text-brand-600'
                          : 'text-slate-600 hover:bg-slate-50 hover:text-slate-900'
                      )}
                    >
                      <item.icon className="h-4 w-4 shrink-0" />
                      {item.label}
                    </Link>
                  );
                })}
              </div>
            </div>
            <div>
              <span className="mb-1.5 block px-3 text-xs font-semibold uppercase tracking-wider text-slate-400">
                Compte
              </span>
              <div className="flex flex-col gap-0.5">
                {sectionParametres.map((item) => {
                  const isActive = pathname.startsWith(item.href);
                  return (
                    <Link
                      key={item.href}
                      href={item.href}
                      className={clsx(
                        'flex items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-medium transition',
                        isActive
                          ? 'bg-brand-50 text-brand-600'
                          : 'text-slate-600 hover:bg-slate-50 hover:text-slate-900'
                      )}
                    >
                      <item.icon className="h-4 w-4 shrink-0" />
                      {item.label}
                    </Link>
                  );
                })}
              </div>
            </div>
          </nav>
        </aside>

        {/* Main content */}
        <main className="min-w-0 flex-1 p-4 sm:p-6 lg:p-8">{children}</main>
      </div>
    </div>
  );
}
