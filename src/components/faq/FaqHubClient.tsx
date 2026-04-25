'use client';

import type { ReactNode } from 'react';
import Image from 'next/image';
import Link from 'next/link';
import { useState } from 'react';
import { ChevronDown } from 'lucide-react';

const BLUE = '#52B0EA';
/** Titres rubrique sous les cartes (maquette) */
const SECTION_TITLE_LEAD = '#4D4D4D';
const SECTION_TITLE_ACCENT = '#38B6FF';
const SECTION_INTRO = '#666666';

type CategoryId = 'inscription' | 'tarifs' | 'donnees' | 'annulation';

type FaqPair = { question: string; answer: ReactNode };

type CategoryDef = {
  id: CategoryId;
  cardTitle: string;
  /** Picto carte (dossier public/image/faq/pictos_faq/) */
  cardPictoSrc: string;
  cardPictoAlt: string;
  /** Première partie du titre (gris anthracite) — la suite est en `sectionTitleAccent` (bleu) */
  sectionTitleLead: string;
  sectionTitleAccent: string;
  sectionIntro: string;
  pairs: FaqPair[];
};

const CATEGORIES: CategoryDef[] = [
  {
    id: 'inscription',
    cardTitle: 'Processus d’inscription',
    cardPictoSrc: '/image/faq/pictos_faq/audit.png',
    cardPictoAlt: '',
    sectionTitleLead: 'Processus',
    sectionTitleAccent: ' d’inscription',
    sectionIntro: 'Un doute ? Nous vous accompagnons durant tout le processus de réservation.',
    pairs: [
      {
        question: 'Comment se déroule le processus de réservation ?',
        answer:
          'Vous sélectionnez sur la plateforme le séjour de votre choix et validez votre réservation en renseignant vos informations personnelles. L’organisateur du séjour se met en relation avec vous pour finaliser l’inscription et vous apporter toutes informations utiles.'
      },
      {
        question: 'Comment réserve-t-on un séjour : sur le site, par courrier, par téléphone ?',
        answer: 'Les réservations se font uniquement en ligne via le formulaire réservé à cet effet.'
      },
      {
        question:
          "La réservation constitue-t-elle un engagement définitif ou est-ce l'équivalent d'une demande de devis ? À quoi m'engage-t-elle ?",
        answer:
          'Resacolo facilite la mise en relation avec un organisateur de séjour. Toute réservation effectuée sur la plateforme génère une demande d’inscription. Cette dernière est transmise à l’organisateur du séjour qui finalise le processus d’inscription avec la famille. Toute rétractation sera soumise aux conditions générales de vente de l’organisateur.'
      },
      {
        question: 'Comment saurais-je que ma demande est confirmée ?',
        answer:
          'Dès validation de votre réservation, l’organisateur du séjour est informé de votre demande d’inscription. Ce dernier dispose d’un délai maximal de 72h pour finaliser l’inscription auprès de vous.'
      },
      {
        question: 'Quels documents vais-je recevoir de votre part ?',
        answer:
          'Après avoir validé votre réservation en ligne, vous recevrez une confirmation par mail de votre demande.'
      },
      {
        question: "Que faire si ma réservation n'aboutit pas ?",
        answer: 'Si vous ne parvenez pas à valider votre réservation, nous vous invitons à renouveler l’opération ultérieurement.'
      },
      {
        question: "Je n'ai pas reçu l'email de confirmation d'inscription, que dois-je faire ?",
        answer:
          'Si vous ne recevez pas de confirmation d’inscription, vous pouvez joindre soit la plateforme, soit l’organisateur du séjour par le biais du formulaire de contact.'
      },
      {
        question: "Pour toute question sur le séjour à qui je m'adresse ?",
        answer:
          'Pour toute question relative au séjour, votre interlocuteur unique est l’organisateur du séjour ou ses représentants.'
      }
    ]
  },
  {
    id: 'tarifs',
    cardTitle: 'Tarifs & Paiement',
    cardPictoSrc: '/image/faq/pictos_faq/PRIX.png',
    cardPictoAlt: '',
    sectionTitleLead: 'Tarifs',
    sectionTitleAccent: ' & Paiement',
    sectionIntro:
      'Envie d’en savoir plus sur les tarifs appliqués ou les modalités de paiement, nous sommes à votre disposition',
    pairs: [
      {
        question: 'Que signifie précisément le prix "à partir de" ?',
        answer:
          'Le prix affiché correspond au coût minimum du séjour, sans options particulières. Lors de la réservation, vous pouvez réserver en complément des prestations complémentaires (transport, activités, assurances, …) qui s’ajouteront au prix « à partir de ».'
      },
      {
        question: 'Quels moyens de paiement acceptez-vous (cartes bancaires, chèque, espèces,etc.) ?',
        answer:
          'L’organisateur du séjour vous précisera les divers moyens de paiement envisageables pour le règlement du séjour.'
      },
      {
        question: 'Peut-on régler en plusieurs fois ?',
        answer:
          'Ce critère est tributaire de chaque organisme. Nous vous invitons à en faire la demande lors de la confirmation d’inscription par l’organisateur du séjour.'
      },
      {
        question: 'Quand solder mon voyage ?',
        answer:
          'Le séjour est réglé directement à l’organisateur du séjour selon ses propres modalités et conditions générales de vente.'
      },
      {
        question: 'Puis-je poser une option sur mon voyage et payer plus tard ?',
        answer: 'Ces éventuelles dispositions sont à étudier directement avec l’organisateur du séjour.'
      },
      {
        question: 'Vais-je recevoir une facture du montant réglé pour mon séjour ?',
        answer: 'Oui, celle-ci sera émise et adressée par ResaColo dans votre espace.'
      },
      {
        question: 'Est-ce plus cher que de réserver directement sur les partenaires ?',
        answer:
          'Chaque membre s’engage à ce que le tarif affiché soit identique au prix affiché sur son propre site. Ainsi, si un organisateur applique une promotion sur l’un de ses séjours, elle sera également prise en compte sur Resacolo.'
      }
    ]
  },
  {
    id: 'donnees',
    cardTitle: 'Données personnelles',
    cardPictoSrc: '/image/faq/pictos_faq/securite-personnelle.png',
    cardPictoAlt: '',
    sectionTitleLead: 'Données',
    sectionTitleAccent: ' personnelles',
    sectionIntro:
      'Les données personnelles sont précieuses. Nous vous aidons à les protéger et à en contrôler l’utilisation.',
    pairs: [
      {
        question:
          'Quelle est votre politique de confidentialité sur les données personnelles que je vous ai transmises à la réservation ?',
        answer: (
          <>
            Conformément aux dispositions légales, nous ne conservons vos données que dans le cadre de votre réservation.
            Voir plus de détails sur notre{' '}
            <Link href="/confidentialite" className="font-semibold text-brand-600 underline">
              page politique de confidentialité
            </Link>
            .
          </>
        )
      },
      {
        question: 'Comment modifier ou mettre à jour mes données personnelles ?',
        answer:
          'Dans votre espace personnel, vous pouvez actualiser l’ensemble des informations saisies.'
      },
      {
        question: "J'ai oublié mon mot de passe, comment faire ?",
        answer:
          'Via le module « mot de passe oublié », vous pouvez générer un nouveau mot de passe et ainsi accéder à nouveau à votre espace personnel.'
      },
      {
        question: 'Comment supprimer mon compte et mes données personnelles ?',
        answer:
          'En vous connectant à votre espace personnel, vous pourrez supprimer votre compte uniquement si ce dernier n’intègre pas de réservation en cours.'
      }
    ]
  },
  {
    id: 'annulation',
    cardTitle: 'Annulation & Remboursement',
    cardPictoSrc: '/image/faq/pictos_faq/annuler.png',
    cardPictoAlt: '',
    sectionTitleLead: 'Annulation',
    sectionTitleAccent: ' & Remboursement',
    sectionIntro:
      'Vous souhaitez modifier ou annuler votre réservation et solliciter un remboursement, nous vous indiquons les démarches à réaliser.',
    pairs: [
      {
        question: 'Comment modifier/annuler mon voyage ?',
        answer:
          'Vous pouvez modifier ou annuler votre réservation en informant l’organisateur du séjour si celui-ci l’a déjà traité positivement.'
      },
      {
        question: "Que se passe-t-il en cas de modifications ou d'annulation du voyage après encaissement de l'acompte ?",
        answer:
          'En cas de modification ou d’annulation de la prestation réservée, l’organisateur du séjour se rapproche de vous pour vous en expliquer les tenants et les aboutissants et étudier une solution de remplacement.'
      },
      {
        question: "Quels sont les frais d'annulation ?",
        answer:
          'L’annulation du séjour se fait directement auprès de l’organisateur du séjour, selon ses propres conditions générales de vente.'
      },
      {
        question: 'Si je me rétracte, suis-je remboursé entièrement ?',
        answer:
          'Dans le cas d’une annulation définitive, il convient de se référer aux conditions générales de vente de l’organisateur du séjour.'
      }
    ]
  }
];

