'use client';

import { useState } from 'react';
import { Plus, Minus } from 'lucide-react';

const faqItems: { question: string; answer: string }[] = [
  {
    question: "Comment se déroule le processus de réservation ?",
    answer:
      "Le processus de réservation se fait en quelques étapes : vous choisissez un séjour sur la plateforme, vous remplissez le formulaire d'inscription en indiquant vos coordonnées et les options souhaitées, puis vous transmettez votre demande. L'organisateur du séjour vous recontacte pour confirmer la disponibilité et finaliser l'inscription."
  },
  {
    question: "Comment réserve-t-on un séjour : sur le site, par courrier, par téléphone ?",
    answer:
      "La réservation s'effectue directement via la plateforme RESACOLO : vous sélectionnez le séjour qui vous intéresse et vous transmettez votre demande en ligne. L'organisateur peut ensuite vous contacter par téléphone ou par email pour les échanges nécessaires. Le courrier peut être utilisé pour l'envoi de documents selon les cas."
  },
  {
    question:
      "La réservation constitue-t-elle un engagement définitif ou est-ce l'équivalent d'une demande de devis ? À quoi m'engage-t-elle ?",
    answer:
      "La demande transmise via RESACOLO constitue une demande de réservation. L'engagement définitif intervient après confirmation de l'organisateur (disponibilité, options) et, le cas échéant, après réception d'un acompte ou signature du contrat. Les conditions précises vous sont communiquées par l'organisateur."
  },
  {
    question: "Comment saurais-je que ma demande est confirmée ?",
    answer:
      "Une fois votre demande traitée, l'organisateur vous envoie une confirmation par email. Celle-ci précise les modalités du séjour, les documents à fournir et les prochaines étapes. Conservez cet email comme justificatif de votre réservation."
  },
  {
    question: "Quels documents vais-je recevoir de votre part ?",
    answer:
      "Selon les organisateurs, vous pouvez recevoir : une confirmation de réservation, une convention ou contrat de séjour, une fiche sanitaire, une liste d'affaires à prévoir et, le cas échéant, les informations de transport. Tous les documents sont envoyés par email ou par courrier selon les pratiques de l'organisateur."
  },
  {
    question: "Que faire si ma réservation n'aboutit pas ?",
    answer:
      "Si la réservation ne peut pas être confirmée (plus de places, dates incompatibles, etc.), l'organisateur vous en informe et peut vous proposer une alternative. Vous n'êtes pas engagé tant que la réservation n'a pas été confirmée. En cas de litige, contactez directement l'organisateur ou le service support RESACOLO."
  },
  {
    question: "Je n'ai pas reçu l'email de confirmation d'inscription, que dois-je faire ?",
    answer:
      "Vérifiez d'abord vos courriers indésirables (spam). Si vous ne trouvez pas l'email, contactez l'organisateur du séjour en indiquant la date et le nom du séjour concerné. Il pourra renvoyer la confirmation ou vous indiquer la marche à suivre."
  },
  {
    question: "Pour toute question sur le séjour à qui je m'adresse ?",
    answer:
      "Pour toute question sur un séjour précis (dates, activités, transport, hébergement, etc.), adressez-vous directement à l'organisateur du séjour. Ses coordonnées figurent sur la fiche du séjour et dans les emails de confirmation. RESACOLO met en relation les familles et les organisateurs."
  }
];

export function FaqAccordion() {
  const [openId, setOpenId] = useState<number | null>(null);

  return (
    <div className="space-y-3">
      {faqItems.map((item, index) => {
        const isOpen = openId === index;
        return (
          <div
            key={index}
            className="rounded-lg border border-slate-200 bg-white shadow-sm"
          >
            <button
              type="button"
              onClick={() => setOpenId(isOpen ? null : index)}
              className="flex w-full items-center justify-between gap-4 px-5 py-4 text-left"
              aria-expanded={isOpen}
              aria-controls={`faq-answer-${index}`}
              id={`faq-question-${index}`}
            >
              <span className="font-semibold text-slate-800">{item.question}</span>
              <span className="flex h-8 w-8 flex-shrink-0 items-center justify-center rounded-full text-slate-400">
                {isOpen ? (
                  <Minus className="h-4 w-4" />
                ) : (
                  <Plus className="h-4 w-4" />
                )}
              </span>
            </button>
            <div
              id={`faq-answer-${index}`}
              role="region"
              aria-labelledby={`faq-question-${index}`}
              className="overflow-hidden transition-all duration-200 ease-out"
              style={{
                maxHeight: isOpen ? 600 : 0
              }}
            >
              <div className="border-t border-slate-100 px-5 py-4 text-slate-600">
                {item.answer}
              </div>
            </div>
          </div>
        );
      })}
    </div>
  );
}
