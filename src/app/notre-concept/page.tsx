import Image from 'next/image';
import { PourquoiChoisirTabs } from '@/components/concept/PourquoiChoisirTabs';

const BLUE = '#52B0EA';
const ORIGIN_BLUE = '#37B5F5';
const ORANGE = '#FA8500';
const ORIGIN_GRAY = '#505050';

const strengths = [
  {
    iconSrc: '/image/concept/pictos_concept/projetambitieux.png',
    title: 'Projet ambitieux',
    caption: 'porté par un collectif d’organisateurs qui conçoivent et produisent leurs séjours'
  },
  {
    iconSrc: '/image/concept/pictos_concept/destination.png',
    title: 'Destinations multiples',
    caption: 'de la colo de proximité aux contrées les plus éloignées, nous couvrons la planète'
  },
  {
    iconSrc: '/image/concept/pictos_concept/plateforme.png',
    title: 'Plateforme mutualiste',
    caption: 'élaborée par des opérateurs reconnus, aux statuts et structures diversifiés'
  },
  {
    iconSrc: '/image/concept/pictos_concept/demarchequalitative.png',
    title: 'Démarche qualitative',
    caption: 'une offre plurielle au service des jeunes et au prix le plus juste'
  },
  {
    iconSrc: '/image/concept/pictos_concept/ancrage.png',
    title: 'Ancrage territorial',
    caption: 'reflet du pluralisme de membres basés sur tout le territoire'
  },
  {
    iconSrc: '/image/concept/pictos_concept/diversite.png',
    title: 'Diversité de l’offre',
    caption: 'variété des environnements, des prestations ou des activités, des modes d’hébergements'
  }
];

export const metadata = {
  title: 'Notre Concept | ResaColo',
  description:
    'Découvrez l’origine, les valeurs et les garanties de la plateforme ResaColo.'
};

