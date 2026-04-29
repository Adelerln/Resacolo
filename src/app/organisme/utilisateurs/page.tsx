import { requireOrganizerPageAccess } from '@/lib/organizer-backoffice-access.server';
import { ORGANIZER_ACCESS_LABELS, ORGANIZER_ACCESS_ROLE_VALUES } from '@/lib/organizer-access';
import { PASSWORD_POLICY_HTML_PATTERN, PASSWORD_POLICY_MESSAGE } from '@/lib/auth/password-policy';
import { getServerSupabaseClient } from '@/lib/supabase/server';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';
export const revalidate = 0;

export default async function OrganismeUsersPage({
  searchParams
}: {
  searchParams?: Promise<{ organizerId?: string | string[] }>;
}) {
  const resolved = searchParams ? await searchParams : undefined;
  const { selectedOrganizerId, selectedOrganizer, accessRole } = await requireOrganizerPageAccess({
    requestedOrganizerId: resolved?.organizerId,
    requiredSection: 'users'
  });

  const supabase = getServerSupabaseClient();
  const { data: membersRaw } = await supabase
    .from('organizer_members')
    .select('id,role,user_id,first_name,last_name,created_at,organizer_id')
    .eq('organizer_id', selectedOrganizerId)
    .order('created_at', { ascending: false });

  const members = await Promise.all(
    (membersRaw ?? []).map(async (member) => {
      const { data: userData } = await supabase.auth.admin.getUserById(member.user_id);
      return {
        ...member,
        email: userData?.user?.email ?? null
      };
    })
  );

  const isOwner = accessRole === 'OWNER';

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold text-slate-900">Utilisateurs</h1>
        <p className="mt-1 text-sm text-slate-600">
          Organisme : {selectedOrganizer?.name ?? '—'} · Accès : {ORGANIZER_ACCESS_LABELS[accessRole]}
        </p>
        {!isOwner && (
          <p className="mt-2 rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-sm text-amber-800">
            Seul un <strong>Propriétaire</strong> peut ajouter/modifier/supprimer des utilisateurs.
          </p>
        )}
      </div>

      {isOwner && (
        <form
          className="space-y-4 rounded-2xl border border-slate-200 bg-white p-4 sm:p-6"
          action="/api/organisme/members"
          method="post"
        >
          <input type="hidden" name="organizer_id" value={selectedOrganizerId} />
          <h2 className="text-lg font-semibold text-slate-900">Ajouter un utilisateur</h2>
          <div className="grid gap-4 md:grid-cols-2">
            <label className="block text-sm font-medium text-slate-700">
              Prénom
              <input
                name="first_name"
                required
                className="mt-1 w-full rounded-lg border border-slate-200 px-3 py-2"
              />
            </label>
            <label className="block text-sm font-medium text-slate-700">
              Nom
              <input
                name="last_name"
                required
                className="mt-1 w-full rounded-lg border border-slate-200 px-3 py-2"
              />
            </label>
            <label className="block text-sm font-medium text-slate-700">
              Email
              <input
                name="email"
                type="email"
                required
                className="mt-1 w-full rounded-lg border border-slate-200 px-3 py-2"
              />
            </label>
            <label className="block text-sm font-medium text-slate-700">
              Rôle
              <select
                name="role"
                defaultValue="EDITOR"
                className="mt-1 w-full rounded-lg border border-slate-200 px-3 py-2"
              >
                {ORGANIZER_ACCESS_ROLE_VALUES.map((role) => (
                  <option key={role} value={role}>
                    {ORGANIZER_ACCESS_LABELS[role]}
                  </option>
                ))}
              </select>
            </label>
          </div>
          <div className="grid gap-4 md:grid-cols-2">
            <label className="block text-sm font-medium text-slate-700">
              Mot de passe temporaire (si le compte n&apos;existe pas encore)
              <input
                name="temp_password"
                type="password"
                pattern={PASSWORD_POLICY_HTML_PATTERN}
                title={PASSWORD_POLICY_MESSAGE}
                className="mt-1 w-full rounded-lg border border-slate-200 px-3 py-2"
              />
            </label>
            <div className="flex items-end">
              <p className="text-xs text-slate-500">{PASSWORD_POLICY_MESSAGE}</p>
            </div>
          </div>
          <div className="flex justify-end">
            <button className="rounded-lg bg-emerald-600 px-4 py-2 text-sm font-semibold text-white">
              Ajouter
            </button>
          </div>
        </form>
      )}

      <div className="overflow-hidden rounded-2xl border border-slate-200 bg-white">
        <div className="overflow-x-auto">
          <table className="min-w-[980px] w-full text-left text-sm">
            <thead className="bg-slate-50 text-xs uppercase text-slate-500">
              <tr>
                <th className="px-4 py-3">Email</th>
                <th className="px-4 py-3">Prénom</th>
                <th className="px-4 py-3">Nom</th>
                <th className="px-4 py-3">Rôle</th>
                <th className="px-4 py-3">Mot de passe</th>
                <th className="px-4 py-3">Ajouté le</th>
                <th className="px-4 py-3 text-right">Actions</th>
              </tr>
            </thead>
            <tbody>
              {members.map((member) => (
                <tr key={member.id} className="border-t border-slate-100">
                  <td className="px-4 py-3 text-slate-600">{member.email ?? '—'}</td>
                  <td className="px-4 py-3 text-slate-600">
                    <input
                      form={`member-${member.id}`}
                      name="first_name"
                      defaultValue={member.first_name ?? ''}
                      disabled={!isOwner}
                      className="min-h-[42px] w-full min-w-[9rem] rounded-lg border border-slate-200 px-3 py-2 text-sm disabled:bg-slate-50"
                    />
                  </td>
                  <td className="px-4 py-3 text-slate-600">
                    <input
                      form={`member-${member.id}`}
                      name="last_name"
                      defaultValue={member.last_name ?? ''}
                      disabled={!isOwner}
                      className="min-h-[42px] w-full min-w-[9rem] rounded-lg border border-slate-200 px-3 py-2 text-sm disabled:bg-slate-50"
                    />
                  </td>
                  <td className="px-4 py-3 text-slate-600">
                    <select
                      form={`member-${member.id}`}
                      name="role"
                      defaultValue={member.role}
                      disabled={!isOwner}
                      className="min-h-[42px] rounded-lg border border-slate-200 px-3 py-2 text-sm disabled:bg-slate-50"
                    >
                      {ORGANIZER_ACCESS_ROLE_VALUES.map((role) => (
                        <option key={role} value={role}>
                          {ORGANIZER_ACCESS_LABELS[role]}
                        </option>
                      ))}
                    </select>
                  </td>
                  <td className="px-4 py-3 text-slate-600">
                    <form
                      action={`/api/organisme/members/${member.id}/password`}
                      method="post"
                      className="flex min-w-[18rem] items-center gap-2"
                    >
                      <input type="hidden" name="organizer_id" value={selectedOrganizerId} />
                      <input
                        name="password"
                        type="password"
                        required
                        disabled={!isOwner}
                        pattern={PASSWORD_POLICY_HTML_PATTERN}
                        title={PASSWORD_POLICY_MESSAGE}
                        placeholder="Nouveau mot de passe"
                        className="min-h-[42px] w-full rounded-lg border border-slate-200 px-3 py-2 text-sm disabled:bg-slate-50"
                      />
                      <button
                        disabled={!isOwner}
                        className="shrink-0 rounded bg-slate-900 px-2 py-1 text-xs font-semibold text-white disabled:opacity-50"
                      >
                        MAJ
                      </button>
                    </form>
                  </td>
                  <td className="px-4 py-3 text-slate-600">
                    {new Date(member.created_at).toLocaleDateString('fr-FR')}
                  </td>
                  <td className="px-4 py-3 text-right">
                    <div className="flex justify-end gap-2">
                      <form
                        id={`member-${member.id}`}
                        action={`/api/organisme/members/${member.id}`}
                        method="post"
                      >
                        <input type="hidden" name="organizer_id" value={selectedOrganizerId} />
                        <button
                          disabled={!isOwner}
                          className="rounded bg-emerald-600 px-2 py-1 text-xs font-semibold text-white disabled:opacity-50"
                        >
                          OK
                        </button>
                      </form>
                      <form action={`/api/organisme/members/${member.id}/delete`} method="post">
                        <input type="hidden" name="organizer_id" value={selectedOrganizerId} />
                        <button
                          disabled={!isOwner}
                          className="rounded border border-slate-200 px-2 py-1 text-xs font-semibold text-slate-700 disabled:opacity-50"
                        >
                          Supprimer
                        </button>
                      </form>
                    </div>
                  </td>
                </tr>
              ))}
              {members.length === 0 && (
                <tr>
                  <td className="px-4 py-6 text-slate-500" colSpan={7}>
                    Aucun utilisateur.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}

