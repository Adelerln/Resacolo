import Link from 'next/link';
import Image from 'next/image';
import {
  Monitor,
  ArrowLeftRight,
  Star,
  PawPrint,
  Waves,
  Palette,
  Mountain,
  Building2,
  Pointer,
  ClipboardList,
  CheckCircle2,
  ChevronRight,
  Briefcase,
  Landmark,
  Building,
  Gift,
  Ticket
} from 'lucide-react';

const themes = [
  { title: 'Animaux', icon: PawPrint },
  { title: 'Aquatiques', icon: Waves },
  { title: 'Artistiques', icon: Palette },
  { title: 'Aventure', icon: Mountain },
  { title: 'Culture', icon: Building2 }
];

const processSteps = [
  {
    title: 'Choisir',
    description: 'Trouvez la destination, les activités idéales…',
    icon: Pointer
  },
  {
    title: "S'inscrire",
    description: 'Choisissez vos options, saisissez vos informations…',
    icon: ClipboardList
  },
  {
    title: 'Valider',
    description: "L'organisateur se met en relation avec vous…",
    icon: CheckCircle2
  }
];

const financialPartners = [
  { label: 'Employeur / CSE', icon: Briefcase },
  { label: 'CAF', icon: Landmark },
  { label: 'Collectivité (Mairie/Région)', icon: Building },
  { label: 'JPA', icon: Gift },
  { label: 'ANCV (Chèque-Vacances)', icon: Ticket }
];

export default function HomePage() {
  return (
    <div className="bg-[#FFFFFF] text-slate-900">
      <HeroBanner />
      <ValuePropositionSection />
      <ThemesSection />
      <ProcessSection />
      <FinancialAidSection />
    </div>
  );
}

function HeroBanner() {
  return (
    <section className="relative w-full overflow-hidden bg-[#FFFFFF]">
      <div className="mx-auto flex w-full max-w-6xl flex-col items-center gap-10 px-4 py-16 sm:px-6 md:py-20 lg:py-24">
        <div className="text-center">
          <h1 className="font-display text-4xl font-bold tracking-tight text-slate-900 sm:text-5xl lg:text-6xl">
            ResaColo
          </h1>
          <p className="mt-4 max-w-2xl text-lg text-slate-600">
            Trouvez la colonie de vacances idéale pour vos enfants. Un collectif d&apos;organisateurs à votre service.
          </p>
        </div>

      </div>
    </section>
  );
}

function ValuePropositionSection() {
  const benefits = [
    {
      text: '1er site conçu par un collectif d\'organisateurs',
      icon: Monitor
    },
    {
      text: 'Réservation en circuit court sans intermédiaire',
      icon: ArrowLeftRight
    },
    {
      text: 'Une offre riche et variée issue d\'opérateurs reconnus',
      icon: Star
    }
  ];

  return (
    <section className="w-full bg-[#FFFFFF] py-16 md:py-20">
      <div className="mx-auto max-w-6xl px-4 sm:px-6">
        <h2 className="mb-10 text-center text-2xl font-semibold text-slate-800 md:mb-12 md:text-3xl">
          Pourquoi choisir Resacolo ?
        </h2>
        <div className="grid gap-12 lg:grid-cols-2 lg:items-center">
          <div>
            <p className="text-lg leading-relaxed text-slate-700 md:text-xl">
              Les organisateurs de colos réunis vous offrent leur savoir-faire{' '}
              <strong className="text-slate-900">pour faire grandir vos enfants</strong>.
            </p>
          </div>
          <div className="flex flex-col gap-6">
            {benefits.map((item) => (
              <div
                key={item.text}
                className="flex items-start gap-4 rounded-xl bg-white p-4 shadow-md ring-1 ring-slate-100"
              >
                <div className="flex h-12 w-12 flex-shrink-0 items-center justify-center rounded-xl bg-[#3B82F6]/10 text-[#3B82F6]">
                  <item.icon className="h-6 w-6" />
                </div>
                <p className="pt-1 text-slate-700">
                  {item.text === "1er site conçu par un collectif d'organisateurs" && (
                    <>1er site conçu par un collectif d&apos;organisateurs.</>
                  )}
                  {item.text === 'Réservation en circuit court sans intermédiaire' && (
                    <>
                      Réservation en <strong>circuit court</strong> sans intermédiaire.
                    </>
                  )}
                  {item.text === "Une offre riche et variée issue d'opérateurs reconnus" && (
                    <>
                      Une <strong>offre riche et variée</strong> issue d&apos;opérateurs reconnus.
                    </>
                  )}
                </p>
              </div>
            ))}
          </div>
        </div>
      </div>
    </section>
  );
}

