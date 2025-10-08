import Link from 'next/link';
import Image from 'next/image';
import {
  ArrowLeft,
  ArrowRight,
  Award,
  BookOpen,
  Building2,
  CheckCircle2,
  ClipboardList,
  Compass,
  Map,
  Mountain,
  Pointer,
  Palette,
  PawPrint,
  ShieldCheck,
  Sparkles,
  Waves
} from 'lucide-react';

const heroFilters = [
  { label: 'Saison', placeholder: 'Choisir une saison' },
  { label: 'Type de séjour', placeholder: 'Colonies, stages...' },
  { label: 'Âge du participant', placeholder: '4 - 25 ans' },
  { label: 'Tarif', placeholder: 'Budget estimé' }
];

const offerItems = [
  {
    title: 'Authenticité',
    description: '100 % des séjours conçus et organisés par des opérateurs producteurs',
    icon: Award
  },
  {
    title: 'Savoir-faire',
    description: 'De 5 à 75 ans d’expérience dans le secteur des accueils collectifs de mineurs',
    icon: Sparkles
  },
  {
    title: 'Engagement',
    description: 'La sécurité et l’épanouissement des enfants comme premières préoccupations',
    icon: ShieldCheck
  }
];

const steps = [
  {
    title: '1. Choisir un séjour',
    description:
      'Trouvez la destination et les activités idéales pour votre enfant et consultez la fiche détaillée du séjour sur notre plateforme.',
    icon: Pointer
  },
  {
    title: '2. S’inscrire',
    description:
      'Choisissez vos options (dates, transport, activités), saisissez vos informations personnelles puis transmettez votre réservation à l’organisateur.',
    icon: ClipboardList
  },
  {
    title: '3. Valider votre réservation',
    description:
      'L’organisateur vous contacte pour finaliser l’inscription de votre enfant et préparer sereinement son départ en séjour.',
    icon: CheckCircle2
  }
];

const thematics = [
  {
    title: 'Activités ANIMAUX',
    description: 'Animaux, ferme, parcs animaliers, zoo, cani-rando...',
    icon: PawPrint
  },
  {
    title: 'Activités AQUATIQUES',
    description: 'Plongée, snorkeling, natation, baignade, piscine, parc aquatique...',
    icon: Waves
  },
  {
    title: 'Activités ARTISTIQUES',
    description: 'Danse, théâtre, chant, musique, hip-hop, graff, peinture, cirque...',
    icon: Palette
  },
  {
    title: 'Activités AVENTURE - PLEIN AIR',
    description: 'Randonnées, accrobranche, vélo, tir à l’arc, escalade, via ferrata...',
    icon: Mountain
  },
  {
    title: 'Activités CULTURE - DÉCOUVERTE',
    description: 'Circuits itinérants, city-trip, voyage solidaire, langues étrangères...',
    icon: Building2
  }
];

const manifestoPoints = [
  {
    title: '1er site conçu par un collectif d’organisateurs',
    highlight: '1er site'
  },
  {
    title: 'Réservation en circuit court sans intermédiaire',
    highlight: 'circuit court'
  },
  {
    title: 'Une offre riche et variée issue d’opérateurs reconnus',
    highlight: 'offre riche et variée'
  }
];

export default function HomePage() {
  return (
    <div className="bg-white text-slate-900">
      <HeroSection />
      <OfferSection />
      <ProcessSection />
      <DestinationSection />
      <ThematicsSection />
      <ManifestoSection />
    </div>
  );
}

