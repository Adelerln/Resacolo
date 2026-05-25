import { createRouteHandlerClient } from '@supabase/auth-helpers-nextjs';
import { NextResponse } from 'next/server';
import { cookies } from 'next/headers';
import type { SessionPayload } from '@/lib/auth/session';
import { resolveRoleContextForUserId } from '@/lib/auth/roles';
import { hasRequiredRole, type AuthenticatedAppRole } from '@/lib/auth/roles';
import type { Database } from '@/types/supabase';

function buildApiSessionPayload(
  user: { id: string; email?: string | null; user_metadata?: { full_name?: string; name?: string } | null },
  roleContext: Awaited<ReturnType<typeof resolveRoleContextForUserId>>
): SessionPayload {
  return {
    userId: user.id,
    email: user.email?.trim().toLowerCase() ?? '',
    name: user.user_metadata?.full_name?.trim() || user.user_metadata?.name?.trim() || null,
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

async function getApiSession(): Promise<SessionPayload | null> {
  const cookieStore = await cookies();
  const cookieAccess = (() => cookieStore) as unknown as typeof cookies;
  const supabase = createRouteHandlerClient<Database>({
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
  return buildApiSessionPayload(user, roleContext);
}

export async function requireApiAuth() {
  const session = await getApiSession();
  if (!session) {
    return {
      unauthorized: NextResponse.json({ error: 'AUTH_REQUIRED' }, { status: 401 }),
      session: null
    };
  }
  return { unauthorized: null, session };
}

export async function requireApiRole(req: Request, role: AuthenticatedAppRole) {
  void req;
  const { unauthorized, session } = await requireApiAuth();
  if (unauthorized || !session) {
    return unauthorized;
  }
  if (!hasRequiredRole(session.role, role)) {
    return NextResponse.json({ error: 'FORBIDDEN' }, { status: 403 });
  }
  return null;
}

export async function requireApiAdmin(req: Request) {
  return requireApiRole(req, 'ADMIN');
}

export async function requireApiMnemos(req: Request) {
  return requireApiRole(req, 'MNEMOS');
}
