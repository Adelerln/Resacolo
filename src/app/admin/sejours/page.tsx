import { redirect } from 'next/navigation';
import Link from 'next/link';
import { requireRole } from '@/lib/auth/require';
import { getServerSupabaseClient } from '@/lib/supabase/server';
import { stayStatusLabel } from '@/lib/ui/labels';

export const dynamic = 'force-dynamic';
export const revalidate = 0;

export default async function AdminStaysPage() {
  requireRole('ADMIN');
  const supabase = getServerSupabaseClient();

  const { data: staysRaw, error } = await supabase
    .from('stays')
    .select('id,title,status,season_id,organizer_id,created_at')
    .order('created_at', { ascending: false });

  const organizerIds = Array.from(new Set((staysRaw ?? []).map((stay) => stay.organizer_id)));
  const seasonIds = Array.from(new Set((staysRaw ?? []).map((stay) => stay.season_id)));

  const { data: organizersRaw } = organizerIds.length
    ? await supabase.from('organizers').select('id,name').in('id', organizerIds)
    : { data: [] };
  const { data: seasonsRaw } = seasonIds.length
    ? await supabase.from('seasons').select('id,name').in('id', seasonIds)
    : { data: [] };

  const organizersById = new Map((organizersRaw ?? []).map((organizer) => [organizer.id, organizer.name]));
  const seasonsById = new Map((seasonsRaw ?? []).map((season) => [season.id, season.name]));
  const stays = staysRaw ?? [];

  async function updateStatus(formData: FormData) {
    'use server';
    const supabase = getServerSupabaseClient();
    const stayId = String(formData.get('stayId') ?? '');
    const status = String(formData.get('status') ?? '');
    if (!stayId || !status) {
      redirect('/admin/sejours');
    }

    await supabase
      .from('stays')
      .update({
        status:
          status === 'DRAFT' || status === 'PUBLISHED' || status === 'HIDDEN' || status === 'ARCHIVED'
            ? status
            : 'DRAFT'
      })
      .eq('id', stayId);

    redirect('/admin/sejours');
  }

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-semibold text-slate-900">Tous les séjours</h1>
      <div className="overflow-hidden rounded-2xl border border-slate-200 bg-white">
        <div className="overflow-x-auto">
          <table className="min-w-[760px] w-full text-left text-sm">
            <thead className="bg-slate-50 text-xs uppercase text-slate-500">
              <tr>
                <th className="px-4 py-3">Séjour</th>
                <th className="px-4 py-3">Organisateur</th>
                <th className="px-4 py-3">Saison</th>
                <th className="px-4 py-3">Statut</th>
                <th className="px-4 py-3"></th>
              </tr>
            </thead>
            <tbody>
              {stays.map((stay) => (
                <tr key={stay.id} className="border-t border-slate-100">
                  <td className="px-4 py-3 font-medium text-slate-900">{stay.title}</td>
                  <td className="px-4 py-3 text-slate-600">
                    {organizersById.get(stay.organizer_id) ?? '-'}
                  </td>
                  <td className="px-4 py-3 text-slate-600">
                    {seasonsById.get(stay.season_id) ?? '-'}
                  </td>
                  <td className="px-4 py-3 text-slate-600">{stayStatusLabel(stay.status)}</td>
                  <td className="px-4 py-3 text-right">
                    <form action={updateStatus} className="flex items-center justify-end gap-2">
                      <input type="hidden" name="stayId" value={stay.id} />
                      <select
                        name="status"
                        defaultValue={stay.status}
                        className="rounded border border-slate-200 px-2 py-1 text-xs"
                      >
                        <option value="DRAFT">Brouillon</option>
                        <option value="PUBLISHED">Publié</option>
                        <option value="HIDDEN">Masqué</option>
                        <option value="ARCHIVED">Archivé</option>
                      </select>
                      <button className="rounded bg-emerald-600 px-2 py-1 text-xs font-semibold text-white">
                        OK
                      </button>
                      <Link
                        href={`/admin/sejours/${stay.id}`}
                        className="rounded border border-slate-200 px-2 py-1 text-xs font-semibold text-slate-700"
                      >
                        Editer
                      </Link>
                    </form>
                  </td>
                </tr>
              ))}
              {stays.length === 0 && (
                <tr>
                  <td className="px-4 py-6 text-slate-500" colSpan={5}>
                    {error?.message ? `Erreur: ${error.message}` : 'Aucun séjour.'}
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