function HeroSection() {
  return (
    <section className="relative overflow-hidden">
      <div className="absolute inset-0 bg-[radial-gradient(circle_at_top,_#e1f2ff,_transparent)]" />
      <div className="absolute right-[-120px] top-12 hidden h-40 w-40 rotate-6 rounded-full bg-accent-400 blur-3xl lg:block" />
      <div className="absolute left-[-120px] top-64 hidden h-48 w-48 -rotate-12 rounded-full bg-brand-200 blur-3xl lg:block" />
      <div className="mx-auto flex max-w-6xl flex-col gap-16 px-6 pb-24 pt-24 lg:flex-row lg:items-center">
        <div className="max-w-xl space-y-6">
          <span className="inline-flex items-center gap-2 rounded-full bg-brand-100 px-4 py-1 text-sm font-semibold text-brand-600">
            Prêt pour un nouveau départ ?
          </span>
          <h1 className="font-display text-4xl font-semibold leading-tight text-slate-900 sm:text-5xl lg:text-6xl">
            Colonies de vacances de 4 à 17 ans et séjours jeunes adultes de 18 à 25 ans.
          </h1>
          <p className="text-lg text-slate-600">
            Resacolo réunit les colonies de vacances conçues par un collectif d’organisateurs engagés. Inspirez-vous,
            comparez et trouvez le séjour idéal en quelques clics.
          </p>
          <div className="flex flex-wrap gap-3">
            <Link
              href="/sejours"
              className="inline-flex items-center gap-2 rounded-full bg-brand-500 px-6 py-3 text-sm font-semibold text-white shadow-brand transition hover:bg-brand-600"
            >
              Explorer les séjours
              <ArrowRight className="h-4 w-4" />
            </Link>
            <Link
              href="/contact"
              className="inline-flex items-center gap-2 rounded-full border border-accent-400 px-6 py-3 text-sm font-semibold text-accent-500 transition hover:bg-accent-500 hover:text-white"
            >
              Devenir partenaire
            </Link>
          </div>
        </div>

        <div className="relative flex w-full flex-1 justify-center lg:justify-end">
          <div className="relative w-full max-w-lg">
            <div className="absolute -right-6 top-8 hidden rounded-3xl bg-white/70 p-3 shadow-brand lg:block">
              <Image
                src="https://images.unsplash.com/photo-1578198576814-8f1dff252730?auto=format&fit=crop&w=360&q=80"
                alt="Jeunes en colonie de vacances"
                width={180}
                height={220}
                className="h-48 w-40 rounded-3xl object-cover"
              />
            </div>
            <div className="overflow-hidden rounded-[36px] shadow-brand">
              <Image
                src="https://images.unsplash.com/photo-1523419409543-0c1df022bdd1?auto=format&fit=crop&w=900&q=80"
                alt="Groupe d’enfants en colonie"
                width={640}
                height={420}
                className="h-[380px] w-full object-cover"
                priority
              />
            </div>
            <div className="absolute -bottom-6 left-6 hidden rounded-3xl bg-white/80 p-4 shadow-brand md:block">
              <div className="flex items-center gap-3">
                <div className="rounded-full bg-brand-100 p-2 text-brand-500">
                  <Compass className="h-5 w-5" />
                </div>
                <div>
                  <p className="text-sm font-semibold text-slate-700">15 000+ séjours référencés</p>
                  <p className="text-xs text-slate-500">Mise à jour chaque semaine</p>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>

      <div className="mx-auto -mt-16 w-full max-w-5xl rounded-[36px] bg-white/90 p-6 shadow-brand backdrop-blur-md">
        <div className="grid gap-4 md:grid-cols-4 md:gap-6 lg:grid-cols-[repeat(5,minmax(0,1fr))]">
          {heroFilters.map((filter) => (
            <div key={filter.label} className="space-y-2">
              <label className="text-xs font-semibold uppercase tracking-wide text-slate-500">{filter.label}</label>
              <button className="flex w-full items-center justify-between rounded-2xl border border-slate-200 bg-white px-5 py-3 text-left text-sm font-medium text-slate-600 shadow-sm hover:border-brand-200 hover:text-brand-500">
                <span>{filter.placeholder}</span>
                <ArrowRight className="h-4 w-4 text-brand-400" />
              </button>
            </div>
          ))}
          <div className="space-y-2">
            <label className="text-xs font-semibold uppercase tracking-wide text-transparent select-none">Go</label>
            <button className="flex w-full items-center justify-center rounded-2xl border border-slate-200 bg-accent-500 px-5 py-3 text-sm font-semibold text-white shadow-sm transition hover:bg-accent-600">
              GO&nbsp;!
            </button>
          </div>
        </div>
      </div>
    </section>
  );
}

