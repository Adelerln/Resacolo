import Link from 'next/link';
import { requireRole } from '@/lib/auth/require';
import { getServerSupabaseClient } from '@/lib/supabase/server';

export const dynamic = 'force-dynamic';
export const revalidate = 0;

type OrganizerRow = {
  id: string;
  name: string;
  contact_email: string | null;
  created_at: string;
  slug: string | null;
  membersCount?: number;
};

export default async function AdminOrganizersPage() {
  await requireRole('ADMIN');
  const supabase = getServerSupabaseClient();
  const hasServiceRole = Boolean(process.env.SUPABASE_SERVICE_ROLE_KEY);

  const { data, error } = await supabase
    .from('organizers')
    .select('id,name,contact_email,created_at,slug')
    .order('created_at', { ascending: false });

  const organizersBase = (data ?? []) as OrganizerRow[];
  const organizers = await Promise.all(
    organizersBase.map(async (organizer) => {
      const { count } = await supabase
        .from('organizer_members')
        .select('id', { count: 'exact', head: true })
        .eq('organizer_id', organizer.id);
      return { ...organizer, membersCount: count ?? 0 };
    })
  );
  const loadError = error?.message ?? null;

  return (
    <div className="space-y-6">
      {!hasServiceRole && (
        <div className="rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-700">
          SUPABASE_SERVICE_ROLE_KEY manquante côté serveur. La liste peut être vide à cause des
          droits d’accès.
        </div>
      )}
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-2xl font-semibold text-slate-900">Organisateurs</h1>
          <p className="text-sm text-slate-600">Gérer les organismes et leurs membres.</p>
        </div>
        <Link
          href="/admin/organisateurs/new"
          className="inline-flex min-h-[44px] items-center justify-center rounded-lg bg-emerald-600 px-4 py-2 text-sm font-semibold text-white"
        >
          Créer un organisateur
        </Link>
      </div>

      <div className="overflow-hidden rounded-2xl border border-slate-200 bg-white">
        <div className="overflow-x-auto">
          <table className="min-w-[720px] w-full text-left text-sm">
            <thead className="bg-slate-50 text-xs uppercase text-slate-500">
              <tr>
                <th className="px-4 py-3">Organisateur</th>
                <th className="px-4 py-3">Email contact</th>
                <th className="px-4 py-3">Membres</th>
                <th className="px-4 py-3">Créé le</th>
                <th className="px-4 py-3"></th>
              </tr>
            </thead>
            <tbody>
              {organizers.map((organizer) => (
                <tr key={organizer.id} className="border-t border-slate-100">
                  <td className="px-4 py-3 font-medium text-slate-900">{organizer.name}</td>
                  <td className="px-4 py-3 text-slate-600">{organizer.contact_email ?? '-'}</td>
                  <td className="px-4 py-3 text-slate-600">
                    {organizer.membersCount ?? 0}
                  </td>
                  <td className="px-4 py-3 text-slate-600">
                    {new Date(organizer.created_at).toLocaleDateString('fr-FR')}
                  </td>
                  <td className="px-4 py-3 text-right">
                    <Link
                      href={`/admin/organisateurs/${organizer.slug ?? organizer.id}`}
                      className="text-emerald-600"
                    >
                      Voir
                    </Link>
                  </td>
                </tr>
              ))}
              {organizers.length === 0 && (
                <tr>
                  <td className="px-4 py-6 text-slate-500" colSpan={5}>
                    {loadError ? `Erreur: ${loadError}` : 'Aucun organisateur.'}
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