function AnswerBlock({ children }: { children: React.ReactNode }) {
  return <div className="text-sm leading-relaxed text-slate-600 sm:text-base">{children}</div>;
}

export function FaqHubClient() {
  const [active, setActive] = useState<CategoryId>(() => {
    if (typeof window === 'undefined') return 'inscription';
    const hash = window.location.hash.replace('#', '') as CategoryId;
    return CATEGORIES.some((category) => category.id === hash) ? hash : 'inscription';
  });

  const activeDef = CATEGORIES.find((c) => c.id === active)!;

  const select = (id: CategoryId) => {
    setActive(id);
    window.history.replaceState(null, '', `#${id}`);
  };

  return (
    <div className="relative">
      {/* Bandeau bleu (texte + déco) */}
      <section
        className="relative min-h-[min(60vh,500px)] overflow-hidden pb-20 pt-16 sm:min-h-[min(58vh,580px)] sm:pb-28 sm:pt-20 lg:min-h-[min(56vh,640px)] lg:pb-32 lg:pt-24"
        style={{ backgroundColor: BLUE }}
      >
        <div className="pointer-events-none absolute inset-y-0 right-0 w-[58%] max-w-2xl opacity-95 sm:w-[55%]">
          <Image
            src="/image/faq/pictos_faq/questions.png"
            alt=""
            width={480}
            height={480}
            className="absolute bottom-6 right-[max(1.25rem,10vw)] top-6 h-auto max-h-[min(52vh,300px)] w-auto max-w-[min(100%,300px)] translate-x-[-6%] translate-y-[-12px] object-contain object-bottom sm:right-[max(2rem,14vw)] sm:bottom-10 sm:top-4 sm:max-h-[min(48vh,340px)] sm:max-w-[min(100%,340px)] sm:translate-x-[-10%] sm:translate-y-[-16px] lg:right-[max(3rem,18vw)] lg:max-h-[min(44vh,360px)] lg:max-w-[min(100%,360px)] lg:translate-x-[-14%] lg:translate-y-[-20px]"
            priority
          />
        </div>

        <div className="relative z-[1] mx-auto w-full max-w-5xl px-4 pb-6 pr-[clamp(1rem,min(42vw,20rem),22rem)] text-left text-white sm:px-6 sm:pb-10 sm:pr-[clamp(1.25rem,min(46vw,24rem),26rem)] lg:pr-[clamp(1.5rem,min(44vw,26rem),28rem)]">
          <p className="text-xs font-semibold uppercase tracking-[0.2em] text-white/90 sm:text-[13px]">Aide & conseils</p>
          <h1 className="font-display mt-4 text-5xl font-bold tracking-tight sm:mt-5 sm:text-6xl lg:text-7xl">FAQ</h1>
          <p className="mt-5 max-w-full text-justify text-base leading-relaxed text-white/95 sm:mt-6 sm:max-w-[42rem] sm:text-lg">
            Des interrogations ? Nous avons référencé diverses questions que vous pourriez vous poser. Prenez le temps
            de parcourir notre FAQ. Pour toute précision sur une colonie de vacances, merci d&apos;envoyer un mail à
            l&apos;organisateur du séjour via le formulaire de contact.
          </p>
        </div>
      </section>

      {/* Cartes blanches chevauchant bleu / blanc */}
      <div className="relative z-[2] -mt-12 px-4 sm:-mt-16 sm:px-6">
        <div className="mx-auto grid max-w-5xl grid-cols-2 gap-3 sm:gap-4 lg:grid-cols-4">
          {CATEGORIES.map((cat) => {
            const selected = active === cat.id;
            return (
              <button
                key={cat.id}
                type="button"
                onClick={() => select(cat.id)}
                className={`origin-center cursor-pointer flex flex-col items-center rounded-2xl border bg-white px-3 py-6 text-center shadow-[0_12px_40px_rgba(15,23,42,0.12)] transition-transform duration-200 ease-out will-change-transform hover:scale-[1.05] sm:py-8 ${
                  selected
                    ? 'border-transparent ring-2 ring-[#FA8500] ring-offset-2 ring-offset-white'
                    : 'border-slate-100 hover:border-slate-200'
                }`}
                aria-pressed={selected}
              >
                <span className="relative flex h-16 w-16 shrink-0 items-center justify-center sm:h-[4.5rem] sm:w-[4.5rem]">
                  <Image
                    src={cat.cardPictoSrc}
                    alt={cat.cardPictoAlt || cat.cardTitle}
                    width={120}
                    height={120}
                    className="h-full w-full object-contain"
                  />
                </span>
                <span className="mt-4 text-sm font-bold leading-snug text-slate-800 sm:text-base">{cat.cardTitle}</span>
              </button>
            );
          })}
        </div>
      </div>

      {/* Zone blanche : intro rubrique + accordéons */}
      <section
        id="faq-content"
        className="scroll-mt-6 bg-white px-4 pb-16 pt-10 sm:px-6 sm:pt-14 md:pt-12"
      >
        <div className="mx-auto max-w-3xl">
          <header className="mb-10 border-b border-slate-100 pb-10 text-center">
            <h2 className="font-display text-3xl font-bold leading-tight tracking-tight sm:text-4xl md:text-[2.5rem] md:leading-snug">
              <span style={{ color: SECTION_TITLE_LEAD }}>{activeDef.sectionTitleLead}</span>
              <span style={{ color: SECTION_TITLE_ACCENT }}>{activeDef.sectionTitleAccent}</span>
            </h2>
            <p
              className="mx-auto mt-4 max-w-2xl text-sm font-normal leading-relaxed sm:mt-5 sm:text-base"
              style={{ color: SECTION_INTRO }}
            >
              {activeDef.sectionIntro}
            </p>
          </header>

          <div className="space-y-3">
            {activeDef.pairs.map((item, index) => (
              <details
                key={`${active}-${index}`}
                className="group rounded-xl border border-slate-200 bg-white shadow-sm open:shadow-md"
              >
                <summary className="flex cursor-pointer list-none items-center justify-between gap-4 px-5 py-4 marker:hidden hover:bg-slate-50 [&::-webkit-details-marker]:hidden">
                  <span className="text-left font-semibold text-slate-800">{item.question}</span>
                  <ChevronDown
                    className="h-5 w-5 shrink-0 text-slate-400 transition group-open:rotate-180"
                    aria-hidden
                  />
                </summary>
                <div className="border-t border-slate-100 px-5 py-4">
                  <AnswerBlock>{item.answer}</AnswerBlock>
                </div>
              </details>
            ))}
          </div>
        </div>
      </section>
    </div>
  );
}
