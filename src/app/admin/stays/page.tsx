import { redirect } from 'next/navigation';
import { prisma } from '@/lib/db';
import { requireRole } from '@/lib/auth/require';

export default async function AdminStaysPage() {
  requireRole('ADMIN');
  const stays = await prisma.stay.findMany({
    include: { organizerTenant: true, season: true },
    orderBy: { createdAt: 'desc' }
  });

  async function updateStatus(formData: FormData) {
    'use server';
    const stayId = String(formData.get('stayId') ?? '');
    const status = String(formData.get('status') ?? 'DRAFT');
    if (!stayId) return;
    await prisma.stay.update({ where: { id: stayId }, data: { status } });
    redirect('/admin/stays');
  }

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-semibold text-slate-900">Tous les sejours</h1>
      <div className="overflow-hidden rounded-2xl border border-slate-200 bg-white">
        <table className="w-full text-left text-sm">
          <thead className="bg-slate-50 text-xs uppercase text-slate-500">
            <tr>
              <th className="px-4 py-3">Sejour</th>
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
                <td className="px-4 py-3 text-slate-600">{stay.organizerTenant?.name}</td>
                <td className="px-4 py-3 text-slate-600">{stay.season?.name}</td>
                <td className="px-4 py-3 text-slate-600">{stay.status}</td>
                <td className="px-4 py-3 text-right">
                  <form action={updateStatus} className="flex items-center justify-end gap-2">
                    <input type="hidden" name="stayId" value={stay.id} />
                    <select name="status" defaultValue={stay.status} className="rounded border border-slate-200 px-2 py-1 text-xs">
                      <option value="DRAFT">DRAFT</option>
                      <option value="PENDING">PENDING</option>
                      <option value="PUBLISHED">PUBLISHED</option>
                      <option value="ARCHIVED">ARCHIVED</option>
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
                  Aucun sejour.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
