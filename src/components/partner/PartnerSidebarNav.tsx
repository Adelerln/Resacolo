'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';

type PartnerNavLink = {
  href: string;
  label: string;
};

export function PartnerSidebarNav({ links }: { links: PartnerNavLink[] }) {
  const pathname = usePathname();

  return (
    <nav className="px-3 text-sm text-slate-600">
      {links.map((item) => {
        const isActive = item.href === '/partenaire' ? pathname === '/partenaire' : pathname.startsWith(item.href);

        return (
          <Link
            key={item.href}
            href={item.href}
            prefetch={false}
            className={`mb-1 block rounded-lg border-l-2 px-3 py-2 text-[15px] font-semibold transition ${
              isActive
                ? 'border-orange-300 bg-orange-100/80 text-orange-950'
                : 'border-transparent text-slate-700 hover:bg-orange-50 hover:text-slate-900'
            }`}
          >
            {item.label}
          </Link>
        );
      })}
    </nav>
  );
}
