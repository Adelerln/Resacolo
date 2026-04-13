'use client';

import Link from 'next/link';
import Image from 'next/image';
import { useEffect, useRef, useState } from 'react';
import { FranceRegionsMap } from '@/components/home/FranceRegionsMap';
import { WorldMap } from '@/components/home/WorldMap';
import { OrganizersMarquee } from '@/components/organisateurs/OrganizersMarquee';
import {
  Briefcase,
  Home,
  HeartHandshake,
  CreditCard,
  Building2,
  ArrowRight,
  ChevronLeft,
  ChevronRight,
  type LucideIcon
} from 'lucide-react';
import { motion } from 'framer-motion';

/* ─── Data ────────────────────────────────────────────────────────────────── */

const benefits = [
  {
    imageSrc: '/image/accueil/pictos_accueil/lordinateur.png',
    imageAlt: 'Pictogramme ordinateur',
    text: (
      <>
        <strong style={{ color: '#fb8500' }}>1er site</strong>
        {' '}
        conçu par un collectif d&apos;organisateurs.
      </>
    )
  },
  {
    imageSrc: '/image/accueil/pictos_accueil/transfer.png',
    imageAlt: 'Pictogramme transfert',
    text: (
      <>
        Réservation en <strong style={{ color: '#fb8500' }}>circuit court</strong> sans intermédiaire.
      </>
    )
  },
  {
    imageSrc: '/image/accueil/pictos_accueil/caroussel.png',
    imageAlt: 'Pictogramme carrousel',
    text: (
      <>
        Une <strong style={{ color: '#fb8500' }}>offre riche et variée</strong>
        {' '}
        issue d&apos;opérateurs reconnus.
      </>
    )
  }
];

const inspiCards = [
  {
    src: '/image/accueil/images_accueil/9.inspi-hiver.jpg',
    alt: 'Séjour inspiration hiver',
    title: "Savourer l'hiver",
    description:
      'Pistes enneigées, sports de glisse, randonnées en chiens de traineaux, inoubliables batailles de boules de neige : découvrez nos destinations montagne !',
    href: '/sejours?periods=hiver'
  },
  {
    src: '/image/accueil/images_accueil/1.inspi-artistique2.jpg',
    alt: 'Séjour inspiration artistique',
    title: "Révéler son âme d'artiste",
    description:
      'Théâtre, danse, chant, cinéma, dessin manga, mode, cirque, photo, magie, graff : explorez et exploitez votre fibre artistique !',
    href: '/sejours?categories=artistique'
  },
  {
    src: '/image/accueil/images_accueil/8.inspi-printemps.png',
    alt: 'Séjour inspiration printemps',
    title: 'Célébrer le Printemps',
    description:
      'Dernières neiges, premières baignades, animations de plein air, activités artistiques, road trip, stage linguistique : profitez du retour des beaux jours !',
    href: '/sejours?periods=printemps'
  },
  {
    src: '/image/accueil/images_accueil/2.inspi-equitation2.jpg',
    alt: 'Séjour inspiration équitation',
    title: "S'initier / se perfectionner en équitation",
    description:
      'Débutants comme aguerris, nos séjours équestres s’adaptent à tous les publics et à toutes les attentes : osez monter en selle !',
    href: '/sejours?categories=equestre'
  },
  {
    src: '/image/accueil/images_accueil/6.inspi-ete.png',
    alt: 'Séjour inspiration été',
    title: "Profiter de l'été",
    description:
      'Le bord de mer et ses activités aquatiques, le milieu naturel et ses sports de plein air, une thématique plus spécifique : décidez selon vos envies !',
    href: '/sejours?periods=ete'
  },
  {
    src: '/image/accueil/images_accueil/3.inspi-etranger.jpg',
    alt: 'Séjour inspiration étranger',
    title: 'Dépasser les frontières',
    description:
      "Découvrir d’autres cultures, apprécier une gastronomie inhabituelle, s’immerger dans de nouveaux paysages : et si vous partiez à l’étranger ?",
    href: '/sejours?categories=etranger'
  },
  {
    src: '/image/accueil/images_accueil/7.inspi-automne.jpg',
    alt: 'Séjour inspiration automne',
    title: "Apprécier l'arrière-saison",
    description:
      'Séjours équitation, de pleine nature, artistique ou sportif, circuits découverte à l’étranger : laissez-vous séduire par notre programmation automnale !',
    href: '/sejours?periods=automne'
  },
  {
    src: '/image/accueil/images_accueil/5.inspi-linguistique.png',
    alt: 'Séjour inspiration linguistique',
    title: "Profiter d'une expérience linguistique",
    description:
      'En centre de vacances, en collège ou au sein d’une famille d’accueil : pratiquez une langue étrangère grâce à nos différentes formules linguistiques !',
    href: '/sejours?categories=linguistique'
  },
  {
    src: '/image/accueil/images_accueil/4.inspi-premierdep.jpg',
    alt: 'Séjour inspiration premier départ',
    title: 'Vivre son premier départ en colo',
    description:
      'Un environnement différent, de nouvelles activités, des amitiés à créer : préparez votre séjour avec une équipe sensibilisée !',
    href: '/sejours?q=premier%20depart'
  }
];

