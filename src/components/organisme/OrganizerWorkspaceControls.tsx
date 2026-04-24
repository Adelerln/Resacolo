'use client';

import Link from 'next/link';
import { useEffect } from 'react';
import { usePathname, useRouter, useSearchParams } from 'next/navigation';
import {
  ORGANIZER_COOKIE_NAME,
  type OrganizerOption
} from '@/lib/organizers';
import {
  ORGANIZER_ACCESS_LABELS,
  getOrganizerNavLinks,
  type OrganizerAccessRole
} from '@/lib/organizer-access';

type Props = {
  organizers: OrganizerOption[];
  initialSelectedOrganizerId?: string | null;
  accessRolesByOrganizerId: Record<string, OrganizerAccessRole>;
};

const ORGANIZER_STORAGE_KEY = 'resacolo:selectedOrganizerId';

function withOrganizerQuery(path: string, organizerId?: string | null) {
  if (!organizerId) return path;
  const separator = path.includes('?') ? '&' : '?';
  return `${path}${separator}organizerId=${encodeURIComponent(organizerId)}`;
}

function useOrganizerSelection(
  organizers: OrganizerOption[],
  initialSelectedOrganizerId?: string | null
) {
  const pathname = usePathname();
  const router = useRouter();
  const searchParams = useSearchParams();
  const organizerIdFromUrl = searchParams.get('organizerId');
  const selectedOrganizerId =
    organizerIdFromUrl ?? initialSelectedOrganizerId ?? organizers[0]?.id ?? '';

  return {
    pathname,
    router,
    searchParams,
    organizerIdFromUrl,
    selectedOrganizerId
  };
}

export function OrganizerWorkspaceNav({
  organizers,
  initialSelectedOrganizerId,
  accessRolesByOrganizerId
}: Props) {
  const { pathname, selectedOrganizerId } = useOrganizerSelection(
    organizers,
    initialSelectedOrganizerId
  );
  const currentAccessRole = accessRolesByOrganizerId[selectedOrganizerId] ?? 'EDITOR';
  const links = getOrganizerNavLinks(currentAccessRole);

  return (
    <nav className="px-3 text-sm text-slate-600">
      {links.map((link) => {
        const href = withOrganizerQuery(link.href, selectedOrganizerId);
        const isActive =
          link.href === '/organisme' ? pathname === link.href : pathname.startsWith(link.href);
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

export function OrganizerWorkspaceSelector({
  organizers,
  initialSelectedOrganizerId,
  accessRolesByOrganizerId
}: Props) {
  const { pathname, router, searchParams, organizerIdFromUrl, selectedOrganizerId } =
    useOrganizerSelection(organizers, initialSelectedOrganizerId);
  const selectedAccessRole = accessRolesByOrganizerId[selectedOrganizerId] ?? null;

  useEffect(() => {
    if (!selectedOrganizerId) return;
    window.localStorage.setItem(ORGANIZER_STORAGE_KEY, selectedOrganizerId);
    document.cookie = `${ORGANIZER_COOKIE_NAME}=${encodeURIComponent(selectedOrganizerId)}; path=/; max-age=${60 * 60 * 24 * 365}; samesite=lax`;
  }, [selectedOrganizerId]);

  useEffect(() => {
    if (organizerIdFromUrl) return;

    const storedOrganizerId =
      window.localStorage.getItem(ORGANIZER_STORAGE_KEY) ?? initialSelectedOrganizerId ?? null;
    if (!storedOrganizerId) return;
    if (!organizers.some((organizer) => organizer.id === storedOrganizerId)) return;

    const nextParams = new URLSearchParams(searchParams.toString());
    nextParams.set('organizerId', storedOrganizerId);
    const query = nextParams.toString();
    router.replace(query ? `${pathname}?${query}` : pathname);
  }, [initialSelectedOrganizerId, organizerIdFromUrl, organizers, pathname, router, searchParams]);

  return (
    <div className="mb-6 rounded-2xl border border-slate-200 bg-white px-4 py-4">
      <div className="grid gap-4 lg:grid-cols-[minmax(0,1fr)_280px]">
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
        <div className="rounded-lg border border-slate-200 bg-slate-50 px-3 py-2.5">
          <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">Niveau d&apos;accès</p>
          <p className="mt-1 text-sm font-medium text-slate-800">
            {selectedAccessRole ? ORGANIZER_ACCESS_LABELS[selectedAccessRole] : 'Aucun accès'}
          </p>
        </div>
      </div>
    </div>
  );
}
