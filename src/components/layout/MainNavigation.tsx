'use client';

import Image from 'next/image';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useEffect, useRef, useState } from 'react';
import { ChevronDown, Menu, X } from 'lucide-react';
import clsx from 'clsx';
import { useFavorites } from '@/components/favorites/FavoritesProvider';
import { useCart } from '@/context/CartContext';

const links = [
  { href: '/sejours', label: 'Séjours' },
  { href: '/bien-choisir-sa-colo', label: 'Bien choisir sa colo' },
  {
    label: 'À propos',
    children: [
      { href: '/notre-concept', label: 'Notre Concept' },
      { href: '/organisateurs', label: 'Organisateurs' },
      { href: '/rejoindre-resacolo', label: 'Rejoindre Resacolo' },
      { href: '/devenir-partenaire', label: 'Devenir Partenaire' }
    ]
  },
  { href: '/faq', label: 'FAQ' },
  { href: '/contact', label: 'Contact' }
];

const backOfficeLinks = [
  { href: '/admin', label: 'Admin' },
  { href: '/organisme', label: 'Organisateur' },
  { href: '/partenaire', label: 'Collectivité' }
];

const headerLinkClass =
  'whitespace-nowrap text-[15px] font-bold tracking-[0.03em] !text-[color:var(--color-primary)] transition-opacity hover:opacity-80 xl:text-base';
const headerDropdownItemClass =
  'block px-4 py-2 text-[15px] font-bold tracking-[0.03em] !text-[color:var(--color-primary)] hover:bg-slate-50 hover:opacity-80';
const headerIconButtonClass =
  'flex h-9 w-9 items-center justify-center rounded-full bg-transparent transition hover:bg-slate-50 hover:opacity-80';
