import Link from 'next/link';
import { notFound } from 'next/navigation';
import { requireRole } from '@/lib/auth/require';
import { getServerSupabaseClient } from '@/lib/supabase/server';

type PageProps = { params: { id: string } };

export default async function AdminOrganizerDetailPage({ params }: PageProps) {
  requireRole('ADMIN');
  const supabase = getServerSupabaseClient();

  const { data: organizer } = await supabase
    .from('organizers')
    .select(
      'id,name,contact_email,created_at,description,founded_year,age_min,age_max,logo_path,education_project_path,slug'
    )
    .eq('id', params.id)
    .maybeSingle();

  if (!organizer) {
    notFound();
  }

  const { data: membersRaw } = await supabase
    .from('organizer_members')
    .select('id,role,user_id,created_at,first_name,last_name')
    .eq('organizer_id', organizer.id)
    .order('created_at', { ascending: true });

  const members = await Promise.all(
    (membersRaw ?? []).map(async (member) => {
      const { data: userData } = await supabase.auth.admin.getUserById(member.user_id);
      return { ...member, email: userData?.user?.email ?? null };
    })
  );

  const logoUrl = organizer.logo_path
    ? supabase.storage.from('organizer-logo').getPublicUrl(organizer.logo_path).data.publicUrl
    : null;
  const projectUrl = organizer.education_project_path
    ? supabase.storage.from('organizer-docs').getPublicUrl(organizer.education_project_path).data.publicUrl
    : null;

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-semibold text-slate-900">{organizer.name}</h1>
          <p className="text-sm text-slate-600">{organizer.contact_email ?? '-'}</p>
        </div>
        <Link
          href={`/admin/organizers/${organizer.id}/members/new`}
          className="rounded-lg border border-slate-200 px-4 py-2 text-sm font-semibold text-slate-700"
        >
          Ajouter un membre
        </Link>
      </div>

      <form
        action={`/api/admin/organizers/${organizer.id}`}
        method="post"
        encType="multipart/form-data"
        className="space-y-4 rounded-2xl border border-slate-200 bg-white p-6 text-sm text-slate-600"
      >
        <h2 className="text-lg font-semibold text-slate-900">Fiche organisme</h2>
        <div className="grid gap-2 md:grid-cols-2">
          <div>
            <div className="text-xs uppercase text-slate-400">Créé le</div>
            <div className="font-medium text-slate-900">
              {new Date(organizer.created_at).toLocaleDateString('fr-FR')}
            </div>
          </div>
        </div>
        <div className="grid gap-4 md:grid-cols-2">
          <label className="block text-sm font-medium text-slate-700">
            Nom
            <input
              name="name"
              defaultValue={organizer.name}
              className="mt-1 w-full rounded-lg border border-slate-200 px-3 py-2"
            />
          </label>
          <label className="block text-sm font-medium text-slate-700">
            Email de contact
            <input
              name="contact_email"
              type="email"
              defaultValue={organizer.contact_email ?? ''}
              className="mt-1 w-full rounded-lg border border-slate-200 px-3 py-2"
            />
          </label>
        </div>
        <div className="grid gap-4 md:grid-cols-3">
          <label className="block text-sm font-medium text-slate-700">
            Année de création
            <input
              name="founded_year"
              type="number"
              min="1900"
              max="2100"
              defaultValue={organizer.founded_year ?? ''}
              className="mt-1 w-full rounded-lg border border-slate-200 px-3 py-2"
            />
          </label>
          <label className="block text-sm font-medium text-slate-700">
            Âge min
            <input
              name="age_min"
              type="number"
              min="0"
              defaultValue={organizer.age_min ?? ''}
              className="mt-1 w-full rounded-lg border border-slate-200 px-3 py-2"
            />
          </label>
          <label className="block text-sm font-medium text-slate-700">
            Âge max
            <input
              name="age_max"
              type="number"
              min="0"
              defaultValue={organizer.age_max ?? ''}
              className="mt-1 w-full rounded-lg border border-slate-200 px-3 py-2"
            />
          </label>
        </div>
        <label className="block text-sm font-medium text-slate-700">
          Texte de présentation
          <textarea
            name="description"
            rows={4}
            defaultValue={organizer.description ?? ''}
            className="mt-1 w-full rounded-lg border border-slate-200 px-3 py-2"
          />
        </label>
        <div className="grid gap-4 md:grid-cols-2">
          <label className="block text-sm font-medium text-slate-700">
            Logo (PNG/JPG)
            <input
              name="logo"
              type="file"
              accept="image/*"
              className="mt-1 w-full rounded-lg border border-slate-200 px-3 py-2"
            />
            {logoUrl && (
              <img src={logoUrl} alt={organizer.name} className="mt-2 h-16 w-auto rounded-lg border" />
            )}
          </label>
          <label className="block text-sm font-medium text-slate-700">
            Projet éducatif (PDF)
            <input
              name="education_project"
              type="file"
              accept="application/pdf"
              className="mt-1 w-full rounded-lg border border-slate-200 px-3 py-2"
            />
            {projectUrl && (
              <a className="mt-2 inline-flex text-sm font-medium text-brand-600" href={projectUrl}>
                Télécharger le PDF actuel
              </a>
            )}
          </label>
        </div>
        <div className="flex justify-end">
          <button className="rounded-lg bg-emerald-600 px-4 py-2 text-sm font-semibold text-white">
            Enregistrer
          </button>
        </div>
      </form>

      <div className="overflow-hidden rounded-2xl border border-slate-200 bg-white">
        <table className="w-full text-left text-sm">
          <thead className="bg-slate-50 text-xs uppercase text-slate-500">
            <tr>
              <th className="px-4 py-3">Email</th>
              <th className="px-4 py-3">Prénom</th>
              <th className="px-4 py-3">Nom</th>
              <th className="px-4 py-3">Rôle</th>
              <th className="px-4 py-3">Ajouté le</th>
              <th className="px-4 py-3"></th>
            </tr>
          </thead>
          <tbody>
            {(members ?? []).map((member) => (
              <tr key={member.id} className="border-t border-slate-100">
                <td className="px-4 py-3 text-slate-600">
                  <input
                    form={`member-${member.id}`}
                    name="email"
                    defaultValue={member.email ?? ''}
                    className="w-48 rounded border border-slate-200 px-2 py-1 text-xs"
                  />
                </td>
                <td className="px-4 py-3 text-slate-600">
                  <input
                    form={`member-${member.id}`}
                    name="first_name"
                    defaultValue={member.first_name ?? ''}
                    className="w-24 rounded border border-slate-200 px-2 py-1 text-xs"
                  />
                </td>
                <td className="px-4 py-3 text-slate-600">
                  <input
                    form={`member-${member.id}`}
                    name="last_name"
                    defaultValue={member.last_name ?? ''}
                    className="w-24 rounded border border-slate-200 px-2 py-1 text-xs"
                  />
                </td>
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
                <td className="px-4 py-3 text-slate-600">
                  {new Date(member.created_at).toLocaleDateString('fr-FR')}
                </td>
                <td className="px-4 py-3 text-right">
                  <form
                    id={`member-${member.id}`}
                    action={`/api/admin/organizers/${organizer.id}/members/${member.id}`}
                    method="post"
                  >
                    <input type="hidden" name="member_id" value={member.id} />
                    <input type="hidden" name="user_id" value={member.user_id} />
                    <button className="rounded bg-emerald-600 px-2 py-1 text-xs font-semibold text-white">
                      OK
                    </button>
                  </form>
                </td>
              </tr>
            ))}
            {(members ?? []).length === 0 && (
              <tr>
                <td className="px-4 py-6 text-slate-500" colSpan={6}>
                  Aucun membre.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
