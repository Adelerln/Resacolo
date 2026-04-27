import { createServerComponentClient } from '@supabase/auth-helpers-nextjs';
import { cookies } from 'next/headers';
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
    staffRoles: roleContext.staffRoles,
    isClient: roleContext.isClient
  };
}

export async function getCurrentUser(): Promise<SessionPayload | null> {
  const cookieStore = await cookies();
  const cookieAccess = (() => cookieStore) as unknown as typeof cookies;
  const supabase = createServerComponentClient<Database>({
    cookies: cookieAccess
  });
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

export async function getCurrentUserRole(): Promise<AppRole> {
  const session = await getCurrentUser();
  return session?.role ?? 'ANONYME';
}

export async function getSession(): Promise<SessionPayload | null> {
  return getCurrentUser();
}
