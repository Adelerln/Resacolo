const resources = [
  {
    title: 'Kit communication familles',
    description: 'Supports prêts à diffuser pour promouvoir les colonies de vacances auprès des familles.'
  },
  {
    title: 'Guide collectivités',
    description: 'Tout savoir sur l’organisation d’un séjour collectif avec les organisateurs partenaires.'
  },
  {
    title: 'Boîte à outils organisateurs',
    description: 'Outils mutualisés pour optimiser la logistique, le recrutement et la conformité réglementaire.'
  }
];

export default function RessourcesPage() {
  return (
    <section className="mx-auto max-w-4xl space-y-8 px-6 py-16">
      <div className="space-y-4">
        <h1 className="text-3xl font-semibold text-slate-900">Ressources partagées</h1>
        <p className="text-lg text-slate-600">
          Le collectif met à disposition des ressources mutualisées pour soutenir les équipes de terrain, les
          collectivités et les familles.
        </p>
      </div>
      <div className="grid gap-6 md:grid-cols-3">
        {resources.map((resource) => (
          <article key={resource.title} className="rounded-xl border border-slate-200 bg-white p-6 shadow-sm">
            <h2 className="text-lg font-semibold text-slate-800">{resource.title}</h2>
            <p className="mt-2 text-sm text-slate-600">{resource.description}</p>
          </article>
        ))}
      </div>
    </section>
  );
}