const mobileHeaderLinkClass =
  'block text-base font-semibold leading-snug !text-[color:var(--color-primary)]';

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
  const { count: cartCount } = useCart();
  const { favoriteIdsArray } = useFavorites();
  const [open, setOpen] = useState(false);
  const [dropdownOpen, setDropdownOpen] = useState(false);
  const [backOfficeOpen, setBackOfficeOpen] = useState(false);
  const dropdownCloseTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const backOfficeCloseTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const openDropdown = () => {
    if (dropdownCloseTimeoutRef.current) {
      clearTimeout(dropdownCloseTimeoutRef.current);
      dropdownCloseTimeoutRef.current = null;
    }
    setDropdownOpen(true);
  };

  const closeDropdown = () => {
    if (dropdownCloseTimeoutRef.current) {
      clearTimeout(dropdownCloseTimeoutRef.current);
    }
    dropdownCloseTimeoutRef.current = setTimeout(() => {
      setDropdownOpen(false);
      dropdownCloseTimeoutRef.current = null;
    }, 180);
  };

  const openBackOffice = () => {
    if (backOfficeCloseTimeoutRef.current) {
      clearTimeout(backOfficeCloseTimeoutRef.current);
      backOfficeCloseTimeoutRef.current = null;
    }
    setBackOfficeOpen(true);
  };

  const closeBackOffice = () => {
    if (backOfficeCloseTimeoutRef.current) {
      clearTimeout(backOfficeCloseTimeoutRef.current);
    }
    backOfficeCloseTimeoutRef.current = setTimeout(() => {
      setBackOfficeOpen(false);
      backOfficeCloseTimeoutRef.current = null;
    }, 180);
  };

  useEffect(() => {
    return () => {
      if (dropdownCloseTimeoutRef.current) {
        clearTimeout(dropdownCloseTimeoutRef.current);
      }
      if (backOfficeCloseTimeoutRef.current) {
        clearTimeout(backOfficeCloseTimeoutRef.current);
      }
    };
  }, []);

  useEffect(() => {
    setOpen(false);
    setDropdownOpen(false);
    setBackOfficeOpen(false);
  }, [pathname]);

  useEffect(() => {
    if (!open) {
      document.body.style.overflow = '';
      return;
    }
    document.body.style.overflow = 'hidden';
    return () => {
      document.body.style.overflow = '';
    };
  }, [open]);

  const toggle = () => setOpen((current) => !current);
  const close = () => setOpen(false);

  return (
    <header className="font-accent sticky top-0 z-[100] overflow-visible border-b border-slate-200 bg-white/90 shadow-sm backdrop-blur supports-[backdrop-filter]:bg-white/80">
      <div className="mx-auto flex w-full max-w-6xl items-center justify-between gap-3 px-4 py-3 sm:px-6 sm:py-4 lg:px-8 xl:grid xl:grid-cols-[auto_minmax(0,1fr)_auto] xl:gap-4">
        <Link href="/" className="flex shrink-0 items-center" title="Retour à l’accueil">
          <Image
            src="/image/accueil/images_accueil/logo-resacolo.png"
            alt="Resacolo"
            width={140}
            height={40}
            className="h-9 w-auto sm:h-10"
            style={{ width: 'auto' }}
            priority
          />
        </Link>

        <div className="hidden min-w-0 items-center justify-center xl:flex">
          <nav className="flex min-w-0 items-center gap-6 overflow-visible font-medium xl:gap-7 2xl:gap-8">
            {links.map((link) => {
              if (isDropdownItem(link)) {
                const isActive = link.children.some((c) => pathname === c.href);
                return (
                  <div
                    key={link.label}
                    className="relative"
                    onMouseEnter={openDropdown}
                    onMouseLeave={closeDropdown}
                  >
                    <button
                      type="button"
                      aria-expanded={dropdownOpen}
                      aria-haspopup="menu"
                      title={link.label}
                      className={clsx(
                        'flex items-center gap-1.5 overflow-visible',
                        headerLinkClass,
                        isActive && 'opacity-100'
                      )}
                    >
                      {link.label}
                      <ChevronDown
                        aria-hidden
                        strokeWidth={2.5}
                        className={clsx(
                          'h-4 w-4 shrink-0 text-[color:var(--color-primary)] transition',
                          dropdownOpen && 'rotate-180'
                        )}
                      />
                    </button>
                    {dropdownOpen ? (
                      <div className="absolute left-0 top-full z-50 min-w-[260px] pt-1">
                        <div className="rounded-xl border border-slate-200 bg-white py-2 shadow-lg">
                          {link.children.map((child) => (
                            <Link
                              key={child.href}
                              href={child.href}
                              title={child.label}
                              className={clsx(
                                headerDropdownItemClass,
                                pathname === child.href && 'bg-brand-50'
                              )}
                            >
                              {child.label}
                            </Link>
                          ))}
                        </div>
                      </div>
                    ) : null}
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
                    title={link.label}
                    className={clsx(headerLinkClass, isActive && 'opacity-100')}
                  >
                    {link.label}
                  </Link>
                );
              }
              return null;
            })}
            <div
              className="relative"
              onMouseEnter={openBackOffice}
              onMouseLeave={closeBackOffice}
            >
              <button
                type="button"
                aria-expanded={backOfficeOpen}
                aria-haspopup="menu"
                title="Back Office"
                className="btn btn-sm btn-accent-outline whitespace-nowrap text-[15px] font-bold tracking-[0.03em] !text-[color:var(--color-primary)] xl:text-base"
              >
                Back Office
                <ChevronDown className={clsx('h-4 w-4 transition', backOfficeOpen && 'rotate-180')} />
              </button>
              {backOfficeOpen ? (
                <div className="absolute left-0 top-full z-50 min-w-[200px] pt-2">
                  <div className="rounded-xl border border-slate-200 bg-white py-2 shadow-lg">
                    {backOfficeLinks.map((item) => (
                      <Link
                        key={item.href}
                        href={item.href}
                        title={item.label}
                        className={clsx(
                          'block px-4 py-2 text-slate-700 hover:bg-slate-50 hover:text-brand-500',
                          pathname === item.href && 'bg-brand-50 text-brand-600'
                        )}
                      >
                        {item.label}
                      </Link>
                    ))}
                  </div>
                </div>
              ) : null}
            </div>
          </nav>
        </div>

        <div className="flex shrink-0 items-center gap-2 sm:gap-3 xl:justify-self-end">
          <div className="hidden items-center gap-3 xl:flex 2xl:gap-4">
            <Link
              href="/mon-compte"
              className={headerIconButtonClass}
              aria-label="Mon compte"
              title="Mon compte"
            >
              <Image
                src="/image/header/pictos_header/icon-mon-compte.png"
                alt=""
                width={16}
                height={16}
                className="h-4 w-4 object-contain"
              />
            </Link>
            <Link
              href="/account/favorites"
              className={clsx(headerIconButtonClass, 'relative')}
              aria-label="Favoris"
              title="Favoris"
            >
              <Image
                src="/image/header/pictos_header/icon-favoris.png"
                alt=""
                width={16}
                height={16}
                className="h-4 w-4 object-contain"
              />
              {favoriteIdsArray.length > 0 && (
                <span className="absolute -right-1 -top-1 flex h-4 min-w-4 items-center justify-center rounded-full bg-accent-500 px-1 text-[10px] font-semibold text-white">
                  {favoriteIdsArray.length > 99 ? '99+' : favoriteIdsArray.length}
                </span>
              )}
            </Link>
            <Link
              href="/panier"
              className={clsx(headerIconButtonClass, 'relative')}
              aria-label="Panier"
              title="Panier"
            >
              <Image
                src="/image/header/pictos_header/icon-panier.png"
                alt=""
                width={16}
                height={16}
                className="h-4 w-4 object-contain"
              />
              {cartCount > 0 && (
                <span className="absolute -right-1 -top-1 flex h-4 w-4 items-center justify-center rounded-full bg-accent-500 text-[10px] font-semibold text-white">
                  {cartCount > 99 ? '99+' : cartCount}
                </span>
              )}
            </Link>
          </div>
          <button
            type="button"
            className="rounded-lg border border-slate-200 p-2.5 text-slate-600 xl:hidden"
            onClick={toggle}
            aria-label={open ? 'Fermer le menu' : 'Ouvrir le menu'}
            title={open ? 'Fermer le menu' : 'Ouvrir le menu'}
          >
            {open ? <X className="h-5 w-5" /> : <Menu className="h-5 w-5" />}
          </button>
        </div>
      </div>
      {open ? (
        <nav className="overflow-hidden border-t border-slate-200 bg-white px-4 py-4 sm:px-6 xl:hidden">
            <ul className="flex flex-col gap-4 font-medium text-slate-700">
              {links.map((link) => {
                if (isDropdownItem(link)) {
                  return (
                    <li key={link.label}>
                      <span className={`${mobileHeaderLinkClass} inline-flex items-center gap-1.5`}>
                        {link.label}
                        <ChevronDown
                          aria-hidden
                          strokeWidth={2.5}
                          className="h-4 w-4 shrink-0 text-[color:var(--color-primary)]"
                        />
                      </span>
                      <ul className="mt-2 flex flex-col gap-2 pl-3">
                        {link.children.map((child) => (
                          <li key={child.href}>
                            <Link
                              href={child.href}
                              onClick={close}
                              title={child.label}
                              className={clsx(
                                mobileHeaderLinkClass,
                                pathname === child.href && 'opacity-100'
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
                        title={link.label}
                        className={clsx(mobileHeaderLinkClass, isActive && 'opacity-100')}
                      >
                        {link.label}
                      </Link>
                    </li>
                  );
                }
                return null;
              })}
              <li>
                <span className={mobileHeaderLinkClass}>Back Office</span>
                <ul className="mt-2 flex flex-col gap-2 pl-3">
                  {backOfficeLinks.map((item) => (
                    <li key={item.href}>
                      <Link
                        href={item.href}
                        onClick={close}
                        title={item.label}
                        className={clsx(
                          mobileHeaderLinkClass,
                          pathname === item.href && 'opacity-100'
                        )}
                      >
                        {item.label}
                      </Link>
                    </li>
                  ))}
                </ul>
              </li>
              <li className="mt-2 border-t border-slate-100 pt-4">
                <div className="flex items-center gap-2">
                  <Link
                    href="/mon-compte"
                    onClick={close}
                    title="Mon compte"
                    className="inline-flex min-h-[44px] flex-1 items-center justify-center rounded-xl border border-slate-200 px-3 py-2 text-sm font-semibold text-slate-700"
                  >
                    Mon compte
                  </Link>
                  <Link
                    href="/account/favorites"
                    onClick={close}
                    title="Favoris"
                    className="inline-flex min-h-[44px] flex-1 items-center justify-center rounded-xl border border-slate-200 px-3 py-2 text-sm font-semibold text-slate-700"
                  >
                    Favoris {favoriteIdsArray.length > 0 ? `(${favoriteIdsArray.length > 99 ? '99+' : favoriteIdsArray.length})` : ''}
                  </Link>
                  <Link
                    href="/panier"
                    onClick={close}
                    title="Panier"
                    className="inline-flex min-h-[44px] flex-1 items-center justify-center rounded-xl border border-slate-200 px-3 py-2 text-sm font-semibold text-slate-700"
                  >
                    Panier {cartCount > 0 ? `(${cartCount > 99 ? '99+' : cartCount})` : ''}
                  </Link>
                </div>
              </li>
            </ul>
        </nav>
      ) : null}
    </header>
  );
}
