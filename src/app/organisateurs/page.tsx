import Image from 'next/image';
import { OrganisateursGridWithModal } from '@/components/organisateurs/OrganisateursGridWithModal';
import { getServerSupabaseClient } from '@/lib/supabase/server';
import { slugify } from '@/lib/utils';

const ORIGIN_GRAY = '#505050';

export const dynamic = 'force-dynamic';
export const revalidate = 0;

export const metadata = {
  title: 'Organisateurs | ResaColo',
  description:
    'Découvrez les organisateurs de colonies de vacances du collectif ResaColo.'
};

export default async function OrganisateursPage() {
  const supabase = getServerSupabaseClient();
  const { data: organizers } = await supabase
    .from('organizers')
    .select('id,name,slug,logo_path,founded_year,age_min,age_max')
    .order('name', { ascending: true });

  const formatted = await Promise.all(
    (organizers ?? []).map(async (org) => {
      const logoUrl = org.logo_path
        ? (await supabase.storage
            .from('organizer-logo')
            .createSignedUrl(org.logo_path, 60 * 60)).data?.signedUrl ?? null
        : null;
      return {
        id: org.id,
        name: org.name,
        slug: org.slug ?? slugify(org.name),
        logoUrl,
        creationYear: org.founded_year,
        ageMin: org.age_min,
        ageMax: org.age_max
      };
    })
  );

  return (
    <div className="min-h-screen bg-white">
      {/* Section A: Intro Header */}
      <section className="relative bg-[#f8f8f8]">
        <div className="section-container pb-16 pt-10 md:pb-20 md:pt-12">
        <div className="grid gap-10 lg:grid-cols-2 lg:items-center lg:gap-16">
          <div className="max-w-2xl text-left">
            <p className="text-xs font-semibold uppercase tracking-widest text-slate-400">
              À propos
            </p>
            <h1
              className="mt-3 font-display text-3xl font-bold leading-[1.15] sm:text-4xl sm:leading-[1.17] lg:text-[3.25rem] lg:leading-[1.2]"
              style={{ color: ORIGIN_GRAY }}
            >
              Les <span className="text-accent-500">organisateurs</span> de séjours
            </h1>
            <p className="mt-4 max-w-xl font-medium leading-relaxed text-slate-600">
              Initiateurs de ce projet ambitieux, les producteurs de séjours ont à cœur de valoriser leurs compétences
              métiers, de promouvoir leurs valeurs et objectifs éducatifs et de faciliter l&apos;accès à une offre
              collective riche et variée de colonie de vacances.
            </p>
          </div>
          <div className="relative hidden lg:flex lg:justify-end">
            <div className="w-full max-w-[31rem]">
              <Image
                src="/image/organisateurs/orga.gif"
                alt="Animation organisateurs"
                width={1200}
                height={900}
                unoptimized
                className="h-auto w-full object-contain"
                sizes="(max-width: 1024px) 100vw, 31rem"
              />
            </div>
          </div>
        </div>
        </div>
      </section>

      {/* Section B: Organizers Grid */}
      <section className="section-container pt-14 pb-20 md:pt-16">
        <div className="mb-10 text-center">
          <h2 className="font-display text-2xl font-bold sm:text-3xl" style={{ color: ORIGIN_GRAY }}>
            Ils composent le catalogue <span className="text-brand-600">RESACOLO</span>
          </h2>
          <p className="mx-auto mt-4 max-w-2xl text-slate-600">
            Retrouvez les caractéristiques des organisateurs de colonies de vacances référencés sur la plateforme.
          </p>
        </div>

        <OrganisateursGridWithModal organizers={formatted} />
      </section>
    </div>
  );
}
