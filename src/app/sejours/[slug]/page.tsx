import type { Metadata } from 'next';
import Link from 'next/link';
import { notFound } from 'next/navigation';
import { getStays } from '@/lib/stays';
import { FILTER_LABELS } from '@/lib/constants';

interface StayDetailPageProps {
  params: { slug: string };
}

export async function generateMetadata({ params }: StayDetailPageProps): Promise<Metadata> {
  const stays = await getStays();
  const stay = stays.find((item) => item.slug === params.slug);

  if (!stay) {
    return {
      title: 'Séjour introuvable | Resacolo'
    };
  }

  return {
    title: `${stay.title} | Resacolo`,
    description: stay.summary
  };
}

function formatLabel(group: keyof typeof FILTER_LABELS, value: string) {
  return FILTER_LABELS[group][value as keyof (typeof FILTER_LABELS)[typeof group]] ?? value;
}

export default async function StayDetailPage({ params }: StayDetailPageProps) {
  const stays = await getStays();
  const stay = stays.find((item) => item.slug === params.slug);

  if (!stay) {
    notFound();
  }

  return (
    <section className="mx-auto max-w-4xl space-y-8 px-6 py-12">
      <Link href="/sejours" className="text-sm text-brand-600">
        ← Retour aux séjours
      </Link>
      <header className="space-y-3">
        <p className="text-xs uppercase tracking-wide text-brand-600">{stay.organizer.name}</p>
        <h1 className="text-3xl font-semibold text-slate-900">{stay.title}</h1>
        <p className="text-base text-slate-600">{stay.summary}</p>
        <p className="text-sm text-slate-500">
          {stay.location} · {stay.duration} · {stay.ageRange}
        </p>
        <div className="flex flex-wrap gap-2">
          {stay.filters.categories.map((category) => (
            <span key={category} className="rounded-full bg-brand-50 px-3 py-1 text-xs font-medium text-brand-700">
              {formatLabel('categories', category)}
            </span>
          ))}
          {stay.filters.audiences.map((audience) => (
            <span key={audience} className="rounded-full bg-slate-100 px-3 py-1 text-xs font-medium text-slate-700">
              {formatLabel('audiences', audience)}
            </span>
          ))}
        </div>
      </header>
      <article className="space-y-6 rounded-xl border border-slate-200 bg-white p-8 shadow-sm">
        <section className="space-y-2">
          <h2 className="text-xl font-semibold text-slate-900">Programme détaillé</h2>
          <p className="whitespace-pre-line text-sm leading-relaxed text-slate-600">{stay.description}</p>
        </section>
        {stay.highlights.length > 0 && (
          <section className="space-y-2">
            <h2 className="text-xl font-semibold text-slate-900">Moments forts</h2>
            <ul className="list-disc space-y-1 pl-6 text-sm text-slate-600">
              {stay.highlights.map((highlight) => (
                <li key={highlight}>{highlight}</li>
              ))}
            </ul>
          </section>
        )}
        <section className="grid gap-3 text-sm text-slate-600 md:grid-cols-2">
          <p>
            <span className="font-semibold text-slate-800">Périodes :</span> {stay.period.map((period) => formatLabel('periods', period)).join(', ')}
          </p>
          <p>
            <span className="font-semibold text-slate-800">Transport :</span> {stay.filters.transport.map((value) => formatLabel('transport', value)).join(', ')}
          </p>
          <p>
            <span className="font-semibold text-slate-800">Tarif à partir de :</span> {stay.priceFrom ? `${stay.priceFrom} €` : 'sur demande'}
          </p>
          <p>
            <span className="font-semibold text-slate-800">Dernière mise à jour :</span> {new Date(stay.updatedAt).toLocaleDateString('fr-FR')}
          </p>
        </section>
        <div className="rounded-lg bg-brand-50 p-4 text-sm text-brand-700">
          <p className="font-semibold">Envie d’en savoir plus ?</p>
          <p className="mt-1">
            Retrouvez les informations officielles sur le site de l’organisateur et contactez directement les équipes.
          </p>
          <a
            href={stay.sourceUrl ?? stay.organizer.website}
            target="_blank"
            rel="noreferrer"
            className="mt-2 inline-flex text-xs font-medium text-brand-700"
          >
            Accéder au site de {stay.organizer.name}
          </a>
        </div>
      </article>
    </section>
  );
}
