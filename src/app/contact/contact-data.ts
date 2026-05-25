export const CONTACT_COLORS = {
  blue: '#37B5F5',
  orange: '#FA8500'
} as const;

export const CONTACT_HERO_VISUAL = {
  src: '/image/contact/resacolo-contact-anim.webp',
  alt: 'Illustration Resacolo pour la page de contact',
  width: 564,
  height: 183
} as const;

export type ContactFaqItem = {
  question: string;
  answer: string;
};

export const CONTACT_FAQ_ITEMS: ContactFaqItem[] = [
  {
    question: 'Processus de réservation',
    answer:
      "Vous sélectionnez sur la plateforme le séjour de votre choix puis vous validez votre demande. L'organisateur vous recontacte pour finaliser l'inscription et vous transmettre les informations utiles."
  },
  {
    question: "J'ai une question sur un séjour",
    answer:
      "Votre interlocuteur principal reste l'organisateur du séjour. Vous pouvez le joindre directement via le formulaire de cette page."
  },
  {
    question: "Email de confirmation d'inscription non reçu",
    answer:
      "Après validation, vous devez recevoir les messages de confirmation. Si ce n'est pas le cas, contactez la plateforme Resacolo ou l'organisateur depuis ce formulaire."
  },
  {
    question: 'Modifier ou annuler un séjour',
    answer:
      "Vous pouvez demander une modification ou une annulation depuis votre espace client ou directement auprès de l'organisateur si le dossier est déjà en cours de traitement."
  },
  {
    question: 'Signification du prix "À partir de..."',
    answer:
      "Le prix affiché correspond au coût minimum du séjour. Les options (transport, activités, assurances, etc.) peuvent s'ajouter lors de la finalisation."
  },
  {
    question: 'Paiement',
    answer:
      "Le règlement est effectué directement à l'organisateur selon ses propres modalités et conditions générales de vente."
  },
  {
    question: "Remboursement et frais d'annulation",
    answer:
      "Les conditions d'annulation et de remboursement dépendent de l'organisateur. Elles sont détaillées dans ses conditions générales de vente."
  },
  {
    question: 'Sous quel délai vais-je recevoir une réponse ?',
    answer:
      "Les délais varient selon la demande et l'interlocuteur concerné. Resacolo et les organisateurs répondent dans les meilleurs délais."
  }
];
