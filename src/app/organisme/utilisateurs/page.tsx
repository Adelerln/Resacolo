import { requireOrganizerPageAccess } from '@/lib/organizer-backoffice-access.server';
import OrganizerPageHeader from '@/components/organisme/OrganizerPageHeader';
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
  const { selectedOrganizerId, accessRole } = await requireOrganizerPageAccess({
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
      <OrganizerPageHeader
        title="Utilisateurs"
        subtitle="Gérez les membres et leurs rôles d’accès à l’espace organisateur."
      />
      {!isOwner && (
        <p className="organizer-alert-warning">
          Seul un <strong>Propriétaire</strong> peut ajouter/modifier/supprimer des utilisateurs.
        </p>
      )}

      {isOwner && (
        <form
          className="organizer-card space-y-4 p-4 sm:p-6"
          action="/api/organisme/members"
          method="post"
        >
          <input type="hidden" name="organizer_id" value={selectedOrganizerId} />
          <h2 className="organizer-section-title">Ajouter un utilisateur</h2>
          <div className="grid gap-4 md:grid-cols-2">
            <label className="block text-sm font-medium text-slate-700">
              Prénom
              <input
                name="first_name"
                required
                className="organizer-input"
              />
            </label>
            <label className="block text-sm font-medium text-slate-700">
              Nom
              <input
                name="last_name"
                required
                className="organizer-input"
              />
            </label>
            <label className="block text-sm font-medium text-slate-700">
              Email
              <input
                name="email"
                type="email"
                required
                className="organizer-input"
              />
            </label>
            <label className="block text-sm font-medium text-slate-700">
              Rôle
              <select
                name="role"
                defaultValue="EDITOR"
                className="organizer-input"
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
                className="organizer-input"
              />
            </label>
            <div className="flex items-end">
              <p className="text-xs text-slate-500">{PASSWORD_POLICY_MESSAGE}</p>
            </div>
          </div>
          <div className="flex justify-end">
            <button className="organizer-btn-primary">
              Ajouter
            </button>
          </div>
        </form>
      )}

      <div className="organizer-table-shell">
        <div className="overflow-x-auto">
          <table className="organizer-table min-w-[1200px] w-full table-fixed">
            <colgroup>
              <col className="w-[18%]" />
              <col className="w-[14%]" />
              <col className="w-[14%]" />
              <col className="w-[12%]" />
              <col className="w-[22%]" />
              <col className="w-[10%]" />
              <col className="w-[10%]" />
            </colgroup>
            <thead>
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
                      className="organizer-input mt-0 min-h-[42px] w-full min-w-0 disabled:bg-slate-50"
                    />
                  </td>
                  <td className="px-4 py-3 text-slate-600">
                    <input
                      form={`member-${member.id}`}
                      name="last_name"
                      defaultValue={member.last_name ?? ''}
                      disabled={!isOwner}
                      className="organizer-input mt-0 min-h-[42px] w-full min-w-0 disabled:bg-slate-50"
                    />
                  </td>
                  <td className="px-4 py-3 text-slate-600">
                    <select
                      form={`member-${member.id}`}
                      name="role"
                      defaultValue={member.role}
                      disabled={!isOwner}
                      className="organizer-input mt-0 min-h-[42px] w-full disabled:bg-slate-50"
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
                      className="flex w-full min-w-0 items-center gap-2"
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
                        className="organizer-input mt-0 min-h-[42px] w-full disabled:bg-slate-50"
                      />
                      <button
                        disabled={!isOwner}
                        className="organizer-btn-secondary min-h-[32px] shrink-0 px-2 py-1 text-xs disabled:opacity-50"
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
                          className="organizer-btn-primary min-h-[32px] px-2 py-1 text-xs disabled:opacity-50"
                        >
                          OK
                        </button>
                      </form>
                      <form action={`/api/organisme/members/${member.id}/delete`} method="post">
                        <input type="hidden" name="organizer_id" value={selectedOrganizerId} />
                        <button
                          disabled={!isOwner}
                          className="organizer-btn-secondary min-h-[32px] px-2 py-1 text-xs disabled:opacity-50"
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