const processSteps = [
  {
    gifSrc: '/image/accueil/gif_accueil/pictogrammes_Selection resacolo-min.gif',
    gifAlt: 'Animation de sélection de séjour',
    title: '1. Choisir un séjour',
    desc: 'Trouvez la destination, les activités idéales pour votre enfant et consultez la fiche détaillée du séjour sur notre plateforme.'
  },
  {
    gifSrc: '/image/accueil/gif_accueil/pictogrammes_Inscription-min.gif',
    gifAlt: "Animation d'inscription",
    title: "2. S'inscrire",
    desc: 'Choisissez vos options (dates, transport…), saisissez vos informations personnelles puis transmettez votre réservation à l’organisateur du séjour.'
  },
  {
    gifSrc: '/image/accueil/gif_accueil/chargement-animation-min.gif',
    gifAlt: 'Animation de validation de réservation',
    title: '3. Valider votre réservation',
    desc: 'L’organisateur se met en relation avec vous pour finaliser l’inscription de votre enfant et préparer son départ en séjour.'
  }
];

type AidItem = {
  icon: LucideIcon;
  label: string;
  desc: string;
  href?: string;
  logoSrc?: string;
  logoAlt?: string;
};

const aids: AidItem[] = [
  {
    icon: Building2,
    label: 'Employeur / CSE',
    desc: 'Votre comité social et économique peut prendre en charge une partie ou la totalité du séjour. Renseignez-vous auprès de votre employeur.'
  },
  {
    icon: Home,
    label: "Caisse d'Allocations familiales",
    desc: "La Caisse d'Allocations familiales propose des aides comme les bons VACAF pour financer les séjours de vos enfants.",
    href: 'https://vacaf.org/',
    logoSrc: '/image/accueil/logos_accueil/Caisse_d_allocations_familiales_france_logo.svg.png',
    logoAlt: "Logo Caisse d'Allocations familiales"
  },
  {
    icon: Building2,
    label: 'Collectivité (conseil général, conseil régional, mairie)',
    desc: 'De nombreuses mairies et régions offrent des subventions ou chèques vacances pour les familles.'
  },
  {
    icon: HeartHandshake,
    label: 'Jeunesse au Plein Air',
    desc: 'La Jeunesse au Plein Air propose des bourses et aides financières pour les familles à revenus modestes.',
    href: 'https://jpa.asso.fr/aide-colonie-de-vacances/',
    logoSrc: '/image/accueil/logos_accueil/JPA_logo.jpg',
    logoAlt: 'Logo Jeunesse au Plein Air'
  },
  {
    icon: Briefcase,
    label: 'Organisateurs',
    desc: 'Certains organisateurs proposent des facilités de paiement ou peuvent vous orienter vers les aides mobilisables pour financer le séjour.'
  },
  {
    icon: CreditCard,
    label: 'ANCV (Chèque-vacances)',
    desc: 'Les chèques-vacances ANCV sont acceptés par de nombreux organisateurs de colos partenaires.',
    href: 'https://www.ancv.com/',
    logoSrc: '/image/accueil/logos_accueil/ancv.jpg',
    logoAlt: 'Logo ANCV'
  }
];

const fadeUp = {
  hidden: { opacity: 0, y: 24 },
  visible: (i: number) => ({ opacity: 1, y: 0, transition: { delay: i * 0.15, duration: 0.5 } })
};

