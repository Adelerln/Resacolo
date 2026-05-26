import { requireRole } from '@/lib/auth/require';
import { normalizeOrganizerAccessRole } from '@/lib/organizer-access';
import { getServerSupabaseClient } from '@/lib/supabase/server';
import { AdminUsersTable } from '@/components/admin/AdminUsersTable';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';
export const revalidate = 0;

type SearchParams = Record<string, string | string[] | undefined>;

type PageProps = {
  searchParams?: Promise<SearchParams>;
};

function getSingleParam(searchParams: SearchParams | undefined, key: string) {
  const value = searchParams?.[key];
  return Array.isArray(value) ? value[0] : value;
}

function splitFullName(fullName: string | null | undefined) {
  const normalized = String(fullName ?? '').trim();
  if (!normalized) {
    return { firstName: null, lastName: null };
  }

  const [firstName, ...rest] = normalized.split(/\s+/);
  return {
    firstName: firstName || null,
    lastName: rest.join(' ').trim() || null
  };
}

function normalizeVisibleStaffRole(rawRole: string | null | undefined) {
  const normalized = String(rawRole ?? '')
    .trim()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toUpperCase();

  if (!normalized || normalized.includes('MNEMOS')) return null;
  if (normalized === 'SALES_ADMIN' || normalized === 'ADMIN_SALES') return 'ADMIN_SALES' as const;
  if (normalized === 'ADMIN' || normalized.includes('SUPPORT') || normalized.includes('PLATFORM_ADMIN')) {
    return 'ADMIN' as const;
  }
  if (normalized.includes('ADMIN')) return 'ADMIN' as const;
  return null;
}

function getSuccessMessage(searchParams: SearchParams | undefined) {
  const success = getSingleParam(searchParams, 'success');
  if (success === 'staff-user-created') return 'Utilisateur commercial créé.';
  if (success === 'staff-user-updated') return 'Utilisateur mis à jour.';
  if (getSingleParam(searchParams, 'password_updated') === '1') return 'Mot de passe mis à jour.';
  return null;
}

export default async function AdminUsersPage({ searchParams }: PageProps) {
  await requireRole('ADMIN');
  const resolvedSearchParams = searchParams ? await searchParams : undefined;
  const supabase = getServerSupabaseClient();
  const [{ data: membersRaw }, { data: staffUsersRaw }] = await Promise.all([
    supabase
      .from('organizer_members')
      .select('id,role,user_id,first_name,last_name,created_at,organizer_id')
      .order('created_at', { ascending: false }),
    supabase.from('staff_users').select('user_id,role,created_at').order('created_at', { ascending: false })
  ]);

  const organizerIds = Array.from(
    new Set((membersRaw ?? []).map((member) => member.organizer_id).filter(Boolean))
  );
  const { data: organizersRaw } =
    organizerIds.length > 0
      ? await supabase.from('organizers').select('id,name').in('id', organizerIds)
      : { data: [] };
  const organizerById = new Map(
    (organizersRaw ?? []).map((organizer) => [organizer.id, organizer.name])
  );

  const visibleStaffUsers = (staffUsersRaw ?? [])
    .map((staffUser) => ({
      ...staffUser,
      role: normalizeVisibleStaffRole(staffUser.role)
    }))
    .filter((staffUser): staffUser is typeof staffUser & { role: 'ADMIN' | 'ADMIN_SALES' } => Boolean(staffUser.role));

  const allUserIds = Array.from(
    new Set([
      ...(membersRaw ?? []).map((member) => member.user_id).filter(Boolean),
      ...visibleStaffUsers.map((staffUser) => staffUser.user_id).filter(Boolean)
    ])
  );
  const authUsersById = new Map(
    await Promise.all(
      allUserIds.map(async (userId) => {
        const { data } = await supabase.auth.admin.getUserById(userId);
        return [userId, data.user ?? null] as const;
      })
    )
  );

  const members = [
    ...(membersRaw ?? []).map((member) => {
      const authUser = authUsersById.get(member.user_id);
      return {
        kind: 'organizer' as const,
        ...member,
        role: normalizeOrganizerAccessRole(member.role),
        email: authUser?.email ?? null,
        organizerName: organizerById.get(member.organizer_id) ?? null
      };
    }),
    ...visibleStaffUsers.map((staffUser) => {
      const authUser = authUsersById.get(staffUser.user_id);
      const fullName =
        String(authUser?.user_metadata?.full_name ?? '').trim() ||
        String(authUser?.user_metadata?.name ?? '').trim() ||
        null;
      const { firstName, lastName } = splitFullName(fullName);

      return {
        kind: 'staff' as const,
        id: staffUser.user_id,
        user_id: staffUser.user_id,
        role: staffUser.role,
        first_name: firstName,
        last_name: lastName,
        email: authUser?.email ?? null,
        organizerName: 'Back-office'
      };
    })
  ];

  return (
    <div className="space-y-6">
      <div>
        <h1 className="admin-page-title">Utilisateurs</h1>
        <p className="admin-page-subtitle mt-1">
          Gestion des accès membres organisateurs et comptes commerciaux non reliés à un organisme.
        </p>
      </div>

      {getSingleParam(resolvedSearchParams, 'error') && (
        <div className="rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
          {getSingleParam(resolvedSearchParams, 'error')}
        </div>
      )}

      {getSuccessMessage(resolvedSearchParams) && (
        <div className="rounded-xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-700">
          {getSuccessMessage(resolvedSearchParams)}
        </div>
      )}

      <AdminUsersTable
        members={members}
        initialMode={getSingleParam(resolvedSearchParams, 'openCreate') === '1' ? 'add' : null}
        initialUserId={getSingleParam(resolvedSearchParams, 'editUserId') ?? null}
      />
    </div>
  );
}
