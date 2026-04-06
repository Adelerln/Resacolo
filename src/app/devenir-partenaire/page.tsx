import type { Metadata } from 'next';
import { PartnerContactForm } from '@/components/devenir-partenaire/PartnerContactForm';
import {
  Award,
  Check,
  CheckSquare,
  Euro,
  FileSignature,
  Gift,
  PenBox,
  Search,
  Sun,
  Users
} from 'lucide-react';

const ORANGE = '#FA8500';
const BLUE = '#52B0EA';

export const metadata: Metadata = {
  title: 'Devenir Partenaire | Resacolo',
  description: 'Devenir partenaire de RESACOLO, c’est promouvoir et faciliter le départ en colonie de vacances.'
};

const processSteps = [
  {
    icon: Search,
    text: '1. Découvrez notre concept, nos intentions et objectifs'
  },
  {
    icon: CheckSquare,
    text: '2. Choisissez la formule la plus adaptée à vos besoins'
  },
  {
    icon: FileSignature,
    text: '3. Validez votre partenariat avec RESACOLO'
  },
  {
    icon: Gift,
    text: '4. Offrez des remises sur les séjours à vos ayants-droits'
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
    text: 'La plus simple façon de favoriser le départ en vacances et de sensibiliser aux bienfaits de la colo pour la Jeunesse .',
    bullets: ['Un accès à l’intégralité de l’offre de séjours', 'Un code avantage pour vos ayants-droits.']
  },
  {
    icon: PenBox,
    title: 'IDENTITÉ',
    text: 'L’option idéale pour les institutions qui appliquent une politique volontariste et participent au coût du séjour.',
    bullets: [
      'Un site marque blanche personnalisé (URL spécifique, logo de votre institution, rubrique dédiée, critères particuliers)',
      'Des avantages offerts à vos ayants-droits (affichés directement sur les fiches séjours)'
    ]
  }
];

const faqItems = [
  {
    question: 'Processus de réservation',
    paragraphs: [
      'Vous sélectionnez sur la plateforme le séjour de votre choix et valider votre réservation en renseignant vos informations personnelles. Lors de la validation, un email est envoyé à l’organisateur du séjour, un autre vous est envoyé pour confirmation. L’organisateur du séjour se met en relation avec vous par mail ou par téléphone pour finaliser l’inscription de votre enfant sur le séjour choisi, et vous apporter toutes informations utiles (trousseau, transport, santé…).'
    ]
  },
  {
    question: "J'ai une question sur un séjour",
    paragraphs: [
      'Pour toute question relative au séjour, votre interlocuteur unique est l’organisateur du séjour ou ses représentants.',
      'Vous pouvez prendre contact avec l’organisateur du séjour que vous avez sélectionné via le formulaire de la page Contact. Sur chaque séjour, vous retrouverez sur la droite le nom de l’organisateur.'
    ]
  },
  {
    question: "Email de confirmation d'inscription non reçu",
    paragraphs: [
      'Après avoir validé votre réservation, vous allez recevoir un premier mail de confirmation d’inscription pour l’ouverture de votre compte, suivi d’un second mail de confirmation de votre demande de réservation.',
      'Si vous ne recevez pas de confirmation d’inscription, ou de confirmation de votre demande de réservation, vous pouvez joindre soit la plateforme RESACOLO, soit l’organisateur du séjour par le biais du formulaire de la page Contact.'
    ]
  },
  {
    question: 'Modifier ou Annuler un séjour',
    paragraphs: [
      'Vous pouvez modifier votre réservation directement dans votre espace client ou en informant l’organisateur du séjour si celui-ci l’a déjà traité positivement.'
    ]
  },
  {
    question: 'Signification : prix  "À partir de..."',
    paragraphs: [
      'Le prix affiché correspond au coût minimum du séjour, sans options particulières. Lors de la réservation, vous pouvez réservez en complément des prestations complémentaires (dates, transports, activités, options, garanties, assurances…) qui s’ajouteront au prix « à partir de ».'
    ]
  },
  {
    question: 'Paiement',
    paragraphs: [
      'Le séjour est réglé directement à l’organisateur du séjour selon ses propres modalités et conditions générales de vente. Aucun règlement ne s’effectue sur la plateforme RESACOLO.'
    ]
  },
  {
    question: "Remboursement et frais d'annulation",
    paragraphs: [
      'L’annulation du séjour se fait directement auprès de l’organisateur du séjour, selon ses propres conditions générales de vente. Contactez-le par téléphone ou par mail pour mettre en place la procédure de remboursement ou d’annulation.',
      'Dans le cas d’une annulation définitive, il convient de se référer aux conditions générales de vente de l’organisateur du séjour, mentionnant le % des frais d’annulation selon le nombre de jours avant la date départ.'
    ]
  },
  {
    question: 'Quels sont les avantages à devenir partenaire RESACOLO ?',
    paragraphs: [
      'En devenant partenaire RESACOLO, vous rejoignez une plateforme spécialisée dans les colonies de vacances pour enfants et adolescents, et les séjours jeunes adultes. Le site référence chaque année des séjours organisés par des partenaires, avec une offre présentée par âges, thématiques, saisons et destinations, afin de toucher des familles déjà en recherche active d’un séjour.',
      'RESACOLO met à disposition de ses partenaires une vitrine dédiée pour valoriser leurs séjours, améliorer leur visibilité en ligne et faciliter la mise en relation avec les familles. Le fonctionnement du site repose sur une réservation transmise directement à l’organisateur, qui reprend ensuite contact avec la famille pour finaliser l’inscription et préparer le départ.',
      'Devenir partenaire de RESACOLO, c’est aussi s’inscrire dans une démarche portée par un projet collectif d’organisateurs.'
    ]
  }
];