/* ─── Page ────────────────────────────────────────────────────────────────── */

export default function HomePage() {
  const [destinationMap, setDestinationMap] = useState<'france' | 'world'>('france');
  const [inspiIndex, setInspiIndex] = useState(inspiCards.length);
  const [inspiTransitionEnabled, setInspiTransitionEnabled] = useState(true);
  const [inspiStepPx, setInspiStepPx] = useState(0);
  const [inspiCardWidthPx, setInspiCardWidthPx] = useState(0);
  const [inspiGapPx, setInspiGapPx] = useState(24);
  const [inspiCardsPerView, setInspiCardsPerView] = useState(3);
  const inspiViewportRef = useRef<HTMLDivElement | null>(null);
  const leftAids = aids.filter((_, index) => index % 2 === 0);
  const rightAids = aids.filter((_, index) => index % 2 === 1);
  const inspiLoopCards = [...inspiCards, ...inspiCards, ...inspiCards];

  useEffect(() => {
    const interval = window.setInterval(() => {
      setInspiTransitionEnabled(true);
      setInspiIndex((current) => current + 1);
    }, 6000);

    return () => window.clearInterval(interval);
  }, []);

  useEffect(() => {
    function updateInspiStep() {
      const viewportWidth = inspiViewportRef.current?.clientWidth ?? 0;
      if (!viewportWidth) {
        return;
      }

      const cardsPerView = viewportWidth < 640 ? 1 : viewportWidth < 1024 ? 2 : 3;
      const gapPx = viewportWidth < 640 ? 16 : 24;
      const totalGap = gapPx * (cardsPerView - 1);
      const cardWidthPx = (viewportWidth - totalGap) / cardsPerView;
      setInspiCardsPerView(cardsPerView);
      setInspiGapPx(gapPx);
      setInspiCardWidthPx(cardWidthPx);
      setInspiStepPx(cardWidthPx + gapPx);
    }

    updateInspiStep();
    window.addEventListener('resize', updateInspiStep);

    return () => window.removeEventListener('resize', updateInspiStep);
  }, []);

  const showPreviousInspiCard = () => {
    setInspiTransitionEnabled(true);
    setInspiIndex((current) => current - 1);
  };

  const showNextInspiCard = () => {
    setInspiTransitionEnabled(true);
    setInspiIndex((current) => current + 1);
  };

  const handleInspiTransitionEnd = () => {
    if (inspiIndex >= inspiCards.length * 2) {
      setInspiTransitionEnabled(false);
      setInspiIndex((current) => current - inspiCards.length);
      window.requestAnimationFrame(() => {
        window.requestAnimationFrame(() => {
          setInspiTransitionEnabled(true);
        });
      });
      return;
    }

    if (inspiIndex < inspiCards.length) {
      setInspiTransitionEnabled(false);
      setInspiIndex((current) => current + inspiCards.length);
      window.requestAnimationFrame(() => {
        window.requestAnimationFrame(() => {
          setInspiTransitionEnabled(true);
        });
      });
    }
  };

  return (
    <div>
      {/* ── Banner ── */}
      <section id="accueil">
        <div className="relative min-h-[360px] sm:min-h-[430px] lg:min-h-[500px] xl:min-h-[540px]">
          <Image
            src="/image/accueil/images_accueil/banniere-accueil.jpg"
            alt="Bannière d'accueil Resacolo"
            fill
            className="object-cover object-[center_22%] sm:object-[center_18%] lg:object-[center_8%] xl:object-[center_5%]"
            sizes="100vw"
            priority
          />
          <div className="absolute inset-0 px-4 sm:px-8 lg:px-16">
            <div className="relative h-full w-full text-center">
              <p
                className="absolute left-1/2 top-1/2 w-full max-w-5xl -translate-x-1/2 -translate-y-1/2 px-2 font-display text-[clamp(1.9rem,7vw,63px)] font-bold text-white"
                style={{
                  textShadow: '0.06em 0.06em 0.1em rgba(23,23,23,0.9)',
                  lineHeight: 1.05,
                  margin: 0
                }}
              >
                Prêt pour un nouveau départ ?
              </p>
              <div className="absolute left-1/2 top-1/2 flex w-full -translate-x-1/2 flex-col items-center pt-8 sm:pt-10 lg:pt-12">
                <h1
                  className="max-w-none whitespace-nowrap px-2 text-center text-[clamp(0.52rem,2.15vw,23px)] font-semibold text-white"
                  style={{
                    textShadow: '0.06em 0.06em 0.1em rgba(23,23,23,0.9)',
                    lineHeight: 1.2,
                    margin: 0
                  }}
                >
                  Colonies de vacances 2026 pour <span style={{ color: '#6dc7fe' }}>enfants et ados</span> de 4 à
                  17 ans et séjours <span style={{ color: '#6dc7fe' }}>jeunes adultes</span> de 18 à 25 ans
                </h1>
                <div className="mt-6 flex flex-col items-center justify-center gap-3 sm:flex-row sm:gap-4">
                  <Link href="/sejours" className="btn btn-primary btn-md w-full sm:w-auto">
                    Trouver une colo
                    <ArrowRight size={18} />
                  </Link>
                  <a href="#comment-ca-marche" className="btn btn-secondary btn-md w-full sm:w-auto">
                    Comment ça marche ?
                  </a>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* ── Pourquoi Resacolo ── */}
      <section className="section-padding bg-slate-50">
        <div className="section-container">
          <div className="grid items-center gap-12 lg:grid-cols-2">
            <motion.blockquote
              className="min-w-0 self-center border-l-4 pl-6 lg:pr-4"
              initial={{ opacity: 0, x: -20 }}
              whileInView={{ opacity: 1, x: 0 }}
              viewport={{ once: true }}
              transition={{ duration: 0.5 }}
              style={{ borderColor: '#6dc7fe' }}
            >
              <h2
                className="text-2xl font-bold leading-tight text-[#505050] sm:text-3xl"
                style={{
                  fontFamily: 'var(--font-primary)',
                  textAlign: 'left',
                  margin: 0
                }}
              >
                Les organisateurs de colos réunis vous offrent leur savoir-faire{' '}
                <span style={{ color: '#6dc7fe' }}>pour faire grandir vos enfants.</span>
              </h2>
            </motion.blockquote>

            <div className="min-w-0 flex flex-col gap-5">
              {benefits.map((item, i) => (
                <motion.div
                  key={i}
                  className="resacolo-card flex items-center gap-4"
                  custom={i}
                  initial="hidden"
                  whileInView="visible"
                  viewport={{ once: true }}
                  variants={fadeUp}
                >
                  <div className="flex h-14 w-14 shrink-0 items-center justify-center">
                    <Image
                      src={item.imageSrc}
                      alt={item.imageAlt}
                      width={56}
                      height={56}
                      className="h-14 w-14 object-contain"
                      priority={i === 0}
                    />
                  </div>
                  <p className="text-slate-700 font-medium">{item.text}</p>
                </motion.div>
              ))}
            </div>
          </div>

          <div className="mt-10">
            <OrganizersMarquee embedded />
          </div>
        </div>
      </section>

      {/* ── Thématiques ── */}
      <section id="thematiques" className="pb-16 pt-8 sm:pb-24 sm:pt-10">
        <div className="section-container">
          <motion.div
            className="text-center"
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
          >
            <span
              style={{
                fontWeight: 700,
                textTransform: 'uppercase',
                fontSize: '15px',
                color: '#505050',
                lineHeight: '1.7em'
              }}
            >
              ACTUALITÉS
            </span>
            <h2
              className="mt-1 text-4xl sm:text-5xl"
              style={{
                fontWeight: 700,
                color: '#505050',
                lineHeight: '1.2em',
                marginBottom: '0.5rem'
              }}
            >
              En panne <span style={{ color: '#37b5f5' }}>d&apos;inspiration ?</span>
            </h2>
            <p
              style={{
                fontFamily: 'var(--font-sans), Arial, sans-serif',
                fontWeight: 400,
                color: '#505050'
              }}
            >
              Découvrez quelques idées de séjours
            </p>
          </motion.div>

          <div className="mt-10">
            <div className="relative">
              <div ref={inspiViewportRef} className="min-w-0 overflow-hidden">
                <div
                  className={`flex ${
                    inspiTransitionEnabled ? 'transition-transform duration-700 ease-out' : 'transition-none'
                  }`}
                  onTransitionEnd={(event) => {
                    if (event.target !== event.currentTarget || event.propertyName !== 'transform') {
                      return;
                    }

                    handleInspiTransitionEnd();
                  }}
                  style={{
                    transform: `translateX(-${inspiIndex * inspiStepPx}px)`,
                    gap: `${inspiGapPx}px`
                  }}
                >
                  {inspiLoopCards.map((card, index) => (
                    <Link
                      key={`${card.src}-${index}`}
                      href={card.href}
                      title={`Découvrir : ${card.title}`}
                      className="group relative block shrink-0 cursor-pointer overflow-hidden rounded-[14px] bg-slate-100 shadow-md focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-300 focus-visible:ring-offset-2"
                      style={{ width: inspiCardWidthPx > 0 ? `${inspiCardWidthPx}px` : '100%' }}
                    >
                      <div className="relative aspect-[4/5]">
                        <Image
                          src={card.src}
                          alt={card.alt}
                          fill
                          className="object-cover"
                          sizes="(max-width: 640px) 100vw, (max-width: 1024px) 50vw, 33vw"
                        />
                        <div className="absolute inset-0 bg-gradient-to-t from-black/70 via-black/35 to-black/10 opacity-100 transition-opacity duration-300 sm:opacity-0 sm:group-hover:opacity-100" />
                        <div className="absolute inset-0 flex flex-col justify-end p-4 opacity-100 transition-opacity duration-300 sm:p-5 sm:opacity-0 sm:group-hover:opacity-100">
                          <h3
                            className="text-2xl sm:text-[32px]"
                            style={{
                              fontWeight: 700,
                              color: '#FFFFFF',
                              textShadow: '0em 0em 0.3em rgba(0,0,0,0.4)',
                              lineHeight: '1.1em'
                            }}
                          >
                            {card.title}
                          </h3>
                          <p
                            style={{
                              color: '#FFFFFF',
                              fontFamily: 'var(--font-sans), Arial, sans-serif',
                              fontWeight: 400
                            }}
                            className="mt-3 text-sm leading-6"
                          >
                            {card.description}
                          </p>
                          <span className="cta-orange-sweep mt-4 inline-flex w-fit items-center gap-2 rounded-xl px-4 py-2 text-sm font-semibold text-white">
                            Découvrir
                            <ArrowRight size={16} />
                          </span>
                        </div>
                      </div>
                    </Link>
                  ))}
                </div>
              </div>
              {inspiCardsPerView < inspiCards.length && (
                <>
                  <button
                    type="button"
                    onClick={showPreviousInspiCard}
                    className="absolute left-0 top-1/2 z-10 flex h-10 w-10 -translate-x-[calc(100%+12px)] -translate-y-1/2 items-center justify-center rounded-full bg-white/92 text-[#505050] shadow-md transition hover:bg-white sm:h-11 sm:w-11"
                    aria-label="Card précédente"
                  >
                    <ChevronLeft size={18} />
                  </button>
                  <button
                    type="button"
                    onClick={showNextInspiCard}
                    className="absolute right-0 top-1/2 z-10 flex h-10 w-10 translate-x-[calc(100%+12px)] -translate-y-1/2 items-center justify-center rounded-full bg-white/92 text-[#505050] shadow-md transition hover:bg-white sm:h-11 sm:w-11"
                    aria-label="Card suivante"
                  >
                    <ChevronRight size={18} />
                  </button>
                </>
              )}
            </div>
          </div>
        </div>
      </section>

      {/* ── Comment ça marche ── */}
      <section id="comment-ca-marche" className="bg-slate-50 pb-16 pt-8 sm:pb-24 sm:pt-10">
        <div className="section-container text-center">
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
          >
            <span
              style={{
                fontWeight: 700,
                textTransform: 'uppercase',
                fontSize: '15px',
                color: '#505050',
                lineHeight: '1.7em'
              }}
            >
              NOTICE
            </span>
            <h2
              className="mt-1 text-4xl sm:text-5xl"
              style={{
                fontWeight: 700,
                color: '#505050',
                lineHeight: '1.2em',
                marginBottom: 0
              }}
            >
              RESACOLO,<span style={{ color: '#37b5f4' }}> comment ça marche ?</span>
            </h2>
            <p
              className="mt-2"
              style={{
                color: '#474747',
                fontWeight: 400
              }}
            >
              Comprendre notre processus d’inscription
            </p>
          </motion.div>

          <div className="mt-14 grid gap-8 sm:grid-cols-3">
            {processSteps.map((step, i) => (
              <motion.div
                key={i}
                className="resacolo-card flex flex-col items-center text-center gap-4"
                custom={i}
                initial="hidden"
                whileInView="visible"
                viewport={{ once: true }}
                variants={fadeUp}
              >
                <div className="flex h-20 w-20 items-center justify-center">
                  <Image
                    src={step.gifSrc}
                    alt={step.gifAlt}
                    width={80}
                    height={80}
                    unoptimized
                    className="h-20 w-20 object-contain"
                  />
                </div>
                <h3 className="font-display text-lg font-bold text-slate-900">{step.title}</h3>
                <p className="text-slate-500 text-sm">{step.desc}</p>
              </motion.div>
            ))}
          </div>

          <motion.div
            className="mt-12"
            initial={{ opacity: 0 }}
            whileInView={{ opacity: 1 }}
            viewport={{ once: true }}
          >
            <Link
              href="/faq"
              className="cta-orange-sweep inline-flex items-center gap-2 rounded-xl px-6 py-3 font-semibold text-white shadow-md"
            >
              Commencer
              <ChevronRight className="h-4 w-4" />
            </Link>
          </motion.div>
        </div>
      </section>

      {/* ── Destination France ── */}
      <section id="destination-france" className="bg-white pb-16 pt-8 sm:pb-24 sm:pt-10">
        <div className="section-container">
          <div className="space-y-8">
            <motion.div
              className="flex flex-col items-center text-center"
              initial={{ opacity: 0, y: 20 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
            >
              <h2
                className="text-4xl sm:text-5xl"
                style={{
                  fontWeight: 700,
                  color: '#505050',
                  lineHeight: '1.1em',
                  marginBottom: 0,
                  textAlign: 'center'
                }}
              >
                Trouver un séjour
              </h2>

              <div className="mt-6 flex flex-wrap items-center justify-center gap-4">
                <button
                  type="button"
                  onClick={() => setDestinationMap('france')}
                  className="rounded-full border px-6 py-3 text-base font-semibold transition hover:opacity-90"
                  style={{
                    backgroundColor: destinationMap === 'france' ? '#37b5f5' : '#ffffff',
                    color: destinationMap === 'france' ? '#ffffff' : '#37b5f5',
                    borderColor: '#37b5f5'
                  }}
                >
                  En France
                </button>
                <button
                  type="button"
                  onClick={() => setDestinationMap('world')}
                  className="rounded-full border px-6 py-3 text-base font-semibold transition hover:opacity-90"
                  style={{
                    backgroundColor: destinationMap === 'world' ? '#37b5f5' : '#ffffff',
                    color: destinationMap === 'world' ? '#ffffff' : '#37b5f5',
                    borderColor: '#37b5f5'
                  }}
                >
                  À l&apos;étranger
                </button>
              </div>
            </motion.div>

            <motion.div
              initial={{ opacity: 0, y: 20 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
            >
              {destinationMap === 'france' ? (
                <div className="bg-transparent p-0 shadow-none">
                  <FranceRegionsMap />
                </div>
              ) : (
                <WorldMap onFranceSelect={() => setDestinationMap('france')} />
              )}
            </motion.div>
          </div>
        </div>
      </section>

      {/* ── Aides financières ── */}
      <section id="financement" className="relative overflow-hidden bg-[#fbfcff] py-10 sm:py-14">
        <div className="pointer-events-none absolute inset-0 z-0 opacity-[0.04]" aria-hidden="true">
          <Image
            src="/image/accueil/images_accueil/fonds_euro.png"
            alt=""
            fill
            className="object-contain object-center scale-110"
            sizes="100vw"
            style={{
              filter: 'grayscale(1) brightness(1.08) sepia(1) hue-rotate(170deg) saturate(450%)'
            }}
          />
        </div>

        <div className="section-container relative z-10">
          <div className="grid items-start gap-8 lg:grid-cols-2">
            <motion.div
              className="max-w-xl self-center text-left"
              initial={{ opacity: 0, x: -20 }}
              whileInView={{ opacity: 1, x: 0 }}
              viewport={{ once: true }}
            >
              <span
                style={{
                  fontWeight: 700,
                  textTransform: 'uppercase',
                  fontSize: '15px',
                  color: '#505050',
                  lineHeight: '1.7em',
                  display: 'block',
                  textAlign: 'left'
                }}
              >
                Coup de pouce
              </span>
              <h2
                className="mt-1 text-4xl sm:text-[44px]"
                style={{
                  fontWeight: 700,
                  color: '#505050',
                  lineHeight: '1.2em',
                  marginBottom: '1.25rem',
                  textAlign: 'left'
                }}
              >
                Solliciter une
                <br />
                <span style={{ color: '#37b5f4' }}>participation financière</span>
              </h2>
              <p
                style={{
                  fontFamily: 'var(--font-primary, var(--font-body))',
                  fontWeight: 400,
                  color: 'var(--color-text, var(--resacolo-ink))',
                  textAlign: 'left'
                }}
              >
                De nombreux dispositifs existent pour obtenir des aides et ainsi minimiser le coût de la colonie de
                vacances. N&apos;hésitez pas vous renseigner en contactant :
              </p>
            </motion.div>

            <div className="grid gap-x-4 gap-y-0 sm:grid-cols-2">
              <div className="flex flex-col gap-3">
                {leftAids.map((aid, i) => (
                  <motion.div
                    key={aid.label}
                    className="resacolo-card flex h-[118px] w-full flex-col items-center justify-center gap-1.5 !px-4 !py-3 text-center"
                    initial={{ opacity: 0, y: 20 }}
                    whileInView={{ opacity: 1, y: 0 }}
                    viewport={{ once: true }}
                    transition={{ delay: i * 0.1 }}
                  >
                    {aid.logoSrc ? (
                      <div className="flex h-10 w-24 shrink-0 items-center justify-center">
                        <Image
                          src={aid.logoSrc}
                          alt={aid.logoAlt ?? aid.label}
                          width={92}
                          height={52}
                          className="max-h-10 w-auto object-contain"
                        />
                      </div>
                    ) : (
                      <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-accent-50 text-accent-500">
                        <aid.icon size={19} />
                      </div>
                    )}
                    <span className="text-sm font-extrabold !text-[#505050]">{aid.label}</span>
                  </motion.div>
                ))}
              </div>

              <div className="flex flex-col gap-3 sm:pt-8">
                {rightAids.map((aid, i) => (
                  <motion.a
                    key={aid.label}
                    href={aid.href}
                    target="_blank"
                    rel="noreferrer"
                    className="aid-card-sweep resacolo-card flex h-[118px] w-full cursor-pointer flex-col items-center justify-center gap-1.5 !px-4 !py-3 text-center"
                    initial={{ opacity: 0, y: 20 }}
                    whileInView={{ opacity: 1, y: 0 }}
                    viewport={{ once: true }}
                    transition={{ delay: i * 0.1 }}
                  >
                    {aid.logoSrc ? (
                      <div className="flex h-10 w-24 shrink-0 items-center justify-center">
                        <Image
                          src={aid.logoSrc}
                          alt={aid.logoAlt ?? aid.label}
                          width={92}
                          height={52}
                          className="max-h-10 w-auto object-contain"
                        />
                      </div>
                    ) : (
                      <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-accent-50 text-accent-500">
                        <aid.icon size={19} />
                      </div>
                    )}
                    <span className="text-sm font-extrabold text-[#505050]">{aid.label}</span>
                  </motion.a>
                ))}
              </div>
            </div>
          </div>
        </div>

      </section>

      {/* ── Contact ── */}
      <section id="contact" className="section-padding bg-slate-50">
        <div className="section-container flex justify-center">
          <Link
            href="/contact"
            className="cta-orange-sweep inline-flex items-center justify-center rounded-full px-10 py-4 text-base font-bold uppercase tracking-widest text-white shadow-[0_16px_30px_-18px_rgba(250,133,0,0.7)] transition"
          >
            Nous contacter
          </Link>
        </div>
      </section>
    </div>
  );
}
