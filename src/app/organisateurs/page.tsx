import Link from 'next/link';

const organizers = [
  { name: 'Aventures Vacances Énergie', url: 'https://www.aventures-vacances-energie.com/' },
  { name: 'CEI', url: 'https://www.cei-voyage.fr/' },
  { name: 'CESL', url: 'https://www.cesl.fr/' },
  { name: "Chic Planet' Colos", url: 'https://colos.chic-planet.fr/' },
  { name: 'Eole Loisirs', url: 'https://www.eole-loisirs.com/' },
  { name: 'Equifun', url: 'https://equifun.net/' },
  { name: 'Les Colos du Bonheur', url: 'https://www.colosdubonheur.fr/' },
  { name: 'Les Vacances du Zèbre', url: 'https://www.le-zebre.com/' },
  { name: 'Planète Aventures', url: 'https://www.planeteaventures.fr/' },
  { name: 'Poneys des 4 Saisons', url: 'https://www.poneys-des-quatre-saisons.fr/' },
  { name: 'Thalie', url: 'https://www.thalie.eu/' },
  { name: 'Zigo Tours', url: 'https://www.zigotours.com/' }
];

export default function OrganisateursPage() {
  return (
    <section className="mx-auto max-w-4xl space-y-8 px-6 py-16">
      <div className="space-y-4">
        <h1 className="text-3xl font-semibold text-slate-900">Nos organisateurs partenaires</h1>
        <p className="text-lg text-slate-600">
          Résacolo fédère les professionnels engagés de Résocolo. Chaque structure dispose d’un espace dédié et
          d’une synchronisation automatique de ses séjours.
        </p>
      </div>
      <ul className="grid gap-4 md:grid-cols-2">
        {organizers.map((organizer) => (
          <li key={organizer.name} className="rounded-xl border border-slate-200 bg-white p-6 shadow-sm">
            <p className="font-semibold text-slate-800">{organizer.name}</p>
            <Link href={organizer.url} className="mt-2 inline-flex text-sm text-brand-600" target="_blank">
              {organizer.url}
            </Link>
          </li>
        ))}
      </ul>
    </section>
  );
}
