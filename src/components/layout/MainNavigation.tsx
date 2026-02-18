'use client';

import Image from 'next/image';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useState } from 'react';
import { ChevronDown, Heart, Menu, ShoppingCart, UserRound, X } from 'lucide-react';
import clsx from 'clsx';

const links = [
  { href: '/sejours', label: 'Séjours' },
  { href: '/bien-choisir-sa-colo', label: 'Bien choisir sa colo' },
  {
    label: 'À propos',
    children: [
      { href: '/notre-concept', label: 'Notre Concept' },
      { href: '/organisateurs', label: 'Organisateurs' },
      { href: '/devenir-partenaire', label: 'Devenir Partenaire' }
    ]
  },
  { href: '/faq', label: 'FAQ' },
  { href: '/contact', label: 'Contact' }
];

function isLinkItem(
  item: (typeof links)[number]
): item is { href: string; label: string } {
  return 'href' in item;
}

function isDropdownItem(
  item: (typeof links)[number]
): item is { label: string; children: { href: string; label: string }[] } {
  return 'children' in item;
}

export function MainNavigation() {
  const pathname = usePathname();
  const [open, setOpen] = useState(false);
  const [dropdownOpen, setDropdownOpen] = useState(false);

  const toggle = () => setOpen((current) => !current);
  const close = () => setOpen(false);

  return (
    <header className="relative z-[100] overflow-visible border-b border-slate-200 bg-white/80 backdrop-blur">
      <div className="mx-auto flex max-w-6xl items-center justify-between overflow-visible px-6 py-4">
        <Link href="/" className="flex items-center gap-3 text-2xl font-semibold tracking-tight text-slate-900">
          <Image
            src="/image/logo-resacolo.png"
            alt="Resacolo"
            width={140}
            height={40}
            className="h-10 w-auto"
            priority
          />
        </Link>
        <nav className="hidden items-center gap-8 overflow-visible text-sm font-medium text-slate-600 md:flex">
          {links.map((link) => {
            if (isDropdownItem(link)) {
              const isActive = link.children.some((c) => pathname === c.href);
              return (
                <div
                  key={link.label}
                  className="relative"
                  onMouseEnter={() => setDropdownOpen(true)}
                  onMouseLeave={() => setDropdownOpen(false)}
                >
                  <button
                    type="button"
                    className={clsx(
                      'flex items-center gap-1 transition hover:text-brand-500',
                      isActive && 'text-brand-500'
                    )}
                  >
                    {link.label}
                    <ChevronDown
                      className={clsx('h-4 w-4 transition', dropdownOpen && 'rotate-180')}
                    />
                  </button>
                  {dropdownOpen && (
                    <div className="absolute left-0 top-full z-50 mt-1 min-w-[180px] rounded-xl border border-slate-200 bg-white py-2 shadow-lg">
                      {link.children.map((child) => (
                        <Link
                          key={child.href}
                          href={child.href}
                          className={clsx(
                            'block px-4 py-2 text-slate-700 hover:bg-slate-50 hover:text-brand-500',
                            pathname === child.href && 'bg-brand-50 text-brand-600'
                          )}
                        >
                          {child.label}
                        </Link>
                      ))}
                    </div>
                  )}
                </div>
              );
            }
            if (isLinkItem(link)) {
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
            }
            return null;
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
              if (isDropdownItem(link)) {
                return (
                  <li key={link.label}>
                    <span className="block font-medium text-slate-500">{link.label}</span>
                    <ul className="mt-2 flex flex-col gap-2 pl-3">
                      {link.children.map((child) => (
                        <li key={child.href}>
                          <Link
                            href={child.href}
                            onClick={close}
                            className={clsx(
                              'block transition hover:text-brand-600',
                              pathname === child.href && 'text-brand-600'
                            )}
                          >
                            {child.label}
                          </Link>
                        </li>
                      ))}
                    </ul>
                  </li>
                );
              }
              if (isLinkItem(link)) {
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
              }
              return null;
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
