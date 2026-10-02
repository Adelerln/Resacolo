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
  searchParams?: Promise<{
    organizerId?: string | string[];
    success?: string | string[];
    error?: string | string[];
  }>;
}) {
  const resolved = searchParams ? await searchParams : undefined;
  const { selectedOrganizerId, accessRole } = await requireOrganizerPageAccess({
    requestedOrganizerId: resolved?.organizerId,
    requiredSection: 'users'
  });

  const supabase = getServerSupabaseClient();
  const membersQuery = await supabase
    .from('organizer_members')
    .select(
      'id,role,user_id,first_name,last_name,created_at,organizer_id,can_manage_organizer_profile'
    )
    .eq('organizer_id', selectedOrganizerId)
    .order('created_at', { ascending: false });
  const membersRaw =
    membersQuery.error?.message.includes('can_manage_organizer_profile')
      ? (
          await supabase
            .from('organizer_members')
            .select('id,role,user_id,first_name,last_name,created_at,organizer_id')
            .eq('organizer_id', selectedOrganizerId)
            .order('created_at', { ascending: false })
        ).data
      : membersQuery.data;

  const delegationsQuery = await supabase
    .from('organizers')
    .select('order_status_notify_member_id,weekly_recap_notify_member_id')
    .eq('id', selectedOrganizerId)
    .maybeSingle();
  const delegations =
    delegationsQuery.error?.message.includes('order_status_notify_member_id') ||
    delegationsQuery.error?.message.includes('weekly_recap_notify_member_id')
      ? { order_status_notify_member_id: null, weekly_recap_notify_member_id: null }
      : delegationsQuery.data;

  const membersList = membersRaw ?? [];
  const members = await Promise.all(
    membersList.map(async (member) => {
      const { data: userData } = await supabase.auth.admin.getUserById(member.user_id);
      return {
        ...member,
        email: userData?.user?.email ?? null,
        can_manage_organizer_profile: Boolean(
          (member as { can_manage_organizer_profile?: boolean }).can_manage_organizer_profile
        )
      };
    })
  );

  const memberLabel = (member: (typeof members)[number]) => {
    const name = [member.first_name, member.last_name].filter(Boolean).join(' ').trim();
    if (name && member.email) return `${name} (${member.email})`;
    return member.email ?? name ?? 'Membre';
  };

  const isOwner = accessRole === 'OWNER';
  const successParam = Array.isArray(resolved?.success) ? resolved?.success[0] : resolved?.success;
  const errorParam = Array.isArray(resolved?.error) ? resolved?.error[0] : resolved?.error;

  return (
    <div className="space-y-6">
      <OrganizerPageHeader
        title="Utilisateurs"
        subtitle="Membres, rôles, responsables des emails et accès à la fiche organisateur."
      />
      {!isOwner && (
        <p className="organizer-alert-warning">
          Seul un <strong>Propriétaire</strong> peut ajouter/modifier/supprimer des utilisateurs.
        </p>
      )}
      {errorParam ? (
        <p className="rounded-xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-700">
          {decodeURIComponent(errorParam)}
        </p>
      ) : null}
      {successParam ? (
        <p className="rounded-xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-700">
          {decodeURIComponent(successParam)}
        </p>
      ) : null}

      {isOwner && (
        <form
          className="organizer-card space-y-4 p-4 sm:p-6"
          action="/api/organisme/member-delegations"
          method="post"
        >
          <input type="hidden" name="organizer_id" value={selectedOrganizerId} />
          <h2 className="organizer-section-title">Responsables et notifications</h2>
          <p className="text-sm text-slate-600">
            Désignez qui reçoit les emails de commande et le récap hebdomadaire des places. Sans
            désignation, l’email de contact de la fiche organisateur (ou le propriétaire) est
            utilisé.
          </p>
          <div className="grid gap-4 md:grid-cols-2">
            <label className="block text-sm font-medium text-slate-700">
              Statuts de commande
              <select
                name="order_status_notify_member_id"
                defaultValue={delegations?.order_status_notify_member_id ?? ''}
                className="organizer-input"
              >
                <option value="">Par défaut (contact fiche organisateur)</option>
                {members.map((member) => (
                  <option key={`order-${member.id}`} value={member.id}>
                    {memberLabel(member)}
                  </option>
                ))}
              </select>
            </label>
            <label className="block text-sm font-medium text-slate-700">
              Récap hebdomadaire des places
              <select
                name="weekly_recap_notify_member_id"
                defaultValue={delegations?.weekly_recap_notify_member_id ?? ''}
                className="organizer-input"
              >
                <option value="">Par défaut (contact fiche organisateur)</option>
                {members.map((member) => (
                  <option key={`weekly-${member.id}`} value={member.id}>
                    {memberLabel(member)}
                  </option>
                ))}
              </select>
            </label>
          </div>
          <div className="flex justify-end">
            <button type="submit" className="organizer-btn-primary">
              Enregistrer les désignations
            </button>
          </div>
        </form>
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
          <table className="organizer-table w-full table-fixed">
            <colgroup>
              <col className="w-[16%]" />
              <col className="w-[12%]" />
              <col className="w-[12%]" />
              <col className="w-[11%]" />
              <col className="w-[12%]" />
              <col className="w-[15%]" />
              <col className="w-[9%]" />
              <col className="w-[13%]" />
            </colgroup>
            <thead>
              <tr>
                <th className="px-4 py-3 text-center">Email</th>
                <th className="px-4 py-3 text-center">Prénom</th>
                <th className="px-4 py-3 text-center">Nom</th>
                <th className="px-4 py-3 text-center">Rôle</th>
                <th className="px-4 py-3 text-center">Fiche organisateur</th>
                <th className="px-4 py-3 text-center">Mot de passe</th>
                <th className="px-4 py-3 text-center">Ajouté le</th>
                <th className="px-4 py-3 text-center">Actions</th>
              </tr>
            </thead>
            <tbody>
              {members.map((member) => (
                <tr key={member.id} className="border-t border-slate-100">
                  <td className="px-4 py-3 text-slate-600 whitespace-nowrap">{member.email ?? '—'}</td>
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
                  <td className="px-4 py-3 text-center text-slate-600">
                    {member.role === 'OWNER' ? (
                      <span className="text-xs font-medium text-emerald-700">Inclus (propriétaire)</span>
                    ) : (
                      <label className="inline-flex items-center justify-center gap-2 text-sm">
                        <input
                          form={`member-${member.id}`}
                          type="checkbox"
                          name="can_manage_organizer_profile"
                          value="1"
                          defaultChecked={member.can_manage_organizer_profile}
                          disabled={!isOwner}
                          className="h-4 w-4 rounded border-slate-300"
                        />
                        <span className="sr-only">Paramétrage fiche organisateur</span>
                      </label>
                    )}
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
                    <div className="flex flex-nowrap justify-end gap-2 whitespace-nowrap">
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
                  <td className="px-4 py-6 text-slate-500" colSpan={8}>
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
