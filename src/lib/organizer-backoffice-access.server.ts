import 'server-only';

import { redirect } from 'next/navigation';
import { getCurrentUser, type SessionPayload } from '@/lib/auth/session';
import {
  canAccessOrganizerSection,
  type OrganizerAccessRole,
  type OrganizerWorkspaceSection
} from '@/lib/organizer-access';
import {
  resolveOrganizerSelection,
  type ResolveOrganizerSelectionOptions
} from '@/lib/organizers.server';
import type { OrganizerOption } from '@/lib/organizers';
import { getHomePathForRole } from '@/lib/auth/roles';

export type OrganizerBackofficeContext = {
  session: SessionPayload;
  organizers: OrganizerOption[];
  selectedOrganizer: OrganizerOption;
  selectedOrganizerId: string;
  accessRole: OrganizerAccessRole;
  accessByOrganizerId: Record<string, OrganizerAccessRole>;
};

function normalizeRequestedOrganizerId(
  value: string | string[] | null | undefined
): string | undefined {
  if (!value) return undefined;
  return Array.isArray(value) ? value[0] : value;
}

function mapAccessByOrganizerId(
  accessByOrganizerId: Map<string, OrganizerAccessRole>
): Record<string, OrganizerAccessRole> {
  const entries = Array.from(accessByOrganizerId.entries());
  return Object.fromEntries(entries);
}

async function resolveSelectionForSession(
  session: SessionPayload,
  requestedOrganizerId?: string | string[] | null
) {
  const options: ResolveOrganizerSelectionOptions = {
    enforceBackofficeAccess: true,
    appUserId: session.userId
  };

  return resolveOrganizerSelection(
    normalizeRequestedOrganizerId(requestedOrganizerId),
    null,
    options
  );
}

function isOrganizerBackofficeRole(role: SessionPayload['role']) {
  return role === 'ORGANISATEUR' || role === 'MNEMOS';
}

function organizerLoginUrl(requestedOrganizerId?: string) {
  const base = '/organisme';
  if (!requestedOrganizerId) return '/login?redirectTo=/organisme';
  const redirectTo = `${base}?organizerId=${encodeURIComponent(requestedOrganizerId)}`;
  return `/login?redirectTo=${encodeURIComponent(redirectTo)}`;
}

export async function requireOrganizerPageAccess(options?: {
  requestedOrganizerId?: string | string[] | null;
  requiredSection?: OrganizerWorkspaceSection;
}): Promise<OrganizerBackofficeContext> {
  const requiredSection = options?.requiredSection;
  const requestedOrganizerId = normalizeRequestedOrganizerId(options?.requestedOrganizerId);
  const session = await getCurrentUser();
  if (!session) {
    redirect(organizerLoginUrl(requestedOrganizerId));
  }
  if (!isOrganizerBackofficeRole(session.role)) {
    redirect(getHomePathForRole(session.role));
  }

  if (session.role === 'MNEMOS') {
    const selection = await resolveOrganizerSelection(requestedOrganizerId, null);
    if (!selection.selectedOrganizer || !selection.selectedOrganizerId) {
      redirect('/forbidden');
    }

    const accessByOrganizerId = Object.fromEntries(
      selection.organizers.map((organizer) => [organizer.id, 'OWNER' as const])
    ) as Record<string, OrganizerAccessRole>;

    return {
      session,
      organizers: selection.organizers,
      selectedOrganizer: selection.selectedOrganizer,
      selectedOrganizerId: selection.selectedOrganizerId,
      accessRole: 'OWNER',
      accessByOrganizerId
    };
  }

  const selection = await resolveSelectionForSession(session, requestedOrganizerId);

  if (requestedOrganizerId && !selection.accessByOrganizerId.has(requestedOrganizerId)) {
    redirect('/forbidden');
  }

  if (!selection.selectedOrganizer || !selection.selectedOrganizerId || !selection.selectedAccessRole) {
    redirect('/forbidden');
  }

  if (requiredSection && !canAccessOrganizerSection(selection.selectedAccessRole, requiredSection)) {
    redirect('/forbidden');
  }

  return {
    session,
    organizers: selection.organizers,
    selectedOrganizer: selection.selectedOrganizer,
    selectedOrganizerId: selection.selectedOrganizerId,
    accessRole: selection.selectedAccessRole,
    accessByOrganizerId: mapAccessByOrganizerId(selection.accessByOrganizerId)
  };
}

export async function requireOrganizerApiAccess(options?: {
  requestedOrganizerId?: string | string[] | null;
  requiredSection?: OrganizerWorkspaceSection;
}): Promise<
  | { ok: true; context: OrganizerBackofficeContext }
  | { ok: false; status: number; error: string }
> {
  const requiredSection = options?.requiredSection;
  const requestedOrganizerId = normalizeRequestedOrganizerId(options?.requestedOrganizerId);
  const session = await getCurrentUser();
  if (!session) {
    return { ok: false, status: 401, error: 'Authentification requise.' };
  }
  if (!isOrganizerBackofficeRole(session.role)) {
    return { ok: false, status: 403, error: 'Acces organisme refuse.' };
  }

  if (session.role === 'MNEMOS') {
    const selection = await resolveOrganizerSelection(requestedOrganizerId, null);
    if (!selection.selectedOrganizer || !selection.selectedOrganizerId) {
      return { ok: false, status: 403, error: 'Accès organisateur non autorisé.' };
    }

    return {
      ok: true,
      context: {
        session,
        organizers: selection.organizers,
        selectedOrganizer: selection.selectedOrganizer,
        selectedOrganizerId: selection.selectedOrganizerId,
        accessRole: 'OWNER',
        accessByOrganizerId: Object.fromEntries(
          selection.organizers.map((organizer) => [organizer.id, 'OWNER' as const])
        )
      }
    };
  }

  const selection = await resolveSelectionForSession(session, requestedOrganizerId);

  if (requestedOrganizerId && !selection.accessByOrganizerId.has(requestedOrganizerId)) {
    return { ok: false, status: 403, error: 'Accès organisateur non autorisé.' };
  }

  if (!selection.selectedOrganizer || !selection.selectedOrganizerId || !selection.selectedAccessRole) {
    return { ok: false, status: 403, error: 'Accès organisateur non autorisé.' };
  }

  if (requiredSection && !canAccessOrganizerSection(selection.selectedAccessRole, requiredSection)) {
    return { ok: false, status: 403, error: 'Accès organisateur non autorisé.' };
  }

  return {
    ok: true,
    context: {
      session,
      organizers: selection.organizers,
      selectedOrganizer: selection.selectedOrganizer,
      selectedOrganizerId: selection.selectedOrganizerId,
      accessRole: selection.selectedAccessRole,
      accessByOrganizerId: mapAccessByOrganizerId(selection.accessByOrganizerId)
    }
  };
}
