import { redirect } from 'next/navigation';
import { requireRole } from '@/lib/auth/require';
import { mockOrganizerTenant, mockSeasons, mockStays } from '@/lib/mocks';
import { stayStatusLabel } from '@/lib/ui/labels';

export default async function AdminStaysPage() {
  requireRole('ADMIN');
  const stays = mockStays;

  async function updateStatus(formData: FormData) {
    'use server';
    const stayId = String(formData.get('stayId') ?? '');
    const status = String(formData.get('status') ?? 'DRAFT');
    if (!stayId) return;
    redirect('/admin/sejours');
  }

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-semibold text-slate-900">Tous les séjours</h1>
      <div className="overflow-hidden rounded-2xl border border-slate-200 bg-white">
        <table className="w-full text-left text-sm">
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
                <td className="px-4 py-3 text-slate-600">{mockOrganizerTenant.name}</td>
                <td className="px-4 py-3 text-slate-600">
                  {mockSeasons.find((s) => s.id === stay.seasonId)?.name}
                </td>
                <td className="px-4 py-3 text-slate-600">{stayStatusLabel(stay.status)}</td>
                <td className="px-4 py-3 text-right">
                  <form action={updateStatus} className="flex items-center justify-end gap-2">
                    <input type="hidden" name="stayId" value={stay.id} />
                    <select name="status" defaultValue={stay.status} className="rounded border border-slate-200 px-2 py-1 text-xs">
                      <option value="DRAFT">Brouillon</option>
                      <option value="PENDING">En validation</option>
                      <option value="PUBLISHED">Publié</option>
                      <option value="ARCHIVED">Archivé</option>
                    </select>
                    <button className="rounded bg-emerald-600 px-2 py-1 text-xs font-semibold text-white">
                      OK
                    </button>
                  </form>
                </td>
              </tr>
            ))}
            {stays.length === 0 && (
              <tr>
                <td className="px-4 py-6 text-slate-500" colSpan={5}>
                  Aucun séjour.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
