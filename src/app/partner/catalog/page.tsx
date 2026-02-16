import { redirect } from 'next/navigation';
import { prisma } from '@/lib/db';
import { requireRole } from '@/lib/auth/require';
import { AssortmentService } from '@/lib/domain/services/assortmentService';
import { RequestPipelineService } from '@/lib/domain/services/requestPipelineService';

export default async function PartnerCatalogPage({ searchParams }: { searchParams?: { q?: string } }) {
  const session = requireRole('PARTENAIRE');
  const partnerTenantId = session.tenantId;

  const season = await prisma.season.findFirst({
    orderBy: { startsAt: 'desc' }
  });

  if (!partnerTenantId || !season) {
    return (
      <div className="space-y-4">
        <h1 className="text-2xl font-semibold text-slate-900">Catalogue</h1>
        <p className="text-sm text-slate-600">Aucun catalogue disponible.</p>
      </div>
    );
  }

  const q = (searchParams?.q ?? '').toLowerCase();
  const assortmentService = new AssortmentService();
  const stays = await assortmentService.listCatalogStays(partnerTenantId, season.id);
  const filtered = q ? stays.filter((stay) => stay.title.toLowerCase().includes(q)) : stays;

  const sessions = await prisma.staySession.findMany({
    where: { stayId: { in: filtered.map((s) => s.id) } },
    orderBy: { startDate: 'asc' }
  });

  async function createRequest(formData: FormData) {
    'use server';
    const stayId = String(formData.get('stayId') ?? '');
    const sessionId = String(formData.get('sessionId') ?? '');
    if (!stayId || !sessionId) return;

    const pipeline = new RequestPipelineService();
    const stages = await pipeline.listStages('GLOBAL');
    const currentStageId = stages[0]?.id;
    if (!currentStageId) return;

    await prisma.$transaction(async (tx) => {
      const request = await tx.request.create({
        data: {
          stayId,
          sessionId,
          seasonId: season.id,
          partnerTenantId,
          currentStageId
        }
      });

      await tx.requestEvent.create({
        data: {
          requestId: request.id,
          seasonId: season.id,
          eventType: 'CREATED',
          newStageId: currentStageId
        }
      });
    });

    redirect('/partner/requests');
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-semibold text-slate-900">Catalogue</h1>
          <p className="text-sm text-slate-600">Saison {season.name}</p>
        </div>
        <form className="flex items-center gap-2">
          <input
            name="q"
            defaultValue={searchParams?.q ?? ''}
            placeholder="Rechercher"
            className="rounded-lg border border-slate-200 px-3 py-2 text-sm"
          />
          <button className="rounded-lg bg-slate-900 px-3 py-2 text-sm font-semibold text-white">
            Filtrer
          </button>
        </form>
      </div>

      <div className="space-y-4">
        {filtered.map((stay) => {
          const staySessions = sessions.filter((s) => s.stayId === stay.id);
          return (
            <div key={stay.id} className="rounded-2xl border border-slate-200 bg-white p-6">
              <div className="flex items-center justify-between">
                <div>
                  <h2 className="text-lg font-semibold text-slate-900">{stay.title}</h2>
                  <p className="text-sm text-slate-600">{stay.location}</p>
                </div>
                <span className="text-xs font-semibold text-slate-500">{stay.status}</span>
              </div>
              <div className="mt-4 space-y-2 text-sm text-slate-600">
                {staySessions.map((sessionItem) => (
                  <div key={sessionItem.id} className="flex items-center justify-between">
                    <div>
                      {sessionItem.startDate.toLocaleDateString('fr-FR')} -{' '}
                      {sessionItem.endDate.toLocaleDateString('fr-FR')}
                    </div>
                    <form action={createRequest}>
                      <input type="hidden" name="stayId" value={stay.id} />
                      <input type="hidden" name="sessionId" value={sessionItem.id} />
                      <button className="rounded-lg bg-emerald-600 px-3 py-1 text-xs font-semibold text-white">
                        Faire une demande
                      </button>
                    </form>
                  </div>
                ))}
                {staySessions.length === 0 && <p>Aucune session disponible.</p>}
              </div>
            </div>
          );
        })}
        {filtered.length === 0 && (
          <div className="rounded-2xl border border-dashed border-slate-300 p-6 text-sm text-slate-500">
            Aucun sejour dans le catalogue.
          </div>
        )}
      </div>
    </div>
  );
}
