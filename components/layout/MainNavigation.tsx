'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useState } from 'react';
import { Menu, X } from 'lucide-react';
import clsx from 'clsx';

const links = [
  { href: '/', label: 'Accueil' },
  { href: '/association', label: 'L’association' },
  { href: '/organisateurs', label: 'Organisateurs' },
  { href: '/ressources', label: 'Ressources' },
  { href: '/sejours', label: 'Séjours' },
  { href: '/contact', label: 'Contact' }
];

export function MainNavigation() {
  const pathname = usePathname();
  const [open, setOpen] = useState(false);

  const toggle = () => setOpen((current) => !current);
  const close = () => setOpen(false);

  return (
    <header className="border-b border-slate-200 bg-white/80 backdrop-blur">
      <div className="mx-auto flex max-w-6xl items-center justify-between px-6 py-4">
        <Link href="/" className="text-xl font-semibold text-brand-700">
          Resacolo
        </Link>
        <nav className="hidden gap-6 text-sm font-medium text-slate-700 md:flex">
          {links.map((link) => (
            <Link
              key={link.href}
              href={link.href}
              className={clsx(
                'transition hover:text-brand-600',
                pathname === link.href && 'text-brand-600'
              )}
            >
              {link.label}
            </Link>
          ))}
        </nav>
        <button
          className="rounded-md border border-slate-200 p-2 text-slate-600 md:hidden"
          onClick={toggle}
          aria-label="Ouvrir le menu"
        >
          {open ? <X className="h-5 w-5" /> : <Menu className="h-5 w-5" />}
        </button>
      </div>
      {open && (
        <nav className="border-t border-slate-200 bg-white px-6 py-4 md:hidden">
          <ul className="flex flex-col gap-4 text-sm font-medium text-slate-700">
            {links.map((link) => (
              <li key={link.href}>
                <Link
                  href={link.href}
                  onClick={close}
                  className={clsx(
                    'block transition hover:text-brand-600',
                    pathname === link.href && 'text-brand-600'
                  )}
                >
                  {link.label}
                </Link>
              </li>
            ))}
          </ul>
        </nav>
      )}
    </header>
  );
}
