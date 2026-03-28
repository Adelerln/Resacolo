'use client';

import Image from 'next/image';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useEffect, useRef, useState } from 'react';
import { ChevronDown, Menu, X } from 'lucide-react';
import clsx from 'clsx';
import { useCart } from '@/context/CartContext';
import { AnimatePresence, motion } from 'framer-motion';

const links = [
  { href: '/sejours', label: 'Séjours' },
  { href: '/bien-choisir-sa-colo', label: 'Bien choisir sa colo' },
  {
    label: 'À propos',
    children: [
      { href: '/notre-concept', label: 'Notre Concept' },
      { href: '/organisateurs', label: 'Organisateurs' },
      { href: '/devenir-organisateur', label: 'Devenir Organisateur' },
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

const headerLinkClass = 'text-[17px] font-bold tracking-[1px] !text-[#37b5f4] transition-opacity hover:opacity-80';
const headerDropdownItemClass =
  'block whitespace-nowrap px-4 py-2 text-[15px] font-bold tracking-[1px] !text-[#37b5f4] hover:bg-slate-50 hover:opacity-80';
const headerIconButtonClass =
  'flex h-7 w-7 items-center justify-center bg-transparent transition hover:opacity-80';

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

  const toggle = () => setOpen((current) => !current);
  const close = () => setOpen(false);

  return (
    <header className="relative z-[100] overflow-visible border-b border-slate-200 bg-white/80 backdrop-blur">
      <div className="section-container flex items-center justify-between overflow-visible py-4">
        <Link href="/" className="flex items-center gap-3 text-2xl font-semibold tracking-tight text-slate-900">
          <Image
            src="/image/accueil/images_accueil/logo-resacolo.png"
            alt="Resacolo"
            width={140}
            height={40}
            className="h-10 w-auto"
            priority
          />
        </Link>
        <nav className="hidden items-center gap-8 overflow-visible font-medium md:flex">
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
                    className={clsx(
                      'flex items-center gap-1',
                      headerLinkClass,
                      isActive && 'opacity-100'
                    )}
                  >
                    {link.label}
                    <ChevronDown
                      className={clsx('h-4 w-4 transition', dropdownOpen && 'rotate-180')}
                    />
                  </button>
                  <AnimatePresence>
                    {dropdownOpen && (
                      <motion.div
                        initial={{ opacity: 0, y: 8, scale: 0.98 }}
                        animate={{ opacity: 1, y: 0, scale: 1 }}
                        exit={{ opacity: 0, y: 6, scale: 0.98 }}
                        transition={{ duration: 0.2, ease: [0.22, 1, 0.36, 1] }}
                        className="absolute left-0 top-full z-50 min-w-[260px] pt-1"
                      >
                        <div className="rounded-xl border border-slate-200 bg-white py-2 shadow-lg">
                          {link.children.map((child) => (
                            <Link
                              key={child.href}
                              href={child.href}
                              className={clsx(
                                headerDropdownItemClass,
                                pathname === child.href && 'bg-brand-50'
                              )}
                            >
                              {child.label}
                            </Link>
                          ))}
                        </div>
                      </motion.div>
                    )}
                  </AnimatePresence>
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
                  className={clsx(headerLinkClass, isActive && 'opacity-100')}
                >
                  {link.label}
                </Link>
              );
            }
            return null;
          })}
        </nav>
        <div className="hidden items-center gap-5 md:flex">
          <Link
            href="/mon-compte"
            className={headerIconButtonClass}
            aria-label="Mon compte"
          >
            <Image
              src="/image/header/pictos_header/icon-mon-compte.png"
              alt=""
              width={16}
              height={16}
              className="h-4 w-4 object-contain"
            />
          </Link>
          <button className={headerIconButtonClass} aria-label="Favoris" type="button">
            <Image
              src="/image/header/pictos_header/icon-favoris.png"
              alt=""
              width={16}
              height={16}
              className="h-4 w-4 object-contain"
            />
          </button>
          <Link
            href="/panier"
            className={clsx(headerIconButtonClass, 'relative')}
            aria-label="Panier"
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
          <div
            className="relative"
            onMouseEnter={openBackOffice}
            onMouseLeave={closeBackOffice}
          >
            <button
              type="button"
              aria-expanded={backOfficeOpen}
              aria-haspopup="menu"
              className="btn btn-sm btn-accent-outline text-[17px] font-bold tracking-[1px] !text-[#37b5f4]"
            >
              Back Office
              <ChevronDown className={clsx('h-4 w-4 transition', backOfficeOpen && 'rotate-180')} />
            </button>
            <AnimatePresence>
              {backOfficeOpen && (
                <motion.div
                  initial={{ opacity: 0, y: 8, scale: 0.98 }}
                  animate={{ opacity: 1, y: 0, scale: 1 }}
                  exit={{ opacity: 0, y: 6, scale: 0.98 }}
                  transition={{ duration: 0.2, ease: [0.22, 1, 0.36, 1] }}
                  className="absolute right-0 top-full z-50 min-w-[200px] pt-2"
                >
                  <div className="rounded-xl border border-slate-200 bg-white py-2 shadow-lg">
                    {backOfficeLinks.map((item) => (
                      <Link
                        key={item.href}
                        href={item.href}
                        className={clsx(
                          'block px-4 py-2 text-slate-700 hover:bg-slate-50 hover:text-brand-500',
                          pathname === item.href && 'bg-brand-50 text-brand-600'
                        )}
                      >
                        {item.label}
                      </Link>
                    ))}
                  </div>
                </motion.div>
              )}
            </AnimatePresence>
          </div>
        </div>
        <button
          className="rounded-md border border-slate-200 p-2 text-slate-600 md:hidden"
          onClick={toggle}
          aria-label="Ouvrir le menu"
        >
          {open ? <X className="h-5 w-5" /> : <Menu className="h-5 w-5" />}
        </button>
      </div>
      <AnimatePresence>
        {open && (
          <motion.nav
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: 'auto' }}
            exit={{ opacity: 0, height: 0 }}
            transition={{ duration: 0.25, ease: [0.22, 1, 0.36, 1] }}
            className="overflow-hidden border-t border-slate-200 bg-white px-6 py-4 md:hidden"
          >
            <ul className="flex flex-col gap-4 font-medium text-slate-700">
              {links.map((link) => {
                if (isDropdownItem(link)) {
                  return (
                    <li key={link.label}>
                      <span className="block text-[17px] font-bold tracking-[1px] !text-[#37b5f4]">{link.label}</span>
                      <ul className="mt-2 flex flex-col gap-2 pl-3">
                        {link.children.map((child) => (
                          <li key={child.href}>
                            <Link
                              href={child.href}
                              onClick={close}
                              className={clsx(
                                headerLinkClass,
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
                        className={clsx(headerLinkClass, isActive && 'opacity-100')}
                      >
                        {link.label}
                      </Link>
                    </li>
                  );
                }
                return null;
              })}
              <li>
                <span className="block text-[17px] font-bold tracking-[1px] !text-[#37b5f4]">Back Office</span>
                <ul className="mt-2 flex flex-col gap-2 pl-3">
                  {backOfficeLinks.map((item) => (
                    <li key={item.href}>
                      <Link
                        href={item.href}
                        onClick={close}
                        className={clsx(
                          headerLinkClass,
                          pathname === item.href && 'opacity-100'
                        )}
                      >
                        {item.label}
                      </Link>
                    </li>
                  ))}
                </ul>
              </li>
            </ul>
          </motion.nav>
        )}
      </AnimatePresence>
    </header>
  );
}
