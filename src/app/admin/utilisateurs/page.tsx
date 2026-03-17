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
  requireRole('ADMIN');
  const supabase = getServerSupabaseClient();
  const { data: membersRaw } = await supabase
    .from('organizer_members')
    .select('id,role,user_id,first_name,last_name,created_at,organizer_id')
    .order('created_at', { ascending: false });

  const members = await Promise.all(
    (membersRaw ?? []).map(async (member) => {
      const { data: userData } = await supabase.auth.admin.getUserById(member.user_id);
      return {
        ...member,
        role: normalizeRole(member.role),
        email: userData?.user?.email ?? null,
        organizerName: null
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
