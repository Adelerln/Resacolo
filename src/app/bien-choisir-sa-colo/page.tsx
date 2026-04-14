import Image from 'next/image';
import Link from 'next/link';
import { SlotMachineVisual } from '@/components/bien-choisir/SlotMachineVisual';
import { ChoisirSaColoLogo } from '@/components/bien-choisir/ChoisirSaColoLogo';

const ORANGE = '#FA8500';
const BLUE = '#52B0EA';
const ORIGIN_GRAY = '#505050';

export const metadata = {
  title: 'Bien choisir sa colo | ResaColo',
  description:
    'Conseils et ressources pour bien choisir la colonie de vacances de votre enfant. Découvrez ChoisirSaColo.fr.'
};

export default function BienChoisirSaColoPage() {
  return (
    <div className="min-h-screen bg-white">
      {/* Section 1: Header */}
      <section className="bg-slate-50 py-16 md:py-20">
        <div className="section-container grid gap-10 lg:grid-cols-2 lg:items-center">
          <div className="max-w-2xl text-left">
            <p className="text-xs font-extrabold uppercase tracking-widest text-slate-500">
              Aide & conseils
            </p>
            <h1
              className="mt-3 text-left font-display text-3xl font-bold leading-[1.18] sm:text-4xl lg:text-[3.25rem]"
              style={{ color: ORIGIN_GRAY }}
            >
              <span style={{ color: ORANGE }}>Bien choisir</span> sa colonie de vacances
            </h1>
            <p className="mt-4 max-w-xl font-medium leading-relaxed text-slate-600">
              Sélectionner une colonie de vacances peut s&apos;avérer compliqué face à une offre diversifiée de
              séjours, surtout si c&apos;est la première fois que l&apos;on confie son enfant. Profitez de nos
              conseils pour bien choisir !
            </p>
          </div>
          <div className="flex items-center justify-center lg:justify-end">
            <SlotMachineVisual />
          </div>
        </div>
      </section>

      {/* Section 2: Attentes & besoins */}
      <section className="section-container pt-12 pb-12 md:pt-16 md:pb-16">
        <div className="w-full">
          <div className="flex items-center justify-start gap-3 text-left sm:gap-4">
            <div className="relative -mt-1 h-7 w-7 flex-shrink-0 sm:h-8 sm:w-8">
              <Image
                src="/image/choisirsacolo/pictos_choisirsacolo/etape-bien-choisir-sa-colo_Plandetravail1.png"
                alt="Picto attentes et besoins"
                fill
                className="object-contain"
                priority
              />
            </div>
            <h2 className="font-display text-xl font-bold sm:text-2xl" style={{ color: ORIGIN_GRAY }}>
              Attentes et besoins pour une colonie de vacances
            </h2>
          </div>

          <div className="mt-3 grid gap-6 xl:grid-cols-[minmax(0,1fr)_320px] xl:items-stretch">
            <div className="rounded-[32px] bg-white p-4 sm:p-5 lg:p-6">
              <div className="space-y-3 text-sm font-medium leading-7 text-slate-600 sm:text-[15px]">
                <p>
                  Chaque enfant est unique, avec ses préférences, ses attentes ou ses besoins. Il est
                  important d&apos;en tenir compte lorsqu&apos;on envisage de l&apos;inscrire à une colonie de
                  vacances.
                </p>
                <p>
                  Partir en colonie de vacances, ce n&apos;est pas uniquement pratiquer une activité.
                  C&apos;est également découvrir un nouvel environnement, évoluer dans un cadre de vie
                  collectif, faire des rencontres et nouer des liens d&apos;amitié.
                </p>
                <p className="font-bold">
                  Prenez le temps de discuter avec votre enfant pour identifier ses envies !
                </p>

                <p className="pt-1">
                  Choisir le séjour collectif, c&apos;est prendre en considération les personnes et leurs
                  désirs :
                </p>

                <div className="space-y-3 pt-1">
                  <div>
                    <p className="text-sm font-semibold" style={{ color: ORANGE }}>
                      Enfant
                    </p>
                    <p>Participer à une colo proche de ses attentes et de ses goûts.</p>
                  </div>

                  <div>
                    <p className="text-sm font-semibold" style={{ color: ORANGE }}>
                      Parents
                    </p>
                    <p>Choisir une colo adaptée à leurs valeurs et leurs attentes éducatives.</p>
                  </div>

                  <div>
                    <p className="text-sm font-semibold" style={{ color: BLUE }}>
                      &laquo; Colo idéale &raquo;
                    </p>
                    <p style={{ color: BLUE }}>
                      Alchimie entre vie collective et prise en compte des besoins individualisés de
                      l&apos;enfant.
                    </p>
                  </div>
                </div>
              </div>
            </div>

            <div className="relative min-h-[280px] overflow-hidden rounded-[32px] sm:min-h-[340px] xl:min-h-[380px]">
              <Image
                src="/image/choisirsacolo/images_choisirsacolo/bien-choisir-sa-colo.jpg"
                alt="Enfant montant dans un bus pour partir en colonie de vacances"
                fill
                className="object-cover"
                sizes="(max-width: 1024px) 100vw, 320px"
              />
            </div>
          </div>
        </div>
      </section>

      {/* Section 3: Questions essentielles */}
      <section className="section-container pt-12 pb-14 md:pt-16 md:pb-20">
        <div className="w-full">
          <div className="grid max-w-6xl gap-6 xl:grid-cols-[320px_minmax(0,1fr)] xl:items-stretch">
            <div className="relative min-h-[260px] overflow-hidden rounded-[32px] sm:min-h-[340px] xl:h-full xl:min-h-0">
              <Image
                src="/image/choisirsacolo/images_choisirsacolo/bien-choisir-sa-colo-communication.jpg"
                alt="Jeune en communication pendant un sejour de colonie de vacances"
                fill
                className="object-cover"
                sizes="(max-width: 1024px) 100vw, 320px"
              />
            </div>

            <div>
              <div className="flex items-center justify-start gap-3 text-left sm:gap-4">
                <div className="relative -mt-1 h-7 w-7 flex-shrink-0 sm:h-8 sm:w-8">
                  <Image
                    src="/image/choisirsacolo/pictos_choisirsacolo/etape-bien-choisir-sa-colo_Plandetravail2.png"
                    alt="Picto questions essentielles"
                    fill
                    className="object-contain"
                  />
                </div>
                <h2 className="font-display text-xl font-bold sm:text-2xl" style={{ color: ORIGIN_GRAY }}>
                  Les questions essentielles avant une colonie de vacances
                </h2>
              </div>

              <div className="mt-3 rounded-[32px] bg-white p-4 sm:p-5 lg:p-6">
                <div className="space-y-3 text-sm font-medium leading-7 text-slate-600 sm:text-[15px]">
                  <p>
                    Avant de vous décider, l&apos;organisateur du séjour est à votre disposition pour répondre à
                    vos éventuelles questions :
                  </p>

                  <div className="space-y-4 pt-1">
                    <div>
                      <p className="text-sm font-semibold" style={{ color: ORANGE }}>
                        Organisation
                      </p>
                      <p>Quelles sont les normes d&apos;encadrement&nbsp;? Combien d&apos;enfants sont accueillis&nbsp;?</p>
                      <p>
                        Comment s&apos;organise la vie quotidienne (hébergement, repas, déplacement)&nbsp;?
                      </p>
                      <p>
                        Est-il possible d&apos;inscrire une fratrie en assurant à chacun de vivre pleinement son
                        séjour&nbsp;?
                      </p>
                    </div>

                    <div>
                      <p className="text-sm font-semibold" style={{ color: ORANGE }}>
                        Administration
                      </p>
                      <p>
                        Quels documents sont transmis avant le départ pour bien préparer le séjour de mon enfant
                        (trousseau, formalités, convocation départ/retour...)&nbsp;?
                      </p>
                      <p>
                        Puis-je disposer d&apos;une fiche qui synthétise le déroulement du séjour et les activités
                        dominantes / l&apos;itinéraire&nbsp;?
                      </p>
                      <p>
                        Mon enfant est-il couvert en cas d&apos;accident&nbsp;? Dois-je souscrire à une couverture
                        complémentaire&nbsp;?
                      </p>
                    </div>

                    <div>
                      <p className="text-sm font-semibold" style={{ color: ORANGE }}>
                        Transport
                      </p>
                      <p>
                        Par quel moyen de transport les enfants rejoignent-ils le centre (train, car, minibus...)&nbsp;?
                      </p>
                    </div>

                    <div>
                      <p className="text-sm font-semibold" style={{ color: ORANGE }}>
                        Communication
                      </p>
                      <p>
                        Est-il possible d&apos;entrer en contact avec l&apos;équipe encadrante avant le séjour&nbsp;?
                      </p>
                      <p>
                        Mon enfant reste-t-il joignable durant le séjour (téléphone, mail, blog...)&nbsp;?
                      </p>
                    </div>
                  </div>

                  <p className="pt-2">
                    Pour toutes questions relatives à la plateforme, consultez notre{' '}
                    <Link href="/faq" className="font-semibold underline underline-offset-4" style={{ color: BLUE }}>
                      FAQ
                    </Link>
                    .
                  </p>
                </div>
              </div>
            </div>
          </div>

          <div className="mt-14 max-w-6xl overflow-hidden rounded-3xl bg-gradient-to-r from-brand-50 to-white p-5 shadow-xl backdrop-blur-sm sm:p-6 md:mt-16 md:flex md:items-center md:gap-6 md:p-6">
            <div className="flex flex-shrink-0 justify-center md:max-w-[45%]">
              <div className="flex items-center justify-center rounded-2xl border border-slate-200 bg-slate-50/50 p-3">
                <ChoisirSaColoLogo />
              </div>
            </div>
            <div className="mt-6 flex-1 md:mt-0">
              <h2 className="font-display text-2xl font-bold sm:text-3xl" style={{ color: ORIGIN_GRAY }}>
                Besoin d&apos;aller plus loin&nbsp;?
              </h2>
              <p className="mt-2 text-lg font-semibold text-slate-700">
                Découvrez{' '}
                <a
                  href="https://www.choisirsacolo.fr/"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="font-bold underline underline-offset-4"
                  style={{ color: BLUE }}
                >
                  www.choisirsacolo.fr
                </a>
              </p>
              <p className="mt-4 leading-relaxed text-slate-600">
                La plateforme de référence pour tout savoir sur les colonies de vacances :
                hébergement, alimentation, encadrement…
              </p>
            </div>
          </div>

          <div className="mt-14 grid max-w-6xl gap-6 md:mt-16 xl:grid-cols-[minmax(0,1fr)_minmax(340px,540px)] xl:items-stretch">
            <div>
              <div className="flex items-center justify-start gap-3 text-left sm:gap-4">
                <div className="relative -mt-1 h-7 w-7 flex-shrink-0 sm:h-8 sm:w-8">
                  <Image
                    src="/image/choisirsacolo/pictos_choisirsacolo/etape-bien-choisir-sa-colo_Plandetravail3.png"
                    alt="Picto thematiques"
                    fill
                    className="object-contain"
                  />
                </div>
                <h2 className="font-display text-xl font-bold sm:text-2xl" style={{ color: ORIGIN_GRAY }}>
                  Thématiques pour une colonie de vacances
                </h2>
              </div>

              <div className="mt-3 max-w-5xl rounded-[32px] bg-white p-4 sm:p-5 lg:p-6">
                <div className="space-y-3 text-sm font-medium leading-7 text-slate-600 sm:text-[15px]">
                  <p>
                    Pour aider votre enfant à s&apos;épanouir et à vivre pleinement son séjour, Resacolo
                    propose différents types de séjours et de nombreuses prestations.
                  </p>
                  <div className="pt-1">
                    <Link
                      href="/sejours"
                      className="cta-orange-sweep inline-flex items-center justify-center rounded-full px-6 py-3 text-sm font-semibold text-white transition"
                      style={{ backgroundColor: ORANGE }}
                    >
                      Découvrir les séjours
                    </Link>
                  </div>
                </div>
              </div>
            </div>

            <div className="relative min-h-[220px] overflow-hidden rounded-[32px] sm:min-h-[280px] xl:h-full xl:min-h-0">
              <Image
                src="/image/choisirsacolo/images_choisirsacolo/bien-choisir-sa-colo-activite%CC%81s.jpg"
                alt="Activites pour une colonie de vacances"
                fill
                className="object-cover object-right"
                sizes="(max-width: 1024px) 100vw, 600px"
              />
            </div>
          </div>
        </div>
      </section>
    </div>
  );
}
