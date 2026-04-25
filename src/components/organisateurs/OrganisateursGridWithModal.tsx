import Link from 'next/link';
import Image from 'next/image';

type OrganizerCard = {
  id: string;
  name: string;
  slug: string;
  logoUrl?: string | null;
  creationYear?: number | null;
  ageMin?: number | null;
  ageMax?: number | null;
};

interface OrganisateursGridWithModalProps {
  organizers: OrganizerCard[];
}

export function OrganisateursGridWithModal({ organizers }: OrganisateursGridWithModalProps) {
  return (
    <>
      <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-4">
        {organizers.map((org) => (
          <Link
            key={org.slug}
            href={`/organisateurs/${org.slug}`}
            title={`Voir l’organisateur ${org.name}`}
            className="flex flex-col overflow-hidden rounded-xl border border-slate-200 bg-white shadow-md transition hover:shadow-lg focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-300 focus-visible:ring-offset-2"
          >
            <div className="flex min-h-[170px] flex-1 flex-col items-center justify-center px-4 py-8">
              {org.logoUrl ? (
                <Image
                  src={org.logoUrl}
                  alt={org.name}
                  width={280}
                  height={112}
                  className="max-h-28 w-auto object-contain"
                  unoptimized
                />
              ) : (
                <div className="flex h-16 w-full items-center justify-center rounded-lg bg-slate-100">
                  <span className="text-xs font-semibold uppercase text-slate-400">
                    {org.name.slice(0, 2)}
                  </span>
                </div>
              )}
            </div>
            <div className="flex min-h-[126px] flex-col border-t border-slate-100 px-4 py-4 transition-colors">
              <h3 className="text-center text-[21px] font-bold leading-[1.4] text-[#6DC7FE]">
                {org.name}
              </h3>
              <ul className="mt-3 space-y-1 text-center text-sm text-slate-500">
                <li>
                  <strong>Création :</strong> {org.creationYear ?? '-'}
                </li>
                <li>
                  <strong>Public :</strong>{' '}
                  {org.ageMin || org.ageMax
                    ? `${org.ageMin ?? '?'} - ${org.ageMax ?? '?'} ans`
                    : '-'}
                </li>
              </ul>
            </div>
            <div className="flex w-full items-center justify-center border-t border-slate-100 px-4 py-3 text-sm font-semibold tracking-wide text-brand-600">
              PLUS DE DÉTAILS
            </div>
          </Link>
        ))}
      </div>
    </>
  );
}