function OfferSection() {
  return (
    <section className="relative mt-28 bg-brand-300/80 py-20">
      <div className="absolute right-10 top-10 hidden h-32 w-32 rotate-12 rounded-full bg-accent-400 blur-3xl md:block" />
      <div className="absolute bottom-10 left-8 hidden h-24 w-24 -rotate-12 rounded-full bg-accent-300 blur-3xl md:block" />
      <div className="mx-auto max-w-6xl px-6 text-center text-white">
        <h2 className="font-display text-3xl font-semibold sm:text-4xl">Ce que Resacolo vous offre</h2>
        <div className="mt-12 grid gap-8 md:grid-cols-3">
          {offerItems.map((offer) => (
            <article key={offer.title} className="flex flex-col items-center gap-4 text-center">
              <div className="flex h-24 w-24 items-center justify-center rounded-3xl bg-white/90 shadow-brand">
                <offer.icon className="h-12 w-12 text-accent-500" />
              </div>
              <h3 className="text-xl font-semibold">{offer.title}</h3>
              <p className="text-sm leading-relaxed text-white/90">{offer.description}</p>
            </article>
          ))}
        </div>
      </div>
    </section>
  );
}

function ProcessSection() {
  return (
    <section id="guide" className="bg-slate-50 py-20">
      <div className="mx-auto max-w-5xl px-6 text-center">
        <span className="text-xs font-semibold uppercase tracking-[0.3em] text-slate-400">Notice</span>
        <h2 className="mt-4 font-display text-4xl font-semibold text-slate-900">
          Resacolo, <span className="text-brand-500">comment ça marche ?</span>
        </h2>
        <p className="mt-4 text-base text-slate-500">Comprendre notre processus d’inscription</p>
        <div className="mt-12 grid gap-10 text-left md:grid-cols-3">
          {steps.map((step) => (
            <div key={step.title} className="flex flex-col items-center gap-5 text-center">
              <div className="relative flex h-20 w-20 items-center justify-center rounded-full bg-white text-brand-500 shadow-brand">
                <step.icon className="h-10 w-10" />
              </div>
              <h3 className="text-lg font-semibold text-slate-900">{step.title}</h3>
              <p className="text-sm leading-relaxed text-slate-500">{step.description}</p>
            </div>
          ))}
        </div>
        <div className="mt-10 flex justify-center">
          <Link
            href="/ressources"
            className="inline-flex items-center gap-2 rounded-full bg-accent-500 px-6 py-3 text-sm font-semibold text-white shadow-brand transition hover:bg-accent-600"
          >
            En savoir plus
            <ArrowRight className="h-4 w-4" />
          </Link>
        </div>
      </div>
    </section>
  );
}

function DestinationSection() {
  return (
    <section className="mx-auto flex max-w-6xl flex-col gap-12 px-6 py-20 lg:flex-row lg:items-center">
      <div className="flex-1 space-y-4">
        <span className="text-xs font-semibold uppercase tracking-[0.3em] text-slate-400">Destination</span>
        <h2 className="font-display text-4xl font-semibold leading-tight text-slate-900">
          Trouver votre séjour en <span className="text-brand-500">France</span>
        </h2>
        <p className="text-base leading-relaxed text-slate-500">
          Cliquez sur une région pour découvrir les séjours qu’elle accueille. Chaque fiche rassemble les informations
          essentielles pour préparer le départ de votre enfant en toute confiance.
        </p>
        <div className="mt-6 flex gap-3">
          <button className="flex h-10 w-10 items-center justify-center rounded-full border border-slate-200 text-slate-500 transition hover:border-brand-200 hover:text-brand-500">
            <ArrowLeft className="h-4 w-4" />
          </button>
          <button className="flex h-10 w-10 items-center justify-center rounded-full border border-slate-200 text-slate-500 transition hover:border-brand-200 hover:text-brand-500">
            <ArrowRight className="h-4 w-4" />
          </button>
        </div>
      </div>
      <div className="flex-1">
        <div className="overflow-hidden rounded-[36px] border border-slate-100 bg-white shadow-brand">
          <Image
            src="https://images.unsplash.com/photo-1578575437130-527eed3abbec?auto=format&fit=crop&w=900&q=80"
            alt="Carte des régions françaises"
            width={800}
            height={520}
            className="h-full w-full object-cover"
          />
        </div>
      </div>
    </section>
  );
}

