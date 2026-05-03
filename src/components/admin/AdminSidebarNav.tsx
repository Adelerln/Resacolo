'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';

type AdminNavLink = {
  href: string;
  label: string;
};

export function AdminSidebarNav({ links }: { links: AdminNavLink[] }) {
  const pathname = usePathname();

  return (
    <nav className="px-3 text-sm text-slate-600">
      {links.map((item) => {
        const isActive = item.href === '/admin' ? pathname === '/admin' : pathname.startsWith(item.href);

        return (
          <Link
            key={item.href}
            href={item.href}
            prefetch={false}
            className={`mb-1 block rounded-lg border-l-2 px-3 py-2 text-[15px] font-semibold transition ${
              isActive
                ? 'border-[#5FB3EF] bg-[#5FB3EF]/20 text-[#0E4C73]'
                : 'border-transparent text-slate-700 hover:bg-slate-100 hover:text-slate-900'
            }`}
          >
            {item.label}
          </Link>
        );
      })}
    </nav>
  );
}