function ThemesSection() {
  return (
    <section className="w-full bg-[#FFFFFF] py-16 md:py-20">
      <div className="mx-auto max-w-6xl px-4 sm:px-6">
        <h2 className="mb-8 text-2xl font-semibold text-slate-900 md:mb-10 md:text-3xl">
          Choisir votre <span className="text-[#3B82F6]">thématique</span>
        </h2>

        <div className="flex flex-col gap-10 lg:flex-col-reverse">
          <div className="w-full lg:flex lg:justify-end">
            <div className="grid aspect-[16/10] w-full grid-cols-2 grid-rows-2 gap-2 overflow-hidden rounded-xl lg:aspect-auto lg:h-56 lg:w-[55%] lg:rounded-2xl">
              <div className="relative">
                <Image
                  src="https://images.unsplash.com/photo-1503454537195-1dcabb73ffb9?auto=format&fit=crop&w=400&q=80"
                  alt="Enfants en colonie"
                  fill
                  className="object-cover"
                  sizes="(max-width: 1024px) 50vw, 27vw"
                />
              </div>
              <div className="relative">
                <Image
                  src="https://images.unsplash.com/photo-1523419409543-0c1df022bdd1?auto=format&fit=crop&w=400&q=80"
                  alt="Groupe en colo"
                  fill
                  className="object-cover"
                  sizes="(max-width: 1024px) 50vw, 27vw"
                />
              </div>
              <div className="relative col-span-2">
                <Image
                  src="https://images.unsplash.com/photo-1578198576814-8f1dff252730?auto=format&fit=crop&w=800&q=80"
                  alt="Activités en colo"
                  fill
                  className="object-cover"
                  sizes="(max-width: 1024px) 100vw, 55vw"
                />
              </div>
            </div>
          </div>

          <div className="overflow-x-auto pb-2 lg:overflow-visible">
            <div className="flex gap-4 lg:flex-wrap lg:justify-start" style={{ minWidth: 'min-content' }}>
              {themes.map((theme) => (
                <div
                  key={theme.title}
                  className="flex min-w-[180px] flex-col items-center gap-4 rounded-xl bg-white p-6 shadow-lg ring-1 ring-slate-100 transition hover:shadow-xl sm:min-w-[200px]"
                >
                  <div className="flex h-16 w-16 items-center justify-center rounded-xl bg-[#F97316]/15 text-[#F97316]">
                    <theme.icon className="h-8 w-8" />
                  </div>
                  <h3 className="text-center font-semibold text-slate-800">{theme.title}</h3>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}

function ProcessSection() {
  return (
    <section className="w-full bg-[#FFFFFF] py-16 md:py-20">
      <div className="mx-auto max-w-6xl px-4 sm:px-6">
        <h2 className="mb-12 text-center text-2xl font-semibold text-slate-900 md:text-3xl">
          RESACOLO, <span className="text-[#3B82F6]">comment ça marche ?</span>
        </h2>
        <div className="grid gap-10 md:grid-cols-3">
          {processSteps.map((step) => (
            <div
              key={step.title}
              className="flex flex-col items-center rounded-xl bg-white p-6 text-center shadow-md ring-1 ring-slate-100"
            >
              <div className="flex h-14 w-14 items-center justify-center rounded-xl bg-[#3B82F6]/10 text-[#3B82F6]">
                <step.icon className="h-7 w-7" />
              </div>
              <h3 className="mt-4 font-semibold text-slate-900">{step.title}</h3>
              <p className="mt-2 text-sm text-slate-600">{step.description}</p>
            </div>
          ))}
        </div>
        <div className="mt-12 flex justify-center">
          <Link
            href="/faq"
            className="inline-flex items-center gap-2 rounded-xl bg-[#F97316] px-6 py-3 font-semibold text-white shadow-md transition hover:bg-[#ea580c]"
          >
            En savoir plus
            <ChevronRight className="h-4 w-4" />
          </Link>
        </div>
      </div>
    </section>
  );
}

function FinancialAidSection() {
  return (
    <section className="relative w-full overflow-hidden bg-[#FFFFFF] py-16 md:py-20">
      <div
        className="absolute inset-0 opacity-[0.03]"
        style={{
          backgroundImage: `url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 40 40'%3E%3Ctext x='0' y='28' font-size='24' fill='%23000'%3E€%3C/text%3E%3C/svg%3E")`
        }}
      />
      <div className="relative mx-auto max-w-6xl px-4 sm:px-6">
        <span className="block text-center text-xs font-semibold uppercase tracking-widest text-slate-400">
          COUP DE POUCE
        </span>
        <h2 className="mt-2 text-center text-2xl font-semibold text-slate-900 md:text-3xl">
          Des solutions pour financer votre séjour
        </h2>

        <div className="mt-12 grid gap-10 lg:grid-cols-[30%_1fr] lg:items-start">
          <div className="lg:sticky lg:top-8">
            <p className="text-slate-700 leading-relaxed">
              De nombreux dispositifs existent pour obtenir des aides et minimiser le coût de votre séjour. Employeur,
              CAF, mairie, JPA, chèques-vacances… découvrez les partenaires et aides disponibles.
            </p>
          </div>
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-2">
            {financialPartners.map((partner) => (
              <div
                key={partner.label}
                className="flex flex-col items-center justify-center gap-3 rounded-xl bg-white p-6 shadow-md ring-1 ring-slate-100"
              >
                <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-[#3B82F6]/10 text-[#3B82F6]">
                  <partner.icon className="h-6 w-6" />
                </div>
                <span className="text-center text-sm font-medium text-slate-800">{partner.label}</span>
              </div>
            ))}
          </div>
        </div>
      </div>
    </section>
  );
}
