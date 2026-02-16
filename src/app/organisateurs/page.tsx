import { Badge, Calendar, User } from 'lucide-react';
import { OrganisateursGridWithModal } from '@/components/organisateurs/OrganisateursGridWithModal';

export const metadata = {
  title: 'Organisateurs | ResaColo',
  description:
    'Découvrez les organisateurs de colonies de vacances du collectif ResaColo.'
};

interface PageProps {
  searchParams: Promise<{ organisateur?: string }>;
}

export default async function OrganisateursPage({ searchParams }: PageProps) {
  const { organisateur } = await searchParams;

  return (
    <div className="min-h-screen bg-white">
      {/* Section A: Intro Header */}
      <section className="relative mx-auto max-w-6xl px-4 py-16 sm:px-6 md:py-20">
        <div className="grid gap-10 lg:grid-cols-2 lg:items-center lg:gap-16">
          <div className="space-y-6">
            <p className="text-xs font-semibold uppercase tracking-widest text-slate-400">
              À propos
            </p>
            <h1 className="font-display text-3xl font-bold text-slate-900 sm:text-4xl lg:text-5xl">
              Les <span className="text-[#F97316]">organisateurs</span> de séjours
            </h1>
            <p className="max-w-xl text-slate-600 leading-relaxed">
              Initiateurs de ce projet ambitieux, les producteurs de séjours ont à cœur de valoriser leurs compétences
              métiers, de promouvoir leurs valeurs et objectifs éducatifs et de faciliter l&apos;accès à une offre
              collective riche et variée de colonie de vacances.
            </p>
          </div>
          <div className="relative hidden lg:block">
            <div className="flex flex-wrap gap-4 justify-end">
              <div className="rounded-2xl bg-[#F97316]/15 p-5 text-[#F97316] shadow-lg">
                <Badge className="h-10 w-10" />
              </div>
              <div className="rounded-2xl bg-[#F97316]/20 p-5 text-[#F97316] shadow-lg mt-8">
                <User className="h-10 w-10" />
              </div>
              <div className="rounded-2xl bg-[#F97316]/15 p-5 text-[#F97316] shadow-lg">
                <Calendar className="h-10 w-10" />
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Section B: Organizers Grid */}
      <section className="mx-auto max-w-6xl px-4 pb-20 sm:px-6">
        <div className="mb-10 text-center">
          <h2 className="font-display text-2xl font-bold text-slate-900 sm:text-3xl">
            Ils composent le catalogue <span className="text-[#3B82F6]">RESACOLO</span>
          </h2>
          <p className="mx-auto mt-4 max-w-2xl text-slate-600">
            Retrouvez les caractéristiques des organisateurs de colonies de vacances référencés sur la plateforme, tous
            membres du collectif <span className="text-[#F97316]">ResaColo</span>.
          </p>
        </div>

        <OrganisateursGridWithModal initialSlug={organisateur ?? null} />
      </section>
    </div>
  );
}