export default function DevenirPartenairePage() {
  return (
    <div className="min-h-screen bg-white">
      <section className="bg-slate-50 py-16 md:py-20">
        <div className="section-container grid gap-12 lg:grid-cols-2 lg:items-center">
          <div>
            <p className="text-xs font-extrabold uppercase tracking-widest text-slate-500">À propos</p>
            <h1 className="mt-4 font-display text-3xl font-bold text-slate-900 sm:text-4xl lg:text-5xl">
              Les conditions de <span style={{ color: ORANGE }}>partenariat</span>
            </h1>
            <p className="mt-6 max-w-xl font-medium leading-relaxed text-slate-600">
              Devenir partenaire de RESACOLO, c&apos;est promouvoir et faciliter le départ en colonie de vacances !
              Sensibiliser vos publics aux bienfaits des colonies de vacances en privilégiant la plateforme des
              professionnels du secteur et son catalogue de séjours riche et diversifié.
            </p>
            <a
              href="#demande-partenariat"
              className="mt-6 inline-flex rounded-full px-6 py-3 text-sm font-semibold text-white transition hover:opacity-95"
              style={{ backgroundColor: ORANGE }}
            >
              Demande de partenariat
            </a>
          </div>

          <div className="flex items-center justify-center lg:justify-end">
            <div className="flex h-60 w-60 items-center justify-center rounded-[32px] bg-white shadow-xl sm:h-72 sm:w-72">
              <Gift className="h-24 w-24 text-accent-500 sm:h-28 sm:w-28" />
            </div>
          </div>
        </div>
      </section>

      <section className="section-container py-12 md:py-14">
        <div className="grid gap-5 lg:grid-cols-4">
          {processSteps.map((step) => (
            <article key={step.text} className="rounded-2xl bg-white p-5 shadow-sm ring-1 ring-slate-100">
              <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-accent-50">
                <step.icon className="h-5 w-5 text-accent-500" />
              </div>
              <p className="mt-4 text-sm font-semibold leading-6 text-slate-700">{step.text}</p>
            </article>
          ))}
        </div>
      </section>

      <section className="section-container pb-14 md:pb-16">
        <div className="rounded-[32px] bg-gradient-to-r from-brand-50 to-white p-6 shadow-xl sm:p-8">
          <h2 className="text-center font-display text-2xl font-bold text-slate-900 sm:text-3xl">
            Privilégier <span style={{ color: BLUE }}>RESACOLO</span>, c&apos;est valoriser…
          </h2>

          <div className="mt-6 grid gap-4 md:grid-cols-3">
            {partnershipValues.map((item) => (
              <article key={item.title} className="rounded-2xl bg-white p-5 shadow-sm">
                <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-accent-50">
                  <item.icon className="h-5 w-5 text-accent-500" />
                </div>
                <h3 className="mt-4 text-base font-semibold text-slate-900">{item.title}</h3>
                <p className="mt-2 text-sm leading-6 text-slate-600">{item.text}</p>
              </article>
            ))}
          </div>
        </div>
      </section>

      <section className="section-container pb-16 md:pb-20">
        <h2 className="text-center font-display text-2xl font-bold text-slate-900 sm:text-3xl">
          Nos formules <span style={{ color: BLUE }}>100% gratuites</span>
        </h2>

        <div className="mt-8 grid gap-6 lg:grid-cols-2">
          {formulas.map((formula) => (
            <article key={formula.title} className="rounded-[32px] bg-white p-6 shadow-sm ring-1 ring-slate-100 sm:p-8">
              <div className="flex h-12 w-12 items-center justify-center rounded-full bg-accent-50">
                <formula.icon className="h-6 w-6 text-accent-500" />
              </div>
              <h3 className="mt-5 text-2xl font-bold uppercase text-accent-500">{formula.title}</h3>
              <p className="mt-3 text-sm font-medium leading-7 text-slate-600 sm:text-[15px]">{formula.text}</p>
              <ul className="mt-5 space-y-3">
                {formula.bullets.map((bullet) => (
                  <li key={bullet} className="flex items-start gap-2 text-sm font-medium text-slate-700">
                    <Check className="mt-0.5 h-4 w-4 text-brand-600" />
                    {bullet}
                  </li>
                ))}
              </ul>
            </article>
          ))}
        </div>
      </section>

      <PartnerContactForm />

      <section className="section-container pb-24">
        <div className="rounded-[32px] bg-white p-6 shadow-sm ring-1 ring-slate-100 sm:p-8">
          <p className="text-center text-xs font-extrabold uppercase tracking-widest text-slate-500">FAQ</p>
          <h2 className="mt-3 text-center font-display text-2xl font-bold text-slate-900 sm:text-3xl">
            Questions fréquentes sur les colonies de vacances 2026
          </h2>
          <p className="mt-3 text-center text-sm font-medium text-slate-600">
            Retrouvez ici quelques réponses à vos questions.
          </p>

          <div className="mt-8 space-y-3">
            {faqItems.map((item, index) => (
              <details
                key={item.question}
                open={index === 0}
                className="group rounded-2xl border border-slate-200 bg-slate-50 px-5 py-4"
              >
                <summary className="cursor-pointer list-none text-sm font-semibold text-slate-800">
                  {item.question}
                </summary>
                <div className="mt-3 space-y-3 border-t border-slate-200 pt-3">
                  {item.paragraphs.map((paragraph) => (
                    <p key={paragraph} className="text-sm leading-relaxed text-slate-600">
                      {paragraph}
                    </p>
                  ))}
                </div>
              </details>
            ))}
          </div>
        </div>
      </section>
    </div>
  );
}
