const commitments = [
  {
    title: 'Accès pour tous',
    description:
      'Nous défendons des séjours accessibles, solidaires et adaptés aux besoins éducatifs de chaque enfant.'
  },
  {
    title: 'Qualité pédagogique',
    description:
      'Chaque organisateur s’engage sur un projet éducatif fort, évalué et partagé au sein du réseau Résocolo.'
  },
  {
    title: 'Innovation collective',
    description:
      'Resacolo favorise les synergies entre organisateurs pour mutualiser outils, contenus et bonnes pratiques.'
  }
];

export default function AssociationPage() {
  return (
    <section className="mx-auto max-w-4xl space-y-8 px-6 py-16">
      <div className="space-y-4">
        <h1 className="text-3xl font-semibold text-slate-900">L’association Résocolo</h1>
        <p className="text-lg text-slate-600">
          Résocolo est une association de professionnels de l’éducation populaire et du tourisme social. Ensemble,
          nous mutualisons nos forces pour rendre les colonies de vacances plus visibles et plus simples d’accès.
        </p>
      </div>
      <div className="grid gap-6 md:grid-cols-3">
        {commitments.map((item) => (
          <article key={item.title} className="rounded-xl border border-slate-200 bg-white p-6 shadow-sm">
            <h2 className="text-lg font-semibold text-slate-800">{item.title}</h2>
            <p className="mt-2 text-sm text-slate-600">{item.description}</p>
          </article>
        ))}
      </div>
      <p className="text-sm text-slate-500">
        Pour rejoindre l’association ou proposer un partenariat, rendez-vous sur la page contact.
      </p>
    </section>
  );
}
