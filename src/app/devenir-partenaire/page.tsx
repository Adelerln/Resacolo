import type { Metadata } from 'next';
import {
  Award,
  Check,
  CheckSquare,
  ChevronDown,
  Coffee,
  Euro,
  FileSignature,
  Gift,
  Heart,
  Home,
  Megaphone,
  SlidersHorizontal,
  Sparkles,
  Search,
  Sun,
  Users,
  PenBox
} from 'lucide-react';

export const metadata: Metadata = {
  title: 'Devenir Partenaire | Resacolo',
  description:
    "Découvrez les conditions de partenariat Resacolo pour CSE et collectivités, et nos formules 100% gratuites."
};

const processSteps = [
  {
    icon: Search,
    title: '1. Découvrez notre concept',
    text: 'nos intentions et objectifs'
  },
  {
    icon: CheckSquare,
    title: '2. Choisissez la formule',
    text: 'la plus adaptée à vos besoins'
  },
  {
    icon: FileSignature,
    title: '3. Validez votre partenariat',
    text: 'avec RESACOLO'
  },
  {
    icon: Gift,
    title: '4. Offrez des avantages',
    text: 'à vos ayants-droits'
  }
];

const partnerAdvantages = [
  {
    icon: Sparkles,
    title: 'Plateforme gratuite',
    text: 'La mise à disposition de la plateforme est sans coût pour votre structure.'
  },
  {
    icon: Users,
    title: 'Sans intermédiaire',
    text: 'Aucune intermédiation entre les organisateurs et les parents: un circuit court, lisible et direct.'
  },
  {
    icon: PenBox,
    title: "Page d'accueil personnalisable",
    text: 'En option, votre espace peut refléter votre identité visuelle et vos priorités.'
  },
  {
    icon: Megaphone,
    title: 'Communication simplifiée',
    text: 'Nous facilitons la diffusion de l’offre auprès de vos ayants-droits avec des contenus prêts à relayer.'
  },
  {
    icon: SlidersHorizontal,
    title: 'Formules flexibles',
    text: 'Des modalités adaptables selon votre politique CSE, collectivité ou institution.'
  },
  {
    icon: CheckSquare,
    title: 'Gestion allégée',
    text: 'Un cadre clair qui simplifie le suivi opérationnel côté CSE ou partenaire.'
  }
];