export default function NotreConceptPage() {
  return (
    <div className="min-h-screen bg-white text-slate-900">
      <section className="bg-white py-16 md:py-20">
        <div className="section-container grid gap-12 md:grid-cols-2 md:items-center">
          <div>
            <p className="text-xs font-extrabold uppercase tracking-widest text-slate-500">
              À propos
            </p>
            <h1 className="mt-4 font-display text-3xl font-bold text-slate-900 sm:text-4xl lg:text-5xl">
              <span style={{ color: ORIGIN_GRAY }}>Notre</span>{' '}
              <span style={{ color: ORANGE }}>concept</span>
            </h1>
            <p className="mt-6 max-w-xl font-medium leading-relaxed text-slate-600">
              Né d’une réflexion collective sur la protection et la valorisation d’un savoir-faire,
              RESACOLO est devenu le projet mutualiste de membres de l’association ResoColo.
            </p>
          </div>

          <div className="flex items-center justify-center md:justify-end">
            <div className="w-full max-w-[32rem]">
              <Image
                src="/image/concept/gif_concept/Composition 1_2.gif"
                alt="Animation Resacolo"
                width={1920}
                height={1080}
                priority
                unoptimized
                className="h-auto w-full object-contain"
                sizes="(max-width: 768px) 100vw, 32rem"
              />
            </div>
          </div>
        </div>
      </section>

      <section className="bg-slate-100 py-16 md:py-24">
        <div className="section-container grid gap-14 xl:grid-cols-[minmax(300px,0.95fr)_minmax(0,1.05fr)] xl:items-start xl:gap-20">
          <div>
            <h2
              className="text-left font-display text-3xl font-bold leading-[1.04] sm:text-4xl lg:text-5xl"
              style={{ color: ORIGIN_GRAY }}
            >
              <span className="block" style={{ color: ORIGIN_BLUE }}>
                À l’origine,
              </span>
              <span className="mt-2 block">un projet collectif.</span>
            </h2>
            <div className="mt-12 flex items-center justify-center lg:justify-start">
              <div className="w-full max-w-[46rem]">
                <Image
                  src="/image/concept/images_concept/reso-resacolo.png"
                  alt="ResoColo x Resacolo"
                  width={1232}
                  height={358}
                  className="h-auto w-full object-contain"
                  sizes="(max-width: 1024px) 88vw, 46rem"
                />
              </div>
            </div>
          </div>

          <div className="flex h-full flex-col lg:min-h-[32rem]">
            <div className="space-y-6 font-medium leading-relaxed text-slate-600">
              <p>
                <strong className="font-semibold text-slate-800">RESACOLO</strong> est le fruit de
                l’imagination de professionnels de l’Enfance-Jeunesse, spécialisés dans
                l’organisation de colonies de vacances. De statuts diversifiés, tous sont adhérents
                de l’association ResoColo et investis d’une même mission et d’une même passion :
                promouvoir le départ en vacances du plus grand nombre d’enfants et participer tant à
                leur émancipation qu’à leur épanouissement. Au gré de réflexions pluralistes, l’idée
                de la 1ère plateforme mutualiste créée par des opérateurs qui conçoivent et
                produisent leurs séjours était née.
              </p>
              <p>
                La vocation de <strong className="font-semibold text-slate-800">RESACOLO</strong>{' '}
                n’est aucunement de générer des profits. Notre intérêt premier est de faciliter
                l’accès à une offre centralisée, riche et variée de séjours à destination des
                enfants, adolescents et jeunes adultes. Cette programmation est enrichie par chaque
                organisateur, sans intermédiaire ni surcoût.
              </p>
            </div>
            <div className="mt-10 flex justify-start lg:mt-auto lg:justify-end">
              <a
                href="https://resocolo.org"
                target="_blank"
                rel="noreferrer"
                className="inline-flex items-center rounded-[1.35rem] px-7 py-4 text-base font-bold uppercase tracking-[0.12em] text-white shadow-[0_16px_30px_-18px_rgba(250,133,0,0.9)] transition hover:opacity-95"
                style={{ backgroundColor: ORANGE }}
              >
                RESOCOLO.ORG
              </a>
            </div>
          </div>
        </div>
      </section>

      <section className="section-container py-16 md:py-20">
        <div className="grid gap-10 xl:grid-cols-[max-content_minmax(0,1fr)] xl:items-start xl:gap-10">
          <div className="order-2 grid grid-cols-1 gap-3 sm:grid-cols-2 sm:gap-4 lg:gap-5 xl:order-1 xl:justify-items-start xl:gap-x-3 xl:gap-y-5">
            {strengths.map((item) => (
              <article
                key={item.title}
                className="group flex min-h-[16.5rem] w-full max-w-none flex-col items-center rounded-[28px] border border-slate-200 bg-white px-5 py-6 shadow-[0_18px_40px_-28px_rgba(15,23,42,0.35)] transition-transform duration-300 hover:-translate-y-1 xl:max-w-[15.5rem]"
              >
                <div className="mx-auto mb-4 flex h-20 w-20 items-center justify-center rounded-2xl">
                  <Image
                    src={item.iconSrc}
                    alt=""
                    width={84}
                    height={84}
                    className="h-[4.75rem] w-[4.75rem] object-contain"
                  />
                </div>
                <h3
                  className="text-center font-display text-xl font-bold leading-snug"
                  style={{ color: ORIGIN_GRAY }}
                >
                  {item.title}
                </h3>
                <p
                  className="mt-3 text-center text-[11px] font-medium leading-5 sm:text-xs"
                  style={{ color: ORIGIN_GRAY }}
                >
                  {item.caption}
                </p>
              </article>
            ))}
          </div>

          <div className="order-1 xl:order-2 xl:sticky xl:top-24 xl:self-start">
            <h2 className="font-display text-3xl font-[800] leading-[1.04] sm:text-4xl lg:text-5xl">
              <span style={{ color: ORIGIN_GRAY }}>Nos </span>
              <span style={{ color: BLUE }}>6 points forts</span>
            </h2>
            <blockquote
              className="mt-8 border-l-4 pl-6 text-lg italic leading-relaxed"
              style={{ borderColor: BLUE, color: ORIGIN_GRAY }}
            >
              « Concevoir des séjours, c’est notre métier et notre passion. »
            </blockquote>
          </div>
        </div>
      </section>

      <section className="border-t border-slate-100 bg-slate-50/30 py-12 md:py-14">
        <div className="section-container">
          <h2
            className="mb-7 text-center font-display text-3xl font-bold leading-[1.04] sm:text-4xl lg:text-5xl"
            style={{ color: ORIGIN_GRAY }}
          >
            Pourquoi nous <span style={{ color: BLUE }}>choisir</span> ?
          </h2>
          <PourquoiChoisirTabs />
        </div>
      </section>

      <section className="bg-slate-100 py-12 md:py-14">
        <div className="section-container">
          <div>
            <h2
              className="mb-9 font-display text-3xl font-bold leading-[1.04] sm:text-4xl lg:text-5xl"
              style={{ color: ORIGIN_GRAY }}
            >
              Nos <span style={{ color: BLUE }}>GARANTIES</span>
            </h2>
            <div className="divide-y divide-slate-200">
              <div className="flex flex-col gap-4 py-6 first:pt-0 sm:flex-row sm:items-center sm:gap-6">
                <div className="flex h-24 w-24 flex-shrink-0 items-center justify-center overflow-hidden bg-transparent p-1">
                  <Image
                    src="/image/concept/logos_concept/logo-atout-france.png"
                    alt="Logo Atout France"
                    width={768}
                    height={768}
                    className="h-[5.25rem] w-[5.25rem] object-contain"
                  />
                </div>
                <p className="text-slate-600">
                  Les organisateurs sont tous{' '}
                  <strong className="text-slate-800">
                    immatriculés au registre des opérateurs de voyages et de séjours.
                  </strong>{' '}
                  Ils s’engagent à respecter les normes en vigueur pour la protection des mineurs et
                  la qualité des séjours.
                </p>
              </div>
              <div className="flex flex-col gap-4 py-6 sm:flex-row sm:items-center sm:gap-6">
                <div className="flex h-24 w-24 flex-shrink-0 items-center justify-center overflow-hidden bg-transparent p-1">
                  <Image
                    src="/image/concept/logos_concept/Logo-DRAJES (1).jpg"
                    alt="Logo du ministère"
                    width={350}
                    height={350}
                    className="h-[5.25rem] w-[5.25rem] object-contain"
                  />
                </div>
                <p className="text-slate-600">
                  Chaque séjour fait l’objet de déclarations officielles auprès des{' '}
                  <strong className="text-slate-800">autorités de tutelle.</strong> La conformité et
                  la sécurité des accueils collectifs de mineurs sont ainsi garanties.
                </p>
              </div>
            </div>
          </div>
        </div>
      </section>
    </div>
  );
}
