/** Contenu FAQ public (texte indexable + JSON-LD). */

export type FaqCategoryId = 'inscription' | 'tarifs' | 'donnees' | 'annulation';

export type FaqPair = {
  question: string;
  answer: string;
};

export type FaqCategory = {
  id: FaqCategoryId;
  cardTitle: string;
  cardPictoSrc: string;
  cardPictoAlt: string;
  sectionTitleLead: string;
  sectionTitleAccent: string;
  sectionIntro: string;
  pairs: FaqPair[];
};

export const FAQ_CATEGORIES: FaqCategory[] = [
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
        answer:
          'Si vous ne parvenez pas à valider votre réservation, nous vous invitons à renouveler l’opération ultérieurement.'
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
        answer:
          'Conformément aux dispositions légales, nous ne conservons vos données que dans le cadre de votre réservation. Voir plus de détails sur notre page politique de confidentialité : https://resacolo.com/confidentialite'
      },
      {
        question: 'Comment modifier ou mettre à jour mes données personnelles ?',
        answer: 'Dans votre espace personnel, vous pouvez actualiser l’ensemble des informations saisies.'
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

export function getAllFaqPairs() {
  return FAQ_CATEGORIES.flatMap((category) => category.pairs);
}
