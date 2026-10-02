import 'server-only';

import { redirect } from 'next/navigation';
import { getApiSession } from '@/lib/auth/api';
import { getCurrentUser, getCurrentUserAction, type SessionPayload } from '@/lib/auth/session';
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
  canManageOrganizerProfile: boolean;
  accessByOrganizerId: Record<string, OrganizerAccessRole>;
  canManageOrganizerProfileByOrganizerId: Record<string, boolean>;
};

function normalizeRequestedOrganizerId(
  value: string | string[] | null | undefined
): string | undefined {
  if (!value) return undefined;
  return Array.isArray(value) ? value[0] : value;
}

function mapAccessByOrganizerId(
  accessByOrganizerId: Map<
    string,
    import('@/lib/organizers.server').OrganizerMembershipAccess
  >
) {
  const roles: Record<string, OrganizerAccessRole> = {};
  const profileByOrganizerId: Record<string, boolean> = {};
  for (const [organizerId, access] of accessByOrganizerId.entries()) {
    roles[organizerId] = access.role;
    profileByOrganizerId[organizerId] = access.canManageOrganizerProfile;
  }
  return { roles, profileByOrganizerId };
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
  if (!requestedOrganizerId) return '/login/organisateur?redirectTo=/organisme';
  const redirectTo = `${base}?organizerId=${encodeURIComponent(requestedOrganizerId)}`;
  return `/login/organisateur?redirectTo=${encodeURIComponent(redirectTo)}`;
}

export async function requireOrganizerPageAccess(options?: {
  requestedOrganizerId?: string | string[] | null;
  requiredSection?: OrganizerWorkspaceSection;
  /** À activer depuis les Server Actions pour rafraîchir correctement la session. */
  forServerAction?: boolean;
}): Promise<OrganizerBackofficeContext> {
  const requiredSection = options?.requiredSection;
  const requestedOrganizerId = normalizeRequestedOrganizerId(options?.requestedOrganizerId);
  const session = options?.forServerAction ? await getCurrentUserAction() : await getCurrentUser();
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
      canManageOrganizerProfile: true,
      accessByOrganizerId,
      canManageOrganizerProfileByOrganizerId: Object.fromEntries(
        selection.organizers.map((organizer) => [organizer.id, true])
      )
    };
  }

  const selection = await resolveSelectionForSession(session, requestedOrganizerId);

  if (requestedOrganizerId && !selection.accessByOrganizerId.has(requestedOrganizerId)) {
    redirect('/forbidden');
  }

  if (!selection.selectedOrganizer || !selection.selectedOrganizerId || !selection.selectedAccessRole) {
    redirect('/forbidden');
  }

  if (
    requiredSection &&
    !canAccessOrganizerSection(selection.selectedAccessRole, requiredSection, {
      canManageOrganizerProfile: selection.selectedCanManageOrganizerProfile
    })
  ) {
    redirect('/forbidden');
  }

  const mappedAccess = mapAccessByOrganizerId(selection.accessByOrganizerId);

  return {
    session,
    organizers: selection.organizers,
    selectedOrganizer: selection.selectedOrganizer,
    selectedOrganizerId: selection.selectedOrganizerId,
    accessRole: selection.selectedAccessRole,
    canManageOrganizerProfile: selection.selectedCanManageOrganizerProfile,
    accessByOrganizerId: mappedAccess.roles,
    canManageOrganizerProfileByOrganizerId: mappedAccess.profileByOrganizerId
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
  const session = await getApiSession();
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
        canManageOrganizerProfile: true,
        accessByOrganizerId: Object.fromEntries(
          selection.organizers.map((organizer) => [organizer.id, 'OWNER' as const])
        ),
        canManageOrganizerProfileByOrganizerId: Object.fromEntries(
          selection.organizers.map((organizer) => [organizer.id, true])
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

  if (
    requiredSection &&
    !canAccessOrganizerSection(selection.selectedAccessRole, requiredSection, {
      canManageOrganizerProfile: selection.selectedCanManageOrganizerProfile
    })
  ) {
    return { ok: false, status: 403, error: 'Accès organisateur non autorisé.' };
  }

  const mappedAccess = mapAccessByOrganizerId(selection.accessByOrganizerId);

  return {
    ok: true,
    context: {
      session,
      organizers: selection.organizers,
      selectedOrganizer: selection.selectedOrganizer,
      selectedOrganizerId: selection.selectedOrganizerId,
      accessRole: selection.selectedAccessRole,
      canManageOrganizerProfile: selection.selectedCanManageOrganizerProfile,
      accessByOrganizerId: mappedAccess.roles,
      canManageOrganizerProfileByOrganizerId: mappedAccess.profileByOrganizerId
    }
  };
}
