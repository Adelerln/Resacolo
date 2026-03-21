'use client';

import Link from 'next/link';
import { usePathname, useRouter, useSearchParams } from 'next/navigation';
import type { OrganizerOption } from '@/lib/organizers';

type Props = {
  organizers: OrganizerOption[];
};

function withOrganizerQuery(path: string, organizerId?: string | null) {
  if (!organizerId) return path;
  const separator = path.includes('?') ? '&' : '?';
  return `${path}${separator}organizerId=${encodeURIComponent(organizerId)}`;
}

function useOrganizerSelection(organizers: OrganizerOption[]) {
  const pathname = usePathname();
  const router = useRouter();
  const searchParams = useSearchParams();
  const organizerIdFromUrl = searchParams.get('organizerId');
  const selectedOrganizerId =
    organizerIdFromUrl ?? organizers[0]?.id ?? '';

  return {
    pathname,
    router,
    searchParams,
    selectedOrganizerId
  };
}

export function OrganizerWorkspaceNav({ organizers }: Props) {
  const { pathname, selectedOrganizerId } = useOrganizerSelection(organizers);

  const links = [
    { href: '/organisme', label: 'Organisme' },
    { href: '/organisme/sejours', label: 'Séjours' },
    { href: '/organisme/hebergements', label: 'Hébergements' },
    { href: '/organisme/reservations', label: 'Réservations' }
  ];

  return (
    <nav className="px-3 text-sm text-slate-600">
      {links.map((link) => {
        const href = withOrganizerQuery(link.href, selectedOrganizerId);
        const isActive = pathname === link.href;
        return (
          <Link
            key={link.href}
            href={href}
            className={`mb-1 block rounded-lg px-3 py-2 transition hover:bg-slate-100 ${
              isActive ? 'bg-slate-100 text-slate-900' : ''
            }`}
          >
            {link.label}
          </Link>
        );
      })}
    </nav>
  );
}

export function OrganizerWorkspaceSelector({ organizers }: Props) {
  const { pathname, router, searchParams, selectedOrganizerId } = useOrganizerSelection(organizers);

  return (
    <div className="mb-6 rounded-2xl border border-slate-200 bg-white px-4 py-4">
      <label className="block text-sm font-medium text-slate-700">
        Organisateur affiché
        <select
          className="mt-2 w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm text-slate-900"
          value={selectedOrganizerId}
          onChange={(event) => {
            const nextOrganizerId = event.target.value;
            const nextParams = new URLSearchParams(searchParams.toString());
            if (nextOrganizerId) {
              nextParams.set('organizerId', nextOrganizerId);
            } else {
              nextParams.delete('organizerId');
            }
            const query = nextParams.toString();
            router.replace(query ? `${pathname}?${query}` : pathname);
          }}
        >
          {organizers.map((organizer) => (
            <option key={organizer.id} value={organizer.id}>
              {organizer.name}
            </option>
          ))}
        </select>
      </label>
    </div>
  );
}
