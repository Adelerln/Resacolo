import type { Metadata } from 'next';
import Image from 'next/image';
import { Fragment } from 'react';
import { PartnerContactForm } from '@/components/devenir-partenaire/PartnerContactForm';
import {
  Award,
  Check,
  CheckSquare,
  ChevronRight,
  Euro,
  FileSignature,
  Gift,
  PenBox,
  Search,
  Sun,
  Users
} from 'lucide-react';

const ORANGE = '#FA8500';
const ORIGIN_BLUE = '#37B5F5';
const ORIGIN_GRAY = '#505050';

export const metadata: Metadata = {
  title: 'Devenir Partenaire | Resacolo',
  description: 'Devenir partenaire de RESACOLO, c’est promouvoir et faciliter le départ en colonie de vacances.'
};

const processSteps = [
  {
    icon: Search,
    text: 'Découvrez notre concept, nos intentions et objectifs'
  },
  {
    icon: CheckSquare,
    text: 'Choisissez la formule la plus adaptée à vos besoins'
  },
  {
    icon: FileSignature,
    text: 'Validez votre partenariat avec RESACOLO'
  },
  {
    icon: Gift,
    text: 'Offrez des remises sur les séjours à vos ayants-droits'
  }
];

const partnershipValues = [
  {
    icon: Award,
    title: 'Une offre qualifiée multiple',
    text: 'Les prestations proposées sont conçues et organisées par une large sélection d’opérateurs expérimentés.'
  },
  {
    icon: Euro,
    title: 'Des avantages spécifiques',
    text: 'Les ayants-droits de nos partenaires bénéficient d’avantages sur l’intégralité des séjours publiés.'
  },
  {
    icon: Users,
    title: 'Une réservation en circuit court',
    text: 'RESACOLO se limite au référencement des séjours. Les réservations sont faites directement auprès des organisateurs.'
  }
];

const formulas = [
  {
    icon: Sun,
    title: 'SÉRÉNITÉ',
    text: 'La plus simple façon de favoriser le départ en vacances et de sensibiliser aux bienfaits de la colo pour la Jeunesse.',
    bullets: ['Un accès à l’intégralité de l’offre de séjours', 'Un code avantage pour vos ayants-droits.']
  },
  {
    icon: PenBox,
    title: 'IDENTITÉ',
    text: 'L’option idéale pour les institutions qui appliquent une politique volontariste et participent au coût du séjour.',
    bullets: null as null,
    bulletsRich: [
      {
        before: 'Un site marque blanche personnalisé ',
        italic: '(URL spécifique, logo de votre institution, rubrique dédiée, critères particuliers)'
      },
      {
        before: 'Des avantages offerts à vos ayants-droits ',
        italic: '(affichés directement sur les fiches séjours)'
      }
    ]
  }
] as const;