export default function DevenirPartenairePage() {
  return (
    <div className="bg-white">
      <section className="mx-auto grid max-w-7xl grid-cols-1 gap-8 px-6 py-14 lg:grid-cols-2 lg:items-center">
        <div className="space-y-5">
          <p className="text-xs font-semibold uppercase tracking-[0.2em] text-slate-500">À PROPOS</p>
          <h1 className="text-4xl font-bold leading-tight text-slate-900">
            Les conditions de <span className="text-accent-500">partenariat</span>
          </h1>
          <p className="max-w-2xl text-base leading-7 text-slate-600">
            Pour un CSE, une collectivité ou une institution, devenir partenaire de RESACOLO permet de proposer une
            offre de séjours claire, gratuite à déployer et simple à piloter, tout en gardant un lien direct entre
            organisateurs et familles.
          </p>
        </div>

        <div className="flex justify-center lg:justify-end">
          <div className="flex h-56 w-56 items-center justify-center rounded-3xl bg-accent-50 shadow-md ring-1 ring-accent-200 md:h-72 md:w-72">
            <Gift className="h-28 w-28 text-accent-500 md:h-36 md:w-36" />
          </div>
        </div>
      </section>

      <section className="mx-auto max-w-7xl px-6 pb-12">
        <div className="rounded-3xl border border-slate-200 bg-gradient-to-br from-accent-50 via-white to-brand-50 p-6 shadow-sm md:p-10">
          <div className="mx-auto max-w-3xl text-center">
            <h2 className="text-3xl font-bold text-slate-900">
              Pourquoi les <span className="text-accent-500">partenaires CSE</span> choisissent RESACOLO
            </h2>
            <p className="mt-3 text-slate-600">
              Une approche pratique et qualitative pour accompagner vos ayants-droits sans complexifier votre
              organisation.
            </p>
          </div>

          <div className="mt-8 grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-3">
            {partnerAdvantages.map((item) => (
              <article
                key={item.title}
                className="rounded-2xl border border-slate-200 bg-white/90 p-5 shadow-sm backdrop-blur"
              >
                <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-accent-50">
                  <item.icon className="h-5 w-5 text-accent-500" />
                </div>
                <h3 className="mt-4 text-lg font-semibold text-slate-900">{item.title}</h3>
                <p className="mt-2 text-sm leading-6 text-slate-600">{item.text}</p>
              </article>
            ))}
          </div>
        </div>
      </section>

      <section className="mx-auto max-w-7xl px-6 pb-12">
        <div className="rounded-xl bg-white p-6 shadow-md ring-1 ring-slate-200">
          <div className="grid grid-cols-1 gap-5 lg:grid-cols-4 lg:items-stretch">
            {processSteps.map((step, index) => (
              <div key={step.title} className="relative rounded-xl border border-slate-100 bg-white p-5">
                <step.icon className="h-8 w-8 text-accent-500" />
                <p className="mt-4 text-base font-semibold text-slate-900">{step.title}</p>
                <p className="mt-1 text-sm text-slate-600">{step.text}</p>
                {index < processSteps.length - 1 && (
                  <span className="absolute -right-3 top-1/2 hidden -translate-y-1/2 text-xl font-bold text-accent-500 lg:block">
                    →
                  </span>
                )}
              </div>
            ))}
          </div>
        </div>
      </section>

      <section className="mx-auto max-w-7xl px-6 pb-14">
        <h2 className="text-center text-3xl font-bold text-slate-900">
          Privilégier <span className="text-brand-600">RESACOLO</span>, c&apos;est valoriser...
        </h2>

        <div className="mt-8 grid grid-cols-1 gap-6 lg:grid-cols-3">
          <article className="rounded-xl border border-slate-200 bg-white p-6 shadow-md">
            <Award className="h-8 w-8 text-accent-500" />
            <h3 className="mt-4 text-xl font-semibold text-slate-900">Une offre qualifiée multiple</h3>
            <p className="mt-2 text-slate-600">
              Les prestations proposées sont conçues et organisées par une large sélection d&apos;opérateurs
              expérimentés.
            </p>
          </article>
          <article className="rounded-xl border border-slate-200 bg-white p-6 shadow-md">
            <Euro className="h-8 w-8 text-accent-500" />
            <h3 className="mt-4 text-xl font-semibold text-slate-900">Des avantages spécifiques</h3>
            <p className="mt-2 text-slate-600">
              Les ayants-droits de nos partenaires bénéficient d&apos;avantages sur l&apos;intégralité des séjours
              publiés.
            </p>
          </article>
          <article className="rounded-xl border border-slate-200 bg-white p-6 shadow-md">
            <Users className="h-8 w-8 text-accent-500" />
            <h3 className="mt-4 text-xl font-semibold text-slate-900">Une réservation en circuit court</h3>
            <p className="mt-2 text-slate-600">
              RESACOLO se limite au référencement des séjours. Les réservations sont faites directement auprès des
              organisateurs.
            </p>
          </article>
        </div>
      </section>

      <section className="mx-auto max-w-7xl px-6 pb-16">
        <h2 className="text-center text-3xl font-bold text-slate-900">
          Nos formules <span className="text-brand-600">100% gratuites</span>
        </h2>

        <div className="mt-8 grid grid-cols-1 gap-6 lg:grid-cols-2">
          <article className="rounded-xl border border-slate-200 border-b-8 border-b-accent-500 bg-white p-8 shadow-md">
            <div className="flex h-12 w-12 items-center justify-center rounded-full bg-accent-50">
              <Sun className="h-6 w-6 text-accent-500" />
            </div>
            <h3 className="mt-5 text-2xl font-bold uppercase text-accent-500">Sérénité</h3>
            <p className="mt-3 text-slate-600">
              La plus simple façon de favoriser le départ en vacances et de sensibiliser aux bienfaits de la colo
              pour la Jeunesse.
            </p>
            <ul className="mt-5 space-y-3">
              <li className="flex items-start gap-2 text-slate-700">
                <Check className="mt-0.5 h-4 w-4 text-brand-600" />
                Un accès à l&apos;intégralité de l&apos;offre de séjours
              </li>
              <li className="flex items-start gap-2 text-slate-700">
                <Check className="mt-0.5 h-4 w-4 text-brand-600" />
                Un code avantage pour vos ayants-droits.
              </li>
            </ul>
          </article>

          <article className="rounded-xl border border-slate-200 border-b-8 border-b-accent-500 bg-white p-8 shadow-md">
            <div className="flex h-12 w-12 items-center justify-center rounded-full bg-accent-50">
              <PenBox className="h-6 w-6 text-accent-500" />
            </div>
            <h3 className="mt-5 text-2xl font-bold uppercase text-accent-500">Identité</h3>
            <p className="mt-3 text-slate-600">
              L&apos;option idéale pour les institutions qui appliquent une politique volontariste et participent au
              coût du séjour.
            </p>
            <ul className="mt-5 space-y-3">
              <li className="flex items-start gap-2 text-slate-700">
                <Check className="mt-0.5 h-4 w-4 text-brand-600" />
                Un site marque blanche personnalisé (URL spécifique, logo de votre institution...)
              </li>
              <li className="flex items-start gap-2 text-slate-700">
                <Check className="mt-0.5 h-4 w-4 text-brand-600" />
                Des avantages offerts à vos ayants-droits (affichés directement sur les fiches séjours)
              </li>
            </ul>
          </article>
        </div>
      </section>

      <section className="mx-auto max-w-7xl px-6 pb-20">
        <div className="rounded-2xl bg-slate-50 p-6 md:p-10">
          <h2 className="text-center text-5xl font-bold leading-tight text-slate-800">
            Demande de <span className="text-brand-600">partenariat</span>
          </h2>
          <p className="mx-auto mt-4 max-w-3xl text-center text-slate-500">
            Vous êtes une collectivité ou un comité d&apos;entreprise et vous portez un intérêt particulier à
            RESACOLO ? Nous serions ravis d&apos;envisager un partenariat avec votre institution.
          </p>

          <form className="mx-auto mt-10 max-w-5xl space-y-6">
            <div>
              <label className="mb-2 block text-sm font-semibold text-slate-700">1. Institution*</label>
              <input className="h-12 w-full rounded-xl border border-slate-300 bg-white px-4 shadow-sm outline-none focus:border-brand-600" />
            </div>
            <div>
              <label className="mb-2 block text-sm font-semibold text-slate-700">2. Nom*</label>
              <input className="h-12 w-full rounded-xl border border-slate-300 bg-white px-4 shadow-sm outline-none focus:border-brand-600" />
            </div>
            <div>
              <label className="mb-2 block text-sm font-semibold text-slate-700">3. Email*</label>
              <input
                type="email"
                className="h-12 w-full rounded-xl border border-slate-300 bg-white px-4 shadow-sm outline-none focus:border-brand-600"
              />
            </div>
            <div>
              <label className="mb-2 block text-sm font-semibold text-slate-700">4. Formule CSE*</label>
              <div className="relative">
                <select className="h-12 w-full appearance-none rounded-xl border border-slate-300 bg-white px-4 pr-10 text-slate-500 shadow-sm outline-none focus:border-brand-600">
                  <option>--Veuillez choisir une option--</option>
                  <option>Sérénité</option>
                  <option>Identité</option>
                </select>
                <ChevronDown className="pointer-events-none absolute right-3 top-1/2 h-4 w-4 -translate-y-1/2 text-brand-600" />
              </div>
            </div>
            <div>
              <label className="mb-2 block text-sm font-semibold text-slate-700">5. Message*</label>
              <textarea
                rows={7}
                placeholder="Message*"
                className="w-full rounded-xl border border-slate-300 bg-white p-4 shadow-sm outline-none focus:border-brand-600"
              />
            </div>

            <div className="max-w-md rounded-xl border border-slate-300 bg-white p-4 shadow-sm">
              <p className="text-sm text-slate-500">
                Veuillez prouver que vous n&apos;êtes pas un robot en sélectionnant <span className="text-brand-600">La Maison</span>.
              </p>
              <div className="mt-3 flex items-center gap-4 text-slate-400">
                <Heart className="h-4 w-4" />
                <Home className="h-4 w-4" />
                <Coffee className="h-4 w-4" />
              </div>
            </div>

            <div className="flex items-center justify-between">
              <p className="text-sm text-slate-500">* obligatoire</p>
              <button
                type="submit"
                className="rounded-xl bg-accent-500 px-8 py-3 text-sm font-semibold uppercase tracking-wide text-white shadow-sm transition hover:bg-accent-600"
              >
                Envoyer
              </button>
            </div>
          </form>
        </div>
      </section>
    </div>
  );
}