function ThematicsSection() {
  return (
    <section className="relative overflow-hidden bg-white py-20">
      <div className="absolute right-24 top-0 hidden h-56 w-56 rounded-full bg-brand-100 blur-3xl lg:block" />
      <div className="absolute bottom-0 left-16 hidden h-48 w-48 rounded-full bg-accent-200 blur-3xl lg:block" />
      <div className="mx-auto flex max-w-6xl flex-col gap-12 px-6 lg:flex-row lg:items-center">
        <div className="flex-1 space-y-4">
          <span className="text-xs font-semibold uppercase tracking-[0.3em] text-slate-400">Activités</span>
          <h2 className="font-display text-4xl font-semibold text-slate-900">
            Choisir votre <span className="text-brand-500">thématique</span>
          </h2>
          <p className="text-base text-slate-500">
            Sélectionnez un type d’activités et découvrez toutes les opportunités proposées par les organisateurs
            Resacolo.
          </p>
        </div>
        <div className="flex-1 space-y-6">
          <div className="grid gap-6 md:grid-cols-2">
            {thematics.map((thematic) => (
              <div
                key={thematic.title}
                className="flex h-full flex-col gap-4 rounded-3xl border border-slate-100 bg-white p-6 shadow-md transition hover:-translate-y-1 hover:shadow-brand"
              >
                <div className="inline-flex h-12 w-12 items-center justify-center rounded-2xl bg-accent-100 text-accent-500">
                  <thematic.icon className="h-6 w-6" />
                </div>
                <h3 className="text-base font-semibold text-slate-900">{thematic.title}</h3>
                <p className="text-sm leading-relaxed text-slate-500">{thematic.description}</p>
              </div>
            ))}
          </div>
          <div className="rounded-[32px] border border-slate-100 bg-slate-50 p-6 shadow-inner">
            <div className="flex items-center gap-4">
              <div className="rounded-full bg-white p-3 text-brand-500 shadow-md">
                <Map className="h-6 w-6" />
              </div>
              <div>
                <p className="font-semibold text-slate-800">+40 thématiques disponibles</p>
                <p className="text-sm text-slate-500">Sport, nature, culture, études, voyages solidaires…</p>
              </div>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}

function ManifestoSection() {
  return (
    <section id="faq" className="bg-slate-50 py-20">
      <div className="mx-auto max-w-6xl px-6">
        <div className="grid gap-12 lg:grid-cols-[1.2fr_1fr]">
          <div className="space-y-6">
            <div className="flex gap-4">
              <span className="w-2 rounded-full bg-brand-400" />
              <h2 className="font-display text-4xl font-semibold leading-tight text-slate-900">
                Les organisateurs de colos réunis vous offrent leur savoir-faire{' '}
                <span className="text-brand-500">pour faire grandir vos enfants.</span>
              </h2>
            </div>
            <ul className="space-y-4">
              {manifestoPoints.map((point) => (
                <li key={point.title} className="flex items-start gap-4 text-slate-600">
                  <div className="mt-1 rounded-full bg-accent-100 p-2 text-accent-500">
                    <BookOpen className="h-4 w-4" />
                  </div>
                  <p className="text-base leading-relaxed">
                    <span className="font-semibold text-accent-500">{point.highlight}</span>{' '}
                    {point.title.replace(point.highlight, '').trim()}
                  </p>
                </li>
              ))}
            </ul>
          </div>
          <div className="rounded-[36px] border border-slate-100 bg-white p-8 shadow-brand">
            <p className="text-sm font-semibold uppercase tracking-[0.3em] text-slate-400">Ils nous font confiance</p>
            <div className="mt-6 grid grid-cols-2 gap-6 text-center text-sm font-semibold text-slate-500">
              {['Eole Loisirs', 'Les Colos du Bonheur', 'Equifun', 'Zigo Tours'].map((partner) => (
                <div key={partner} className="rounded-2xl border border-slate-100 bg-slate-50 px-4 py-6 shadow-sm">
                  {partner}
                </div>
              ))}
            </div>
            <div className="mt-8 rounded-3xl bg-brand-50 p-5 text-center text-sm text-brand-600">
              Rejoignez le collectif Resacolo et valorisez vos séjours auprès de milliers de familles.
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}
