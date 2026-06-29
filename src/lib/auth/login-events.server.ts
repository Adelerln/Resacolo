import 'server-only';

import { createClient, type SupabaseClient } from '@supabase/supabase-js';
import { resolveRoleContextForUserId } from '@/lib/auth/roles';
import { getSupabaseEnv } from '@/lib/supabase/config';
import type { Database } from '@/types/supabase';

type LoginEventOutcome = 'success' | 'failure';
type LoginEventAppRole = Database['public']['Tables']['user_login_events']['Row']['app_role'];
type LoginEventsInsert = Database['public']['Tables']['user_login_events']['Insert'];

export type LogUserLoginEventInput = {
  userId?: string | null;
  email?: string | null;
  outcome: LoginEventOutcome;
  errorCode?: string | null;
  loginMode?: 'family' | 'pro' | null;
  loginPath?: string | null;
  redirectTo?: string | null;
  req?: Request;
};

function getLoginEventsSupabaseClient(): SupabaseClient<Database> {
  const { url, serviceRoleKey } = getSupabaseEnv();
  if (!serviceRoleKey) {
    throw new Error(
      'SUPABASE_SERVICE_ROLE_KEY est requis pour journaliser les connexions (user_login_events).'
    );
  }

  return createClient<Database>(url, serviceRoleKey, {
    auth: { persistSession: false, autoRefreshToken: false }
  });
}

function getRequestClientMeta(req: Request) {
  const forwarded = req.headers.get('x-forwarded-for');
  const ipAddress =
    forwarded?.split(',')[0]?.trim() ?? req.headers.get('x-real-ip')?.trim() ?? null;
  const userAgent = req.headers.get('user-agent')?.trim() ?? null;
  return { ipAddress, userAgent };
}

function normalizeEmail(value: string | null | undefined) {
  const normalized = value?.trim().toLowerCase();
  return normalized || null;
}

async function buildLoginEventRow(
  input: LogUserLoginEventInput,
  supabase: SupabaseClient<Database>
): Promise<LoginEventsInsert | null> {
  const userId = input.userId?.trim() || null;
  const meta = input.req ? getRequestClientMeta(input.req) : { ipAddress: null, userAgent: null };

  if (input.outcome === 'success' && !userId) {
    console.error('[auth/login-events] connexion réussie sans user_id, événement ignoré');
    return null;
  }

  let appRole: LoginEventAppRole = 'UNKNOWN';
  let staffRoles: string[] = [];
  let organizerIds: string[] = [];
  let collectivityIds: string[] = [];
  let membershipRoles: LoginEventsInsert['membership_roles'] = {};

  if (userId) {
    const roleContext = await resolveRoleContextForUserId(userId, supabase);
    appRole = roleContext.role;
    staffRoles = roleContext.staffRoles;
    organizerIds = roleContext.organizerIds;
    collectivityIds = roleContext.collectivityIds;
    membershipRoles = {
      staff: roleContext.staffRoles,
      organizers: roleContext.organizerRolesById,
      collectivities: roleContext.collectivityRolesById
    };
  }

  return {
    user_id: userId,
    email: normalizeEmail(input.email),
    outcome: input.outcome,
    error_code: input.errorCode?.trim() || null,
    app_role: appRole,
    login_mode: input.loginMode ?? null,
    login_path: input.loginPath?.trim() || null,
    redirect_to: input.redirectTo?.trim() || null,
    ip_address: meta.ipAddress,
    user_agent: meta.userAgent,
    staff_roles: staffRoles,
    organizer_ids: organizerIds,
    collectivity_ids: collectivityIds,
    membership_roles: membershipRoles,
    source: 'app',
    metadata: {}
  };
}

export async function logUserLoginEvent(input: LogUserLoginEventInput) {
  try {
    const supabase = getLoginEventsSupabaseClient();
    const row = await buildLoginEventRow(input, supabase);
    if (!row) return;

    const { error } = await supabase.from('user_login_events').insert(row);
    if (error) {
      console.error('[auth/login-events] insert error:', error.message);
    }
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error ?? '');
    console.error('[auth/login-events] unexpected error:', message);
  }
}
