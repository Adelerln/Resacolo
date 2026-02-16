import Link from 'next/link';
import { ChevronLeft } from 'lucide-react';

export const metadata = {
  title: 'FAQ | ResaColo',
  description: 'Questions fréquentes sur ResaColo et les colonies de vacances.'
};

export default function FaqPage() {
  return (
    <div className="bg-[#FFFFFF]">
      <div className="mx-auto max-w-3xl px-4 py-12 sm:px-6">
        <Link
          href="/"
          className="mb-8 inline-flex items-center gap-1 text-sm font-medium text-[#3B82F6] hover:text-[#2563eb]"
        >
          <ChevronLeft className="h-4 w-4" />
          Retour à l&apos;accueil
        </Link>
        <h1 className="font-display text-3xl font-semibold text-slate-900 md:text-4xl">
          Questions fréquentes
        </h1>
        <p className="mt-4 text-slate-600">
          Retrouvez les réponses aux questions les plus posées sur ResaColo et le déroulement des réservations.
        </p>
        <div className="mt-12 space-y-8">
          <section>
            <h2 className="text-lg font-semibold text-slate-900">Comment réserver un séjour ?</h2>
            <p className="mt-2 text-slate-600">
              Choisissez la destination, les dates et l&apos;âge du participant via la recherche sur la page
              d&apos;accueil, puis parcourez les séjours proposés. Une fois votre séjour choisi, suivez les étapes
              d&apos;inscription et l&apos;organisateur vous recontactera pour finaliser la réservation.
            </p>
          </section>
          <section>
            <h2 className="text-lg font-semibold text-slate-900">Comment financer le séjour ?</h2>
            <p className="mt-2 text-slate-600">
              Plusieurs aides existent : employeur ou CSE, CAF, mairie, JPA, chèques-vacances ANCV… Consultez la
              section « Des solutions pour financer votre séjour » sur la page d&apos;accueil pour en savoir plus.
            </p>
          </section>
          <section>
            <h2 className="text-lg font-semibold text-slate-900">Qui sont les organisateurs ResaColo ?</h2>
            <p className="mt-2 text-slate-600">
              ResaColo est un collectif d&apos;organisateurs de colonies de vacances. Le site est conçu par et pour
              ces professionnels, afin de proposer une réservation en circuit court sans intermédiaire.
            </p>
          </section>
        </div>
      </div>
    </div>
  );
}
