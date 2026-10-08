import { createServerActionClient, createServerComponentClient } from '@supabase/auth-helpers-nextjs';
import { cookies } from 'next/headers';
import { cache } from 'react';
import type { Database } from '@/types/supabase';
import {
  resolveRoleContextForUserId,
  type AppRole,
  type ResolvedRoleContext
} from '@/lib/auth/roles';

export type { AppRole } from '@/lib/auth/roles';

export type SessionPayload = {
  userId: string;
  email: string;
  name?: string | null;
  role: Exclude<AppRole, 'ANONYME'>;
  tenantId?: string | null;
  organizerIds: string[];
  collectivityIds: string[];
  organizerRolesById: Record<string, string>;
  collectivityRolesById: Record<string, string>;
  /** Sous-entité CSE du membre partenaire (null = vue globale du partenaire). */
  collectivitySubEntityId: string | null;
  staffRoles: string[];
  isClient: boolean;
};

function buildSessionPayload(
  user: { id: string; email?: string | null; user_metadata?: { full_name?: string; name?: string } | null },
  roleContext: ResolvedRoleContext
): SessionPayload {
  const metadataName =
    user.user_metadata?.full_name?.trim() || user.user_metadata?.name?.trim() || null;

  return {
    userId: user.id,
    email: user.email?.trim().toLowerCase() ?? '',
    name: metadataName,
    role: roleContext.role,
    tenantId:
      roleContext.role === 'ORGANISATEUR'
        ? roleContext.organizerIds[0] ?? null
        : roleContext.role === 'PARTENAIRE'
          ? roleContext.collectivityIds[0] ?? null
          : null,
    organizerIds: roleContext.organizerIds,
    collectivityIds: roleContext.collectivityIds,
    organizerRolesById: roleContext.organizerRolesById,
    collectivityRolesById: roleContext.collectivityRolesById,
    collectivitySubEntityId:
      roleContext.role === 'PARTENAIRE' ? roleContext.collectivitySubEntityId : null,
    staffRoles: roleContext.staffRoles,
    isClient: roleContext.isClient
  };
}

async function readSessionPayload(mode: 'component' | 'action'): Promise<SessionPayload | null> {
  const cookieStore = await cookies();
  const cookieAccess = (() => cookieStore) as unknown as typeof cookies;
  const supabase =
    mode === 'action'
      ? createServerActionClient<Database>({ cookies: cookieAccess })
      : createServerComponentClient<Database>({ cookies: cookieAccess });
  const {
    data: { user },
    error
  } = await supabase.auth.getUser();

  if (error || !user) {
    return null;
  }

  const roleContext = await resolveRoleContextForUserId(user.id);
  return buildSessionPayload(user, roleContext);
}

/** Déduplique layout + page (ex. /mon-compte juste après login). */
export const getCurrentUser = cache(async (): Promise<SessionPayload | null> => {
  return readSessionPayload('component');
});

/**
 * Session pour Server Actions : client capable de rafraîchir/écrire les cookies.
 * Sans ça, un token expiré pendant l’action renvoie null → redirect login (« déconnexion »).
 */
export async function getCurrentUserAction(): Promise<SessionPayload | null> {
  return readSessionPayload('action');
}

export async function getCurrentUserRole(): Promise<AppRole> {
  const session = await getCurrentUser();
  return session?.role ?? 'ANONYME';
}

export async function getSession(): Promise<SessionPayload | null> {
  return getCurrentUser();
}
