import { requireRole } from '@/lib/auth/require';
import { getServerSupabaseClient } from '@/lib/supabase/server';

export const runtime = 'nodejs';

export default async function AdminUsersPage() {
  requireRole('ADMIN');
  const supabase = getServerSupabaseClient();

  const { data: membersRaw, error } = await supabase
    .from('organizer_members')
    .select('id,role,user_id,first_name,last_name,created_at,organizers(name)')
    .order('created_at', { ascending: false });

  const members = await Promise.all(
    (membersRaw ?? []).map(async (member) => {
      const { data: userData } = await supabase.auth.admin.getUserById(member.user_id);
      return {
        ...member,
        email: userData?.user?.email ?? null,
        organizerName: member.organizers?.name ?? '-'
      };
    })
  );

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-semibold text-slate-900">Utilisateurs</h1>

      <div className="overflow-hidden rounded-2xl border border-slate-200 bg-white">
        <table className="w-full text-left text-sm">
          <thead className="bg-slate-50 text-xs uppercase text-slate-500">
            <tr>
              <th className="px-4 py-3">Prénom</th>
              <th className="px-4 py-3">Nom</th>
              <th className="px-4 py-3">Email</th>
              <th className="px-4 py-3">Organisateur</th>
              <th className="px-4 py-3">Rôle</th>
            </tr>
          </thead>
          <tbody>
            {members.map((member) => (
              <tr key={member.id} className="border-t border-slate-100">
                <td className="px-4 py-3 text-slate-600">
                  <input
                    form={`member-${member.id}`}
                    name="first_name"
                    defaultValue={member.first_name ?? ''}
                    className="w-28 rounded border border-slate-200 px-2 py-1 text-xs"
                  />
                </td>
                <td className="px-4 py-3 text-slate-600">
                  <input
                    form={`member-${member.id}`}
                    name="last_name"
                    defaultValue={member.last_name ?? ''}
                    className="w-28 rounded border border-slate-200 px-2 py-1 text-xs"
                  />
                </td>
                <td className="px-4 py-3 text-slate-600">
                  <input
                    form={`member-${member.id}`}
                    name="email"
                    defaultValue={member.email ?? ''}
                    className="w-56 rounded border border-slate-200 px-2 py-1 text-xs"
                  />
                </td>
                <td className="px-4 py-3 text-slate-600">{member.organizerName}</td>
                <td className="px-4 py-3 text-slate-600">
                  <select
                    form={`member-${member.id}`}
                    name="role"
                    defaultValue={member.role}
                    className="rounded border border-slate-200 px-2 py-1 text-xs"
                  >
                    <option value="OWNER">OWNER</option>
                    <option value="EDITOR">EDITOR</option>
                    <option value="RESERVATION_MANAGER">RESERVATION_MANAGER</option>
                  </select>
                </td>
                <td className="px-4 py-3 text-right">
                  <form id={`member-${member.id}`} action={`/api/admin/organizer-members/${member.id}`} method="post">
                    <input type="hidden" name="user_id" value={member.user_id} />
                    <button className="rounded bg-emerald-600 px-2 py-1 text-xs font-semibold text-white">
                      OK
                    </button>
                  </form>
                </td>
              </tr>
            ))}
            {members.length === 0 && (
              <tr>
                <td className="px-4 py-6 text-slate-500" colSpan={6}>
                  {error ? `Erreur: ${error.message}` : 'Aucun utilisateur.'}
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
