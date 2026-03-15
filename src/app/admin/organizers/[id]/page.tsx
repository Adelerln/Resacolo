import Link from 'next/link';
import { notFound } from 'next/navigation';
import { requireRole } from '@/lib/auth/require';
import { getServerSupabaseClient } from '@/lib/supabase/server';

export const dynamic = 'force-dynamic';
export const revalidate = 0;

type PageProps = { params: { id: string }; searchParams?: { error?: string; success?: string } };

export default async function AdminOrganizerDetailPage({ params, searchParams }: PageProps) {
  requireRole('ADMIN');
  const supabase = getServerSupabaseClient();

  let { data: organizer } = await supabase
    .from('organizers')
    .select(
      'id,name,contact_email,created_at,description,founded_year,age_min,age_max,logo_path,education_project_path,slug'
    )
    .eq('slug', params.id)
    .maybeSingle();

  if (!organizer) {
    const { data: byId } = await supabase
      .from('organizers')
      .select(
        'id,name,contact_email,created_at,description,founded_year,age_min,age_max,logo_path,education_project_path,slug'
      )
      .eq('id', params.id)
      .maybeSingle();
    organizer = byId ?? null;
  }

  if (!organizer) {
    notFound();
  }

  const organizerSlug = organizer.slug ?? organizer.id;

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
    ? (await supabase.storage
        .from('organizer-logo')
        .createSignedUrl(organizer.logo_path, 60 * 60)).data?.signedUrl ?? null
    : null;
  const projectUrl = organizer.education_project_path
    ? (await supabase.storage
        .from('organizer-docs')
        .createSignedUrl(organizer.education_project_path, 60 * 60)).data?.signedUrl ?? null
    : null;
  const hasProject = Boolean(organizer.education_project_path);

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-semibold text-slate-900">{organizer.name}</h1>
          <p className="text-sm text-slate-600">{organizer.contact_email ?? '-'}</p>
        </div>
      </div>

      {searchParams?.error && (
        <div className="rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
          {searchParams.error}
        </div>
      )}
      {searchParams?.success && (
        <div className="rounded-xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-700">
          Enregistrement effectué.
        </div>
      )}

      <form
        action={`/api/admin/organizers/${organizerSlug}`}
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
          <div className="block text-sm font-medium text-slate-700">
            <span>Logo (PNG/JPG)</span>
            {logoUrl ? (
              <div className="mt-2 space-y-1">
                <div className="text-xs text-slate-500">Logo déjà chargé</div>
                <img src={logoUrl} alt={organizer.name} className="h-16 w-auto rounded-lg border" />
                <button
                  formAction={`/api/admin/organizers/${organizerSlug}/logo/delete`}
                  formMethod="post"
                  className="inline-flex items-center text-xs font-semibold text-red-600"
                >
                  Supprimer le logo
                </button>
              </div>
            ) : (
              <input
                name="logo"
                type="file"
                accept="image/*"
                className="mt-1 w-full rounded-lg border border-slate-200 px-3 py-2"
              />
            )}
          </div>
          <div className="block text-sm font-medium text-slate-700">
            <span>Projet éducatif (PDF)</span>
            {hasProject ? (
              <div className="mt-2 flex items-center gap-3 rounded-lg border border-slate-200 bg-slate-50 px-3 py-2">
                <div className="flex h-10 w-10 items-center justify-center rounded-md bg-red-100 text-red-600">
                  <span className="text-xs font-bold">PDF</span>
                </div>
                <div className="flex-1 space-y-1">
                  <div className="text-sm font-medium text-slate-800 truncate">
                    Projet éducatif
                  </div>
                  {projectUrl && (
                    <a
                      className="inline-flex text-xs font-medium text-brand-600"
                      href={projectUrl}
                      target="_blank"
                      rel="noreferrer"
                    >
                      Télécharger le PDF actuel
                    </a>
                  )}
                </div>
                <button
                  type="button"
                  formAction={`/api/admin/organizers/${organizerSlug}/project/delete`}
                  formMethod="post"
                  className="ml-2 text-xs font-semibold text-red-600"
                >
                  Supprimer
                </button>
              </div>
            ) : (
              <div className="mt-1">
                <input
                  name="education_project"
                  type="file"
                  accept="application/pdf"
                  className="w-full rounded-lg border border-slate-200 px-3 py-2"
                />
              </div>
            )}
          </div>
        </div>
        <div className="flex justify-end">
          <button className="rounded-lg bg-emerald-600 px-4 py-2 text-sm font-semibold text-white">
            Enregistrer
          </button>
        </div>
      </form>

      <div className="flex justify-end">
        <Link
          href={`/admin/organizers/${organizerSlug}/members/new`}
          className="rounded-lg border border-slate-200 px-4 py-2 text-sm font-semibold text-slate-700"
        >
          Ajouter un membre
        </Link>
      </div>

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
                    action={`/api/admin/organizers/${organizerSlug}/members/${member.id}`}
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
