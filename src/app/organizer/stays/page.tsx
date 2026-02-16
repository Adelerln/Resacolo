import Link from 'next/link';
import { requireRole } from '@/lib/auth/require';
import { mockSeasons, mockStays } from '@/lib/mocks';

export default async function OrganizerStaysPage() {
  const session = requireRole('ORGANISATEUR');
  const useMock = process.env.MOCK_UI === '1';

  const stays = useMock ? mockStays : [];
  const seasonsById = new Map(mockSeasons.map((season) => [season.id, season]));

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-semibold text-slate-900">Sejours</h1>
          <p className="text-sm text-slate-600">Liste des sejours declares.</p>
        </div>
        <Link
          href="/organizer/stays/new"
          className="rounded-lg bg-emerald-600 px-4 py-2 text-sm font-semibold text-white"
        >
          Nouveau sejour
        </Link>
      </div>

      <div className="overflow-hidden rounded-2xl border border-slate-200 bg-white">
        <table className="w-full text-left text-sm">
          <thead className="bg-slate-50 text-xs uppercase text-slate-500">
            <tr>
              <th className="px-4 py-3">Sejour</th>
              <th className="px-4 py-3">Saison</th>
              <th className="px-4 py-3">Statut</th>
              <th className="px-4 py-3">Qualite</th>
              <th className="px-4 py-3"></th>
            </tr>
          </thead>
          <tbody>
            {stays.map((stay) => (
              <tr key={stay.id} className="border-t border-slate-100">
                <td className="px-4 py-3 font-medium text-slate-900">{stay.title}</td>
                <td className="px-4 py-3 text-slate-600">
                  {useMock ? seasonsById.get(stay.seasonId)?.name : '-'}
                </td>
                <td className="px-4 py-3 text-slate-600">{stay.status}</td>
                <td className="px-4 py-3 text-slate-600">{stay.qualityScore}%</td>
                <td className="px-4 py-3 text-right">
                  <Link href={`/organizer/stays/${stay.id}`} className="text-emerald-600">
                    Ouvrir
                  </Link>
                </td>
              </tr>
            ))}
            {stays.length === 0 && (
              <tr>
                <td className="px-4 py-6 text-slate-500" colSpan={5}>
                  Aucun sejour pour le moment.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
