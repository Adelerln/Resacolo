import Link from 'next/link';
import { requireRole } from '@/lib/auth/require';
import { stayStatusLabel } from '@/lib/ui/labels';
import { getServerSupabaseClient } from '@/lib/supabase/server';

export default async function OrganizerStaysPage() {
  const session = requireRole('ORGANISATEUR');
  const supabase = getServerSupabaseClient();

  let organizerId = session.tenantId ?? null;
  if (!organizerId) {
    const { data: fallbackOrganizer } = await supabase
      .from('organizers')
      .select('id')
      .order('created_at', { ascending: true })
      .limit(1)
      .maybeSingle();
    organizerId = fallbackOrganizer?.id ?? null;
  }

  const { data: stays, error: staysError } = organizerId
    ? await supabase
        .from('stays')
        .select('id,title,status,season_id,created_at')
        .eq('organizer_id', organizerId)
        .order('created_at', { ascending: false })
    : { data: [], error: null };
  const safeStays = stays ?? [];

  const { data: seasons } = await supabase
    .from('seasons')
    .select('id,name');
  const seasonsById = new Map((seasons ?? []).map((season) => [season.id, season]));
  const loadError = staysError?.message ?? null;

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-semibold text-slate-900">Séjours</h1>
          <p className="text-sm text-slate-600">Liste des séjours déclarés.</p>
        </div>
        <Link
          href="/organisme/stays/new"
          className="rounded-lg bg-emerald-600 px-4 py-2 text-sm font-semibold text-white"
        >
          Nouveau séjour
        </Link>
      </div>

      <div className="overflow-hidden rounded-2xl border border-slate-200 bg-white">
        <table className="w-full text-left text-sm">
          <thead className="bg-slate-50 text-xs uppercase text-slate-500">
            <tr>
              <th className="px-4 py-3">Séjour</th>
              <th className="px-4 py-3">Saison</th>
              <th className="px-4 py-3">Statut</th>
              <th className="px-4 py-3">Qualité</th>
              <th className="px-4 py-3"></th>
            </tr>
          </thead>
          <tbody>
            {safeStays.map((stay) => (
              <tr key={stay.id} className="border-t border-slate-100">
                <td className="px-4 py-3 font-medium text-slate-900">{stay.title}</td>
                <td className="px-4 py-3 text-slate-600">
                  {seasonsById.get(stay.season_id)?.name ?? '-'}
                </td>
                <td className="px-4 py-3 text-slate-600">{stayStatusLabel(stay.status)}</td>
                <td className="px-4 py-3 text-slate-600">-</td>
                <td className="px-4 py-3 text-right">
                  <div className="flex items-center justify-end gap-3">
                    <Link href={`/organisme/stays/${stay.id}`} className="text-emerald-600">
                      Ouvrir
                    </Link>
                    <Link
                      href={`/organisme/stays/${stay.id}`}
                      className="rounded-lg border border-emerald-200 px-3 py-1 text-xs font-semibold text-emerald-700"
                    >
                      Éditer
                    </Link>
                  </div>
                </td>
              </tr>
            ))}
            {safeStays.length === 0 && (
              <tr>
                <td className="px-4 py-6 text-slate-500" colSpan={5}>
                  {loadError ? `Erreur: ${loadError}` : 'Aucun séjour pour le moment.'}
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
