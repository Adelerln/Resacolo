import { Suspense } from 'react';
import type { Metadata } from 'next';
import { StayExplorer } from '@/components/sejours/StayExplorer';
import { getStays } from '@/lib/stays';

export const metadata: Metadata = {
  title: 'Séjours | Plateforme des colonies de vacances',
  description:
    'Explorez toutes les colonies de vacances proposées par les organisateurs partenaires avec filtres intelligents et fiches détaillées.'
};

export default async function SejoursPage() {
  const stays = await getStays();

  return (
    <section className="mx-auto max-w-6xl space-y-8 px-6 py-12">
      <div className="space-y-3">
        <h1 className="text-3xl font-semibold text-slate-900">Séjours</h1>
        <p className="text-base text-slate-600">
          Filtrez les colonies de vacances par âge, thématique, période ou budget. Les fiches sont générées
          automatiquement depuis les sites des organisateurs grâce à l’API OpenAI.
        </p>
      </div>
      <Suspense fallback={<p>Chargement des séjours...</p>}>
        <StayExplorer stays={stays} />
      </Suspense>
    </section>
  );
}
