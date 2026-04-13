import { requireRole } from '@/lib/auth/require';
import { getServerSupabaseClient } from '@/lib/supabase/server';
import { AdminUsersTable } from '@/components/admin/AdminUsersTable';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';
export const revalidate = 0;

type AdminRole = 'OWNER' | 'EDITOR' | 'RESERVATION_MANAGER';

function normalizeRole(role: string): AdminRole {
  if (role === 'OWNER' || role === 'RESERVATION_MANAGER') return role;
  return 'EDITOR';
}

export default async function AdminUsersPage() {
  await requireRole('ADMIN');
  const supabase = getServerSupabaseClient();
  const { data: membersRaw } = await supabase
    .from('organizer_members')
    .select('id,role,user_id,first_name,last_name,created_at,organizer_id')
    .order('created_at', { ascending: false });

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

  const members = await Promise.all(
    (membersRaw ?? []).map(async (member) => {
      const { data: userData } = await supabase.auth.admin.getUserById(member.user_id);
      return {
        ...member,
        role: normalizeRole(member.role),
        email: userData?.user?.email ?? null,
        organizerName: organizerById.get(member.organizer_id) ?? null
      };
    })
  );

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-semibold text-slate-900">Utilisateurs</h1>

      <AdminUsersTable members={members} />
    </div>
  );
}
