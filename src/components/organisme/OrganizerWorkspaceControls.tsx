'use client';

import Link from 'next/link';
import { useEffect, useState } from 'react';
import { usePathname, useRouter, useSearchParams } from 'next/navigation';
import {
  ORGANIZER_COOKIE_NAME,
  type OrganizerOption
} from '@/lib/organizers';
import {
  ORGANIZER_ACCESS_COOKIE_NAME,
  ORGANIZER_ACCESS_LABELS,
  getOrganizerNavLinks,
  type OrganizerAccessRole
} from '@/lib/organizer-access';

type Props = {
  organizers: OrganizerOption[];
  initialSelectedOrganizerId?: string | null;
  initialAccessRole: OrganizerAccessRole;
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
  initialAccessRole
}: Props) {
  const { pathname, selectedOrganizerId } = useOrganizerSelection(
    organizers,
    initialSelectedOrganizerId
  );
  const links = getOrganizerNavLinks(initialAccessRole);

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
  initialAccessRole
}: Props) {
  const { pathname, router, searchParams, organizerIdFromUrl, selectedOrganizerId } =
    useOrganizerSelection(organizers, initialSelectedOrganizerId);
  const [selectedAccessRole, setSelectedAccessRole] =
    useState<OrganizerAccessRole>(initialAccessRole);

  useEffect(() => {
    setSelectedAccessRole(initialAccessRole);
  }, [initialAccessRole]);

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
      <div className="grid gap-4 lg:grid-cols-[minmax(0,1fr)_260px]">
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
        <label className="block text-sm font-medium text-slate-700">
          Jeu d&apos;accès
          <select
            className="mt-2 w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm text-slate-900"
            value={selectedAccessRole}
            onChange={(event) => {
              const nextAccessRole = event.target.value as OrganizerAccessRole;
              setSelectedAccessRole(nextAccessRole);
              document.cookie = `${ORGANIZER_ACCESS_COOKIE_NAME}=${encodeURIComponent(nextAccessRole)}; path=/; max-age=${60 * 60 * 24 * 365}; samesite=lax`;
              router.refresh();
            }}
          >
            {Object.entries(ORGANIZER_ACCESS_LABELS).map(([value, label]) => (
              <option key={value} value={value}>
                {label}
              </option>
            ))}
          </select>
        </label>
      </div>
    </div>
  );
}
