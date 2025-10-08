'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useState } from 'react';
import { Heart, Menu, ShoppingCart, UserRound, X } from 'lucide-react';
import clsx from 'clsx';

const links = [
  { href: '/sejours', label: 'Séjours' },
  { href: '#guide', label: 'Bien choisir sa colo' },
  { href: '/association', label: 'À propos' },
  { href: '#faq', label: 'FAQ' },
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
        <Link href="/" className="flex items-center gap-3 text-2xl font-semibold tracking-tight text-slate-900">
          <span className="font-display text-3xl uppercase text-brand-500">
            RESA<span className="text-slate-950">COLO</span>
          </span>
          <span className="inline-flex h-5 w-5 flex-none rounded-full bg-accent-400" />
        </Link>
        <nav className="hidden items-center gap-8 text-sm font-medium text-slate-600 md:flex">
          {links.map((link) => {
            const isAnchor = link.href.startsWith('#');
            const isActive = !isAnchor && pathname === link.href;
            return (
              <Link
                key={link.href}
                href={link.href}
                className={clsx('transition hover:text-brand-500', isActive && 'text-brand-500')}
              >
                {link.label}
              </Link>
            );
          })}
        </nav>
        <div className="hidden items-center gap-5 md:flex">
          <button className="rounded-full border border-slate-200 p-2 text-slate-500 hover:border-brand-200 hover:text-brand-500">
            <UserRound className="h-4 w-4" />
          </button>
          <button className="rounded-full border border-slate-200 p-2 text-slate-500 hover:border-brand-200 hover:text-brand-500">
            <Heart className="h-4 w-4" />
          </button>
          <button className="relative rounded-full border border-slate-200 p-2 text-slate-500 hover:border-brand-200 hover:text-brand-500">
            <ShoppingCart className="h-4 w-4" />
            <span className="absolute -right-1 -top-1 flex h-4 w-4 items-center justify-center rounded-full bg-brand-500 text-[10px] font-semibold text-white">
              0
            </span>
          </button>
          <Link
            href="/partenariat"
            className="rounded-full border border-accent-400 px-4 py-2 text-sm font-semibold text-accent-500 transition hover:bg-accent-500 hover:text-white"
          >
            Partenariat
          </Link>
        </div>
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
            {links.map((link) => {
              const isAnchor = link.href.startsWith('#');
              const isActive = !isAnchor && pathname === link.href;
              return (
                <li key={link.href}>
                  <Link
                    href={link.href}
                    onClick={close}
                    className={clsx('block transition hover:text-brand-600', isActive && 'text-brand-600')}
                  >
                    {link.label}
                  </Link>
                </li>
              );
            })}
            <li>
              <Link
                href="/partenariat"
                onClick={close}
                className="inline-flex w-full items-center justify-center rounded-full border border-accent-400 px-4 py-2 text-accent-500"
              >
                Partenariat
              </Link>
            </li>
          </ul>
        </nav>
      )}
    </header>
  );
}