export default function DevenirPartenairePage() {
  return (
    <div className="min-h-screen bg-white">
      <section className="relative bg-slate-100 pb-12 pt-10 md:pb-14 md:pt-14 lg:pb-16">
        <div className="section-container grid min-h-0 gap-7 pb-1 md:grid-cols-2 md:items-center md:gap-10 md:pb-2 lg:gap-12">
          <div>
            <p className="text-xs font-extrabold uppercase tracking-widest text-slate-500">À propos</p>
            <h1 className="mt-4 font-display text-3xl font-bold leading-[1.15] text-slate-900 sm:text-4xl sm:leading-[1.17] lg:text-[3.25rem] lg:leading-[1.2]">
              <span style={{ color: ORIGIN_GRAY }}>Les conditions de </span>
              <span style={{ color: ORANGE }}>partenariat</span>
            </h1>
            <p className="mt-6 max-w-xl text-justify font-medium leading-relaxed text-slate-600">
              Devenir partenaire de RESACOLO, c&apos;est promouvoir et faciliter le départ en colonie de vacances !
              Sensibiliser vos publics aux bienfaits des colonies de vacances en privilégiant la plateforme des
              professionnels du secteur et son catalogue de séjours riche et diversifié.
            </p>
          </div>

          <div className="flex items-center justify-center md:justify-end md:self-start">
            <div className="w-full max-w-[36rem]">
              <Image
                src="/image/devenirpartenaire/gif_part/partenariat-formule.gif"
                alt="Formules de partenariat Resacolo"
                width={1920}
                height={1080}
                priority
                unoptimized
                className="h-auto w-full object-contain"
                sizes="(max-width: 768px) 100vw, 36rem"
              />
            </div>
          </div>
        </div>

        {/* Frise centrée sur la limite hero (gris) / section suivante (blanc) */}
        <div className="pointer-events-none absolute inset-x-0 bottom-0 z-10 translate-y-1/2 px-0 sm:px-4">
          <div className="section-container pointer-events-auto">
            <div className="rounded-[24px] border border-slate-100 bg-white px-4 py-5 shadow-[0_16px_44px_rgba(15,23,42,0.08)] sm:px-6 sm:py-6">
              <div className="flex flex-col gap-5 lg:flex-row lg:items-stretch lg:justify-between lg:gap-0">
                {processSteps.map((step, index) => (
                  <Fragment key={step.text}>
                    <article className="flex min-w-0 flex-1 flex-col items-center rounded-xl bg-slate-50/80 p-4 text-center lg:bg-transparent lg:p-3">
                      <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-accent-50">
                        <step.icon className="h-5 w-5 text-accent-500" aria-hidden />
                      </div>
                      <p className="mt-3 max-w-[14rem] text-sm font-semibold leading-snug text-slate-700 sm:max-w-none">
                        {step.text}
                      </p>
                    </article>
                    {index < processSteps.length - 1 ? (
                      <div
                        className="hidden shrink-0 items-center justify-center self-center px-1 lg:flex"
                        aria-hidden
                      >
                        <ChevronRight className="h-6 w-6 text-accent-500" strokeWidth={2.25} />
                      </div>
                    ) : null}
                  </Fragment>
                ))}
              </div>
            </div>
          </div>
        </div>
      </section>

      <section className="bg-white pb-16 pt-24 md:pb-20 md:pt-28 lg:pt-32">
        <div className="section-container">
          <h2 className="text-center font-display text-2xl font-bold leading-tight text-slate-900 sm:text-3xl lg:text-4xl">
            Privilégier <span style={{ color: ORIGIN_BLUE }}>RESACOLO</span>
            <span style={{ color: ORIGIN_GRAY }}>, c&apos;est valoriser…</span>
          </h2>

          <div className="mt-10 grid gap-5 md:grid-cols-3 md:gap-6">
            {partnershipValues.map((item) => (
              <article key={item.title} className="rounded-2xl bg-accent-50 p-5 sm:p-6">
                <div className="flex items-center gap-3 sm:gap-4">
                  <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-xl bg-white shadow-sm">
                    <item.icon className="h-6 w-6 text-accent-500" aria-hidden />
                  </div>
                  <h3 className="min-w-0 flex-1 text-base font-bold leading-snug text-slate-900">{item.title}</h3>
                </div>
                <p className="mt-3 text-sm font-medium leading-relaxed text-slate-600">{item.text}</p>
              </article>
            ))}
          </div>
        </div>
      </section>

      <section className="bg-white pb-16 md:pb-20">
        <div className="section-container">
          <h2 className="text-center font-display text-2xl font-bold leading-tight text-slate-900 sm:text-3xl lg:text-4xl">
            <span style={{ color: ORIGIN_GRAY }}>Nos formules </span>
            <span style={{ color: ORIGIN_BLUE }}>100% gratuites</span>
          </h2>

          <div className="mt-10 grid gap-8 lg:grid-cols-2 lg:gap-10">
            {formulas.map((formula) => (
              <article
                key={formula.title}
                className="relative flex flex-col overflow-hidden rounded-[28px] bg-white p-6 shadow-md ring-1 ring-slate-100 sm:p-8"
              >
                <div className="pointer-events-none absolute inset-x-0 bottom-0 h-1.5 bg-accent-500" aria-hidden />
                <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-full bg-accent-50">
                  <formula.icon className="h-8 w-8 text-accent-500" aria-hidden />
                </div>
                <h3 className="mt-6 text-center text-xl font-bold uppercase tracking-wide text-accent-500">
                  {formula.title}
                </h3>
                <p className="mt-4 text-center text-sm font-medium leading-relaxed text-slate-600 sm:text-[15px]">
                  {formula.text}
                </p>
                <ul className="mt-6 space-y-3">
                  {'bullets' in formula && formula.bullets
                    ? formula.bullets.map((bullet) => (
                        <li key={bullet} className="flex items-start gap-3 text-sm font-medium text-slate-700">
                          <span className="mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-[#37b5f5] text-white">
                            <Check className="h-3 w-3 stroke-[3]" aria-hidden />
                          </span>
                          {bullet}
                        </li>
                      ))
                    : 'bulletsRich' in formula && formula.bulletsRich
                      ? formula.bulletsRich.map((row) => (
                          <li key={row.before} className="flex items-start gap-3 text-sm font-medium text-slate-700">
                            <span className="mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-[#37b5f5] text-white">
                              <Check className="h-3 w-3 stroke-[3]" aria-hidden />
                            </span>
                            <span>
                              {row.before}
                              <em className="text-slate-600">{row.italic}</em>
                            </span>
                          </li>
                        ))
                      : null}
                </ul>
              </article>
            ))}
          </div>
        </div>
      </section>

      <PartnerContactForm />
    </div>
  );
}
