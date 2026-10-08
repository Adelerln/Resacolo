/**
 * Contenu éditorial des guides d'utilisation par profil.
 * Source de vérité fonctionnelle :
 *  - Admin / Commercial : `ADMIN_NAV_LINKS` et `ADMIN_ACCESS_SECTIONS` (src/lib/admin-access.ts)
 *  - Organisateur : `/organisme` (src/lib/organizer-access.ts)
 *  - Partenaire : `/partenaire` (src/lib/partner-access.ts)
 */
import type { GuideChapter, ProfileGuide } from './profile-user-guide-pdf';

/* -------------------------------------------------------------------------- */
/*  Chapitres communs                                                          */
/* -------------------------------------------------------------------------- */

function supportChapter(options: {
  intro: string;
  extraRows?: string[][];
  inApp?: string;
}): GuideChapter {
  return {
    title: 'Support et ressources',
    summary: options.intro,
    blocks: [
      {
        type: 'table',
        headers: ['Besoin', 'Où le trouver', 'Quand l’utiliser'],
        widths: [2.2, 3, 3.4],
        rows: [
          ...(options.inApp ? [['Assistance dans l’espace', options.inApp, 'Pour toute question liée à votre compte ou à un écran précis.']] : []),
          ['Écrire à l’équipe', 'contact@resacolo.com', 'Question générale, accès bloqué, demande d’évolution.'],
          ['Site public', 'https://resacolo.com', 'Vérifier le rendu côté familles, consulter la FAQ et les CGV.'],
          ['Page Contact', 'https://resacolo.com/contact', 'Formulaire de contact pour être rappelé par l’équipe.'],
          ...(options.extraRows ?? [])
        ]
      },
      { type: 'h3', text: 'Pour obtenir une réponse rapide' },
      {
        type: 'steps',
        steps: [
          {
            title: 'Décrivez le contexte',
            detail:
              'Indiquez votre **profil**, l’**écran concerné** (par exemple « Réservations ») et ce que vous vouliez faire.'
          },
          {
            title: 'Joignez les repères utiles et précisez l’urgence',
            detail:
              'Ajoutez la référence de la réservation, le nom du séjour ou de l’organisme et une **capture d’écran** si une erreur s’affiche. Un paiement bloqué ou une publication imminente sont traités en priorité si vous le mentionnez.'
          }
        ]
      },
      {
        type: 'tip',
        title: 'Ne partagez jamais votre mot de passe',
        text: 'L’équipe Resacolo ne vous le demandera jamais. En cas de doute sur un accès, changez-le sans attendre.'
      }
    ]
  };
}

/* -------------------------------------------------------------------------- */
/*  1. ADMINISTRATEUR                                                          */
/* -------------------------------------------------------------------------- */

const adminGuide: ProfileGuide = {
  slug: 'admin',
  fileName: 'Resacolo-Guide-Admin.pdf',
  profileName: 'Administrateur',
  profileTagline: 'Pilotage complet de la plateforme',
  spaceUrl: 'resacolo.com/admin',
  audience: 'Administrateur Resacolo',
  abstract:
    'Ce guide accompagne l’équipe d’administration dans le pilotage quotidien de la plateforme : suivi des séjours et des hébergements, traitement des réservations, lecture des recettes, gestion des organismes, des partenaires et des comptes du back-office.',
  learningGoals: [
    'Naviguer dans le back-office et repérer en un coup d’œil les points d’attention',
    'Suivre et corriger le statut d’un séjour ou d’une réservation',
    'Lire le journal des recettes et paramétrer les commissions',
    'Créer et administrer organismes, partenaires et utilisateurs'
  ],
  chapters: [
    {
      title: 'Démarrer dans l’espace Admin',
      summary: 'Se connecter, comprendre le menu et repérer ce que votre profil permet de modifier.',
      path: '/admin',
      access: 'Administrateur',
      blocks: [
        {
          type: 'steps',
          steps: [
            {
              title: 'Connectez-vous avec votre compte personnel',
              detail: 'Rendez-vous sur **resacolo.com/login**, saisissez votre e-mail et votre mot de passe. Vous êtes redirigé vers le **Dashboard admin**.'
            },
            {
              title: 'Repérez le menu latéral',
              detail: 'Il regroupe 9 modules : Dashboard, Séjours, Hébergements, Recettes, Réservations, Demandes, Utilisateurs, Organismes et Partenaires.'
            },
            {
              title: 'Parcourez le Dashboard',
              detail: 'Les cartes chiffrées (séjours publiés, brouillons, organismes, réservations à traiter) sont cliquables et ouvrent la liste filtrée correspondante.'
            },
            {
              title: 'Déconnectez-vous en fin de session',
              detail: 'Le bouton **Déconnexion** se trouve en bas du menu. Utilisez-le systématiquement sur un poste partagé.'
            }
          ]
        },
        {
          type: 'table',
          headers: ['Module', 'Ce que vous y faites'],
          widths: [2, 6],
          rows: [
            ['Dashboard', 'Vue d’ensemble, actions rapides, points d’attention'],
            ['Séjours / Hébergements', 'Contrôler le catalogue publié par les organisateurs'],
            ['Recettes', 'Consulter les commissions constatées par période'],
            ['Réservations / Demandes', 'Traiter les commandes et les demandes entrantes'],
            ['Organismes / Partenaires', 'Créer, paramétrer et accompagner les comptes'],
            ['Utilisateurs', 'Gérer les accès du back-office']
          ]
        }
      ]
    },
    {
      title: 'Dashboard : piloter l’activité',
      summary: 'Mesurer le catalogue, les réservations par saison et les points d’attention.',
      path: '/admin',
      access: 'Administrateur',
      blocks: [
        {
          type: 'steps',
          steps: [
            {
              title: 'Lisez les quatre indicateurs du catalogue',
              detail: '**Séjours publiés**, **séjours en brouillon**, **séjours archivés et masqués** et nombre d’**organismes**.'
            },
            {
              title: 'Contrôlez les réservations à traiter',
              detail: 'La carte « Réservations à traiter » ouvre directement la liste filtrée sur le statut **Demande à traiter**.'
            },
            {
              title: 'Comparez les saisons',
              detail: 'Chaque carte saison (ex. Été, Hiver) indique le nombre de réservations et renvoie vers la liste filtrée par saison et par année.'
            },
            {
              title: 'Utilisez les actions rapides',
              detail: 'Accédez en un clic à la gestion des séjours, des organismes, des recettes ou des utilisateurs du back-office.'
            }
          ]
        },
        {
          type: 'important',
          title: 'Points d’attention',
          text: 'Le bloc « Points d’attention » signale les réservations en attente et les organismes dont la **complétude de profil est inférieure à 70 %**. Traitez-les en priorité : un profil incomplet dégrade l’expérience des familles.'
        }
      ]
    },
    {
      title: 'Séjours et hébergements',
      summary: 'Contrôler tout le catalogue et corriger un statut sans passer par l’espace de l’organisateur.',
      path: '/admin/sejours · /admin/hebergements',
      access: 'Administrateur',
      blocks: [
        { type: 'h3', text: 'Modifier le statut d’un séjour' },
        {
          type: 'steps',
          steps: [
            { title: 'Ouvrez « Séjours »', detail: 'La liste « Tous les séjours » affiche le titre, l’organisateur, la saison et le statut.' },
            {
              title: 'Choisissez le nouveau statut',
              detail: 'Dans la ligne du séjour : **Brouillon**, **Publié**, **Masqué** ou **Archivé**.'
            },
            { title: 'Validez avec OK', detail: 'Le changement est immédiat. Un séjour masqué disparaît du catalogue public sans être supprimé.' },
            { title: 'Cliquez sur « Editer » pour le détail', detail: 'Vous ouvrez le tunnel d’édition complet : sessions, options, transports, partenaires, SEO.' }
          ]
        },
        { type: 'h3', text: 'Consulter les hébergements' },
        {
          type: 'steps',
          steps: [
            { title: 'Ouvrez « Hébergements »', detail: 'Filtrez par **organisateur** puis cliquez sur **Filtrer** ; **Réinitialiser** efface le filtre.' },
            { title: 'Ouvrez une fiche', detail: 'Informations générales, adresse, contenus, médias et **séjours liés** sont regroupés sur une seule page.' }
          ]
        },
        {
          type: 'tip',
          text: 'Avant d’archiver un séjour, vérifiez qu’aucune session n’a de réservation en cours : préférez **Masqué** pour retirer une offre temporairement.'
        }
      ]
    },
    {
      title: 'Réservations',
      summary: 'Suivre toutes les commandes de la plateforme et faire évoluer leur statut.',
      path: '/admin/reservations',
      access: 'Administrateur',
      blocks: [
        {
          type: 'steps',
          steps: [
            { title: 'Filtrez la liste', detail: 'Depuis le Dashboard (statut ou saison) ou via l’URL ; le bandeau « Filtre actif » rappelle les critères et propose **Réinitialiser**.' },
            { title: 'Identifiez la commande', detail: 'Chaque ligne indique le séjour, la session, le client (et le nombre de participants), la collectivité et le statut.' },
            { title: 'Sélectionnez le nouveau statut', detail: 'Le menu déroulant propose les statuts ci-dessous.' },
            { title: 'Cliquez sur OK', detail: 'Les dates associées (paiement, annulation, transfert) sont mises à jour automatiquement.' }
          ]
        },
        {
          type: 'table',
          headers: ['Statut', 'Signification'],
          widths: [2.6, 5.4],
          rows: [
            ['Demande à traiter', 'Commande reçue, en attente d’une action (aide VACAF, ANCV, partenaire…).'],
            ['En attente de paiement', 'La famille doit encore régler.'],
            ['Partiellement payée', 'Acompte reçu, solde restant dû.'],
            ['Payée', 'Commande soldée.'],
            ['Annulée · Échec de paiement', 'Commande abandonnée ou paiement refusé.'],
            ['Transférée', 'Commande transférée vers un autre traitement.']
          ]
        },
        {
          type: 'important',
          text: 'Changer un statut à la main n’envoie pas d’encaissement : il corrige l’état de la commande. Vérifiez le paiement réel avant de passer une commande en **Payée**.'
        }
      ]
    },
    {
      title: 'Recettes',
      summary: 'Lire le journal des commissions constatées au paiement des commandes.',
      path: '/admin/finances',
      access: 'Administrateur',
      blocks: [
        {
          type: 'steps',
          steps: [
            { title: 'Choisissez l’année', detail: 'La liste couvre l’année en cours et plusieurs années précédentes.' },
            { title: 'Sélectionnez le regroupement', detail: 'Par **organisme**, **mois**, **saison** ou **année** selon l’analyse souhaitée.' },
            { title: 'Cliquez sur Actualiser', detail: 'Le tableau affiche le CA des lignes de commande (TTC), la commission clients et la commission partenaires, avec une ligne **Total**.' },
            { title: 'Ouvrez le détail', detail: 'Le bouton de détail d’une ligne liste les écritures qui composent le montant.' }
          ]
        },
        {
          type: 'tip',
          text: 'Le lien « Paramètres business globaux » en haut de page vous conduit directement aux taux de commission (voir chapitre Organismes).'
        }
      ]
    },
    {
      title: 'Demandes entrantes',
      summary: 'Traiter les demandes de partenariat et d’adhésion reçues depuis le site public.',
      path: '/admin/demandes',
      access: 'Administrateur',
      blocks: [
        { type: 'h3', text: 'Configurer les alertes e-mail' },
        {
          type: 'steps',
          steps: [
            { title: 'Saisissez les deux adresses', detail: 'Un destinataire pour les demandes **Partenaires** et un pour les demandes **Organisateurs**.' },
            { title: 'Cliquez sur « Enregistrer les destinataires »', detail: 'Un message de confirmation s’affiche ; chaque nouvelle demande déclenche une alerte.' }
          ]
        },
        { type: 'h3', text: 'Traiter une demande' },
        {
          type: 'steps',
          steps: [
            { title: 'Parcourez « À traiter »', detail: 'Chaque fiche présente la structure, le contact, la formule, les informations d’agrément et le message.' },
            { title: 'Contactez le demandeur', detail: 'Répondez par e-mail ou téléphone, puis créez l’organisme ou le partenaire si la demande est validée.' },
            { title: 'Marquez la demande comme traitée', detail: 'Elle passe dans la section **Traitées** avec sa date de résolution.' }
          ]
        }
      ]
    },
    {
      title: 'Organismes et commissions',
      summary: 'Créer un organisme, suivre son profil et régler les taux de commission de la plateforme.',
      path: '/admin/organizers',
      access: 'Administrateur',
      blocks: [
        { type: 'h3', text: 'Créer un organisme' },
        {
          type: 'steps',
          steps: [
            { title: 'Ouvrez « Organismes » puis la création', detail: 'Le formulaire crée l’**organisme** et son **compte principal** en une seule fois.' },
            { title: 'Renseignez l’identité', detail: 'Nom, coordonnées, puis informations du premier utilisateur avec un **mot de passe temporaire** conforme à la politique de sécurité.' },
            { title: 'Complétez la fiche', detail: 'Dans la fiche : informations générales, **statut organisme**, modes de règlement et aides, complément catalogue, indicateurs et facturation appliquée.' },
            { title: 'Gérez les membres', detail: 'Ajoutez ou modifiez les utilisateurs rattachés (Propriétaire, Éditeur, Gestionnaire).' }
          ]
        },
        { type: 'h3', text: 'Paramétrer les commissions' },
        {
          type: 'steps',
          steps: [
            { title: 'Dans « Paramètres business globaux »', detail: 'Renseignez la commission **Fondateur**, **Membre** et **Externe** (en %), ainsi que l’éventuel frais de publication.' },
            { title: 'Cliquez sur « Enregistrer et appliquer »', detail: 'Les taux s’appliquent selon le statut de chaque organisme.' }
          ]
        },
        {
          type: 'important',
          text: 'Les changements valent pour les **commissions futures uniquement** : les commissions déjà constatées restent figées dans le journal des recettes.'
        }
      ]
    },
    {
      title: 'Partenaires',
      summary: 'Créer une collectivité ou un CSE partenaire et administrer ses utilisateurs.',
      path: '/admin/partenaires',
      access: 'Administrateur, Commercial',
      blocks: [
        {
          type: 'steps',
          steps: [
            { title: 'Consultez la liste', detail: 'Colonnes triables : nom, code, type d’abonnement (Identité ou Sérénité), e-mail, date de création, utilisateurs, dernière connexion.' },
            { title: 'Cliquez sur « Créer un partenaire »', detail: 'Saisissez le nom, le **code de rattachement** (en majuscules, transmis aux salariés) et l’offre.' },
            { title: 'Créez le compte principal', detail: 'Prénom, nom, e-mail et mot de passe temporaire du premier utilisateur, puis **Créer le partenaire**.' },
            { title: 'Ouvrez « Gérer » pour la suite', detail: 'Mettez à jour les informations générales et ajoutez d’autres utilisateurs partenaires.' }
          ]
        },
        {
          type: 'tip',
          text: 'Le code de rattachement est ce que les salariés saisissent pour bénéficier de la prise en charge : choisissez un code court, lisible et unique.'
        }
      ]
    },
    {
      title: 'Utilisateurs du back-office',
      summary: 'Gérer les accès des membres d’organismes et des comptes commerciaux.',
      path: '/admin/utilisateurs',
      access: 'Administrateur',
      blocks: [
        {
          type: 'steps',
          steps: [
            { title: 'Ouvrez « Utilisateurs »', detail: 'Le tableau liste prénom, nom, e-mail, organisme rattaché et rôle ; chaque colonne est triable.' },
            { title: 'Ajoutez un compte', detail: 'Choisissez le rôle (**Commercial** ou **Compte organisme**), saisissez l’identité et un mot de passe temporaire.' },
            { title: 'Modifiez ou retirez un accès', detail: 'Utilisez l’icône de modification de la ligne ; la suppression retire immédiatement l’accès.' }
          ]
        },
        {
          type: 'important',
          text: 'Appliquez le **principe du moindre privilège** : un collaborateur commercial n’a pas besoin du rôle Administrateur.'
        }
      ]
    },
    {
      title: 'Bonnes pratiques',
      summary: 'Les réflexes qui sécurisent les données et fluidifient le travail de l’équipe.',
      blocks: [
        {
          type: 'bullets',
          items: [
            '**Commencez par le Dashboard** chaque matin : réservations à traiter, profils d’organismes incomplets.',
            '**Préférez « Masqué » à « Archivé »** pour retirer temporairement une offre : l’archivage est plus définitif.',
            '**Vérifiez avant de modifier** : un changement de statut de réservation est tracé et visible des familles.',
            '**Documentez les décisions** auprès de l’équipe (mail récapitulatif) après toute modification de commission.',
            '**Mots de passe temporaires** : demandez à chaque utilisateur de le changer dès la première connexion.',
            '**Déconnectez-vous** après chaque session sur un poste partagé.'
          ]
        },
        {
          type: 'tip',
          text: 'Utilisez les cartes du Dashboard comme raccourcis : elles ouvrent les listes déjà filtrées, ce qui évite de reconstruire vos filtres.'
        }
      ]
    },
    supportChapter({ intro: 'Où trouver de l’aide et comment formuler une demande efficace.' })
  ]
};

/* -------------------------------------------------------------------------- */
/*  2. ORGANISATEUR                                                            */
/* -------------------------------------------------------------------------- */

const organizerGuide: ProfileGuide = {
  slug: 'organisateur',
  fileName: 'Resacolo-Guide-Organisateur.pdf',
  profileName: 'Organisateur',
  profileTagline: 'Publier et gérer vos séjours',
  spaceUrl: 'resacolo.com/organisme',
  audience: 'Organisme de séjours',
  abstract:
    'Ce guide vous accompagne dans l’espace Organisateur : compléter la fiche de votre organisme, créer et publier vos séjours, gérer vos hébergements, suivre les réservations et répondre aux demandes des familles.',
  learningGoals: [
    'Compléter votre fiche organisateur et déposer vos CGV',
    'Créer un séjour, de l’import à la publication',
    'Suivre vos réservations et enregistrer les aides VACAF / ANCV',
    'Inviter votre équipe et choisir les bons rôles'
  ],
  chapters: [
    {
      title: 'Démarrer et comprendre les rôles',
      summary: 'Se connecter, choisir son organisme et savoir ce que chaque rôle peut faire.',
      path: '/organisme',
      access: 'Tous les rôles',
      blocks: [
        {
          type: 'steps',
          steps: [
            { title: 'Connectez-vous', detail: 'Rendez-vous sur **resacolo.com/login** avec l’e-mail et le mot de passe fournis par Resacolo.' },
            { title: 'Sélectionnez votre organisme', detail: 'Si votre compte est rattaché à plusieurs organismes, choisissez celui à gérer dans le menu : toutes les pages se filtrent ensuite sur lui.' },
            { title: 'Repérez le menu', detail: 'Le menu latéral n’affiche que les modules autorisés pour votre rôle.' },
            { title: 'Sécurisez votre compte', detail: 'Ouvrez **Sécurité du compte** (en bas du menu) pour modifier votre mot de passe.' }
          ]
        },
        {
          type: 'table',
          headers: ['Module', 'Propriétaire', 'Éditeur', 'Gestionnaire'],
          widths: [3.2, 1.6, 1.6, 1.8],
          rows: [
            ['Dashboard', 'Oui', 'Oui', 'Oui'],
            ['Fiche organisateur', 'Oui', 'Selon droits', 'Non'],
            ['Séjours · Hébergements', 'Oui', 'Oui', 'Non'],
            ['Réservations · Demandes', 'Oui', 'Oui', 'Oui'],
            ['Montants partenaires · Assistance', 'Oui', 'Oui', 'Oui'],
            ['Utilisateurs', 'Oui', 'Non', 'Non']
          ]
        }
      ]
    },
    {
      title: 'Dashboard : suivre vos séjours',
      summary: 'Remplissage, séjours complets et priorités, sur un seul écran.',
      path: '/organisme',
      access: 'Tous les rôles',
      blocks: [
        {
          type: 'steps',
          steps: [
            { title: 'Lisez les indicateurs', detail: 'Séjours proposés, réservations, **taux de remplissage**, sessions complètes et ouvertes.' },
            { title: 'Repérez les actions prioritaires', detail: 'Séjours les plus réservés, les plus consultés et ceux qui sont **complets**.' },
            { title: 'Parcourez le suivi des séjours', detail: 'Le tableau indique le statut, les sessions, les réservations et la visibilité de chaque séjour.' },
            { title: 'Utilisez les raccourcis', detail: 'Accédez directement à la gestion des séjours et des réservations.' }
          ]
        }
      ]
    },
    {
      title: 'Fiche organisateur',
      summary: 'L’identité publique de votre organisme, vos aides acceptées et vos documents.',
      path: '/organisme/organisateur',
      access: 'Propriétaire',
      blocks: [
        {
          type: 'steps',
          steps: [
            { title: 'Renseignez l’identité', detail: 'Nom, e-mail de contact, année de création et tranche d’âge accueillie.' },
            { title: 'Indiquez vos modes de règlement', detail: 'Chèques-vacances papier, **ANCV Connect**, agrément **VACAF / CAF AVE**.' },
            { title: 'Rédigez vos textes', detail: 'Une accroche sous le titre et une présentation détaillée de votre organisme.' },
            { title: 'Déposez vos documents', detail: 'Logo (PNG ou JPG), **projet éducatif** (PDF) et **CGV organisateur** (PDF).' },
            { title: 'Complétez votre catalogue d’offre', detail: 'Saisons, activités, types de séjours, durées minimale et maximale, puis enregistrez.' }
          ]
        },
        {
          type: 'important',
          title: 'CGV obligatoires',
          text: 'Un PDF de Conditions Générales de Vente est exigé pour enregistrer la fiche : les familles le téléchargent au récapitulatif de commande. Sans CGV, la sauvegarde est refusée.'
        }
      ]
    },
    {
      title: 'Créer et publier un séjour',
      summary: 'Du brouillon à la mise en ligne : un tunnel guidé, avec contrôle du rendu avant publication.',
      path: '/organisme/sejours',
      access: 'Propriétaire, Éditeur',
      blocks: [
        {
          type: 'steps',
          steps: [
            { title: 'Cliquez sur « Créer un séjour »', detail: 'Choisissez **Import via URL** (préremplissage depuis votre site) ou **Brouillon manuel**.' },
            { title: 'Importez ou créez le brouillon', detail: 'Pour l’import : collez l’URL de votre fiche, rattachez un hébergement existant si besoin, lancez l’enrichissement.' },
            {
              title: 'Relisez le brouillon en 8 étapes',
              detail: 'Hébergement (obligatoire) · Séjour · Photos et liens · Sessions · Options · Transports · Partenaires · SEO.'
            },
            { title: 'Enregistrez puis validez le visuel', detail: 'Utilisez **Enregistrer le brouillon** à tout moment ; **Valider le visuel** ouvre l’aperçu.' },
            { title: 'Contrôlez l’aperçu public', detail: 'Vérifiez la carte du catalogue et la fiche détaillée, telles que les familles les verront.' },
            { title: 'Cliquez sur « Publier maintenant »', detail: 'Le séjour est en ligne immédiatement.' }
          ]
        },
        {
          type: 'tip',
          text: 'Depuis la liste, basculez un séjour entre **Publié** et **Masqué** sans le republier, et ajustez les **places restantes** d’une session directement dans le tableau.'
        }
      ]
    },
    {
      title: 'Hébergements',
      summary: 'Un catalogue de lieux réutilisables, liés à vos séjours.',
      path: '/organisme/hebergements',
      access: 'Propriétaire, Éditeur',
      blocks: [
        {
          type: 'steps',
          steps: [
            { title: 'Créez une fiche lieu', detail: 'Choisissez le type, l’adresse (ou la zone pour un séjour itinérant) et rédigez la description.' },
            { title: 'Détaillez les équipements', detail: 'Couchages, sanitaires, restauration et accessibilité.' },
            { title: 'Ajoutez médias et carte', detail: 'Photos, coordonnées ou intégration Google Maps.' },
            { title: 'Archivez quand le lieu n’est plus utilisé', detail: 'Il disparaît des sélecteurs de création de séjour, sans perdre l’historique.' }
          ]
        }
      ]
    },
    {
      title: 'Réservations et aides',
      summary: 'Suivre les commandes de vos séjours et enregistrer les aides externes reçues.',
      path: '/organisme/reservations',
      access: 'Tous les rôles',
      blocks: [
        {
          type: 'steps',
          steps: [
            { title: 'Parcourez le tableau', detail: 'Client, séjour, session, enfant, statut, traitement organisme, collectivité et montant.' },
            { title: 'Ouvrez le détail d’une commande', detail: 'Une fenêtre récapitule la famille, le séjour et les paiements.' },
            { title: 'Enregistrez l’aide VACAF', detail: 'Saisissez le montant CAF puis **Enregistrer le montant CAF**.' },
            { title: 'Enregistrez l’aide ANCV Connect', detail: 'Saisissez le montant reçu puis **Enregistrer le montant ANCV**.' }
          ]
        },
        {
          type: 'important',
          text: 'Le **reste dû par la famille** est recalculé automatiquement, y compris après déduction d’une part CSE approuvée. Vérifiez-le avant de relancer une famille.'
        }
      ]
    },
    {
      title: 'Demandes, montants partenaires et assistance',
      summary: 'Répondre aux familles, suivre la prise en charge des CSE et contacter l’équipe Resacolo.',
      path: '/organisme/demandes · /organisme/montants-partenaires · /organisme/assistance',
      access: 'Tous les rôles',
      blocks: [
        { type: 'h3', text: 'Traiter une demande' },
        {
          type: 'steps',
          steps: [
            { title: 'Ouvrez « Demandes »', detail: 'La liste affiche la date, le statut, le type, le contact et le sujet des demandes transmises.' },
            { title: 'Consultez le détail et répondez', detail: 'Contactez la famille avec les éléments fournis.' },
            { title: 'Cliquez sur « Marquer comme résolu »', detail: 'La demande quitte votre liste de suivi.' }
          ]
        },
        { type: 'h3', text: 'Solliciter l’assistance technique' },
        {
          type: 'steps',
          steps: [
            { title: 'Ouvrez « Assistance technique »', detail: 'Cliquez sur **Nouvelle demande**.' },
            { title: 'Choisissez la catégorie', detail: 'Technique, catalogue, réservations et paiements, facturation ou autre, puis rédigez le sujet et le message.' },
            { title: 'Suivez la réponse', detail: 'Vos demandes et leur statut restent listés sur la même page.' }
          ]
        }
      ]
    },
    {
      title: 'Utilisateurs de votre équipe',
      summary: 'Inviter vos collègues et leur attribuer le bon rôle.',
      path: '/organisme/utilisateurs',
      access: 'Propriétaire',
      blocks: [
        {
          type: 'steps',
          steps: [
            { title: 'Ajoutez un utilisateur', detail: 'Saisissez prénom, nom et e-mail.' },
            { title: 'Choisissez le rôle', detail: '**Propriétaire** (tous droits), **Éditeur** (séjours et hébergements), **Gestionnaire** (réservations et demandes).' },
            { title: 'Définissez un mot de passe temporaire', detail: 'Il doit respecter la politique de sécurité ; invitez la personne à le changer à sa première connexion.' }
          ]
        },
        {
          type: 'tip',
          text: 'Pour un départ de collaborateur, supprimez son accès le jour même ; vous pouvez aussi réinitialiser un mot de passe depuis la même page.'
        }
      ]
    },
    {
      title: 'Bonnes pratiques',
      summary: 'Les habitudes qui augmentent la qualité de votre catalogue et la confiance des familles.',
      blocks: [
        {
          type: 'bullets',
          items: [
            '**Soignez les photos et la description** : ce sont les premiers critères de choix des familles.',
            '**Mettez à jour les places restantes** dès qu’une inscription arrive par un autre canal.',
            '**Traitez les réservations à traiter chaque jour** : saisissez rapidement les aides VACAF et ANCV.',
            '**Gardez des CGV à jour** : elles sont remises à chaque famille au moment de la commande.',
            '**Limitez les rôles Propriétaire** à une ou deux personnes de confiance.'
          ]
        }
      ]
    },
    supportChapter({
      intro: 'Une équipe disponible pour vous aider, directement depuis votre espace.',
      inApp: 'Menu « Assistance technique »'
    })
  ]
};

/* -------------------------------------------------------------------------- */
/*  3. PARTENAIRE                                                              */
/* -------------------------------------------------------------------------- */

const partnerGuide: ProfileGuide = {
  slug: 'partenaire',
  fileName: 'Resacolo-Guide-Partenaire.pdf',
  profileName: 'Partenaire',
  profileTagline: 'CSE, collectivités et comités sociaux',
  spaceUrl: 'resacolo.com/partenaire',
  audience: 'CSE et collectivités',
  abstract:
    'Ce guide présente l’espace Partenaire : paramétrer votre prise en charge, définir les séjours éligibles, accompagner vos bénéficiaires et suivre les réservations réalisées avec votre code de rattachement.',
  learningGoals: [
    'Choisir votre mode de financement et le publier au catalogue',
    'Définir les séjours éligibles pour vos bénéficiaires',
    'Transmettre votre code et suivre vos ayants droit',
    'Suivre les réservations et la part prise en charge'
  ],
  chapters: [
    {
      title: 'Démarrer et comprendre les accès',
      summary: 'Se connecter et savoir ce que chaque rôle partenaire peut consulter ou modifier.',
      path: '/partenaire',
      access: 'Admin, Gestion bénéficiaires',
      blocks: [
        {
          type: 'steps',
          steps: [
            { title: 'Connectez-vous', detail: 'Rendez-vous sur **resacolo.com/login** avec les identifiants fournis par Resacolo.' },
            { title: 'Découvrez le Dashboard', detail: 'Il présente votre activité sur 30 jours et l’accompagnement de démarrage.' },
            { title: 'Repérez le menu', detail: 'Les modules visibles dépendent de votre rôle et de votre offre.' },
            { title: 'Sécurisez votre compte', detail: 'Utilisez **Sécurité du compte** (en bas du menu) pour changer votre mot de passe.' }
          ]
        },
        {
          type: 'table',
          headers: ['Rôle', 'Modules accessibles'],
          widths: [3, 5],
          rows: [
            ['Admin', 'Dashboard, Fiche partenaire, Bénéficiaires, Catalogue, Financement, Commandes Organisateurs, Marque blanche (offre Identité), Réservations'],
            ['Gestion bénéficiaires et réservations', 'Dashboard, Bénéficiaires, Réservations']
          ]
        }
      ]
    },
    {
      title: 'Dashboard : suivre votre activité',
      summary: 'Les indicateurs clés des 30 derniers jours et l’onboarding de vos bénéficiaires.',
      path: '/partenaire',
      access: 'Admin, Gestion bénéficiaires',
      blocks: [
        {
          type: 'steps',
          steps: [
            { title: 'Suivez le bandeau de démarrage', detail: 'Tant qu’aucun bénéficiaire n’est rattaché, il rappelle votre **code de rattachement** et les prochaines actions.' },
            { title: 'Lisez les indicateurs', detail: 'Ayants droit actifs, réservations sur 30 jours, taux de finalisation, montant total et **part du partenaire**.' },
            { title: 'Analysez les graphiques', detail: 'Évolution dans le temps et répartition des statuts de commande.' },
            { title: 'Consultez les dernières réservations', detail: 'Ainsi que les séjours les plus choisis par vos bénéficiaires.' }
          ]
        },
        {
          type: 'tip',
          text: 'Si de nouveaux pays apparaissent au catalogue Resacolo, une alerte vous invite à décider s’ils sont éligibles pour vos bénéficiaires.'
        }
      ]
    },
    {
      title: 'Financement : choisir votre prise en charge',
      summary: 'Le mode global qui détermine la part payée par votre structure au moment de la commande.',
      path: '/partenaire/financement',
      access: 'Admin',
      blocks: [
        {
          type: 'steps',
          steps: [
            { title: 'Ouvrez « Financement »', detail: 'Le mode actuel et son aide contextuelle sont affichés.' },
            { title: 'Sélectionnez un mode', detail: 'Comparez les cinq modes dans le tableau ci-dessous.' },
            { title: 'Renseignez le pourcentage ou le montant', detail: 'Selon le mode choisi, saisissez la quote-part en % ou le forfait en euros.' },
            { title: 'Ajoutez vos règles si besoin', detail: 'Un texte libre précise vos conditions et enregistrez.' }
          ]
        },
        {
          type: 'table',
          headers: ['Mode', 'Effet pour la famille'],
          widths: [2.6, 5.4],
          rows: [
            ['Prise en charge totale', 'Votre structure finance 100 % du séjour éligible.'],
            ['Pas de financement', 'La famille règle l’intégralité du séjour.'],
            ['Quote-part en %', 'Un pourcentage global est pris en charge.'],
            ['Quote-part fixe', 'Un forfait en euros est déduit du séjour.'],
            ['Calcul manuel', 'Barème par quotient familial (QF) défini au catalogue.']
          ]
        }
      ]
    },
    {
      title: 'Catalogue éligible',
      summary: 'Définir quels séjours vos bénéficiaires peuvent réserver, et à quelles conditions.',
      path: '/partenaire/catalogue',
      access: 'Admin',
      blocks: [
        {
          type: 'steps',
          steps: [
            { title: 'Fixez les critères d’éligibilité', detail: 'Âge, prix, durée, saisons, types de séjours et organisateurs autorisés.' },
            { title: 'Autorisez ou refusez des pays', detail: 'Chaque pays peut être ouvert ou fermé à vos bénéficiaires.' },
            { title: 'En calcul manuel : définissez les règles financières', detail: 'Plafonds, filtre QF minimum et maximum, barème par tranche (en % ou en forfait).' },
            { title: 'Prévisualisez les sessions éligibles', detail: 'Contrôlez le résultat avant d’enregistrer.' },
            { title: 'Enregistrez', detail: 'Si les règles sont valides, elles sont **publiées** et utilisées immédiatement à la commande.' }
          ]
        },
        {
          type: 'important',
          title: 'Enregistrer = publier',
          text: 'Chaque enregistrement valide met à jour les règles appliquées au moment de la commande. Vérifiez la prévisualisation avant de sauvegarder.'
        }
      ]
    },
    {
      title: 'Bénéficiaires',
      summary: 'Transmettre votre code de rattachement et suivre vos ayants droit.',
      path: '/partenaire/beneficiaires',
      access: 'Admin, Gestion bénéficiaires',
      blocks: [
        {
          type: 'steps',
          steps: [
            { title: 'Communiquez votre code', detail: 'Le **code de rattachement** est affiché en haut de page : transmettez-le à vos salariés ou agents.' },
            { title: 'Suivez les rattachements', detail: 'Identité, e-mail, téléphone, ville et date de rattachement de chaque ayant droit.' },
            { title: 'En calcul manuel : saisissez le QF', detail: 'Renseignez le quotient familial et sa **date d’expiration**, puis enregistrez.' }
          ]
        },
        {
          type: 'important',
          text: 'Les champs QF n’existent qu’en mode **Calcul manuel**. Une mise à jour du QF peut recalculer la part prise en charge des commandes concernées.'
        }
      ]
    },
    {
      title: 'Réservations et commandes organisateurs',
      summary: 'Suivre les commandes passées avec votre code et la part que vous prenez en charge.',
      path: '/partenaire/reservations · /partenaire/montants-organisateurs',
      access: 'Admin, Gestion bénéficiaires',
      blocks: [
        { type: 'h3', text: 'Suivre les réservations' },
        {
          type: 'steps',
          steps: [
            { title: 'Ouvrez « Réservations »', detail: 'Commande, bénéficiaire, séjour, participants et statut.' },
            { title: 'Lisez les montants', detail: 'Total, **part partenaire** et reste à charge de la famille.' },
            { title: 'En calcul manuel : ajustez la part', detail: 'Saisissez le montant et un message pour la famille, puis enregistrez : la contribution est approuvée et recalculée.' }
          ]
        },
        { type: 'h3', text: 'Analyser les commandes par organisateur' },
        {
          type: 'steps',
          steps: [
            { title: 'Ouvrez « Commandes Organisateurs »', detail: 'Choisissez la saison à analyser.' },
            { title: 'Consultez la synthèse', detail: 'Les montants de prise en charge sont agrégés par organisme, avec leurs indicateurs.' }
          ]
        }
      ]
    },
    {
      title: 'Fiche partenaire et marque blanche',
      summary: 'Votre identité, vos interlocuteurs et la personnalisation de l’expérience des familles.',
      path: '/partenaire/fiche · /partenaire/marque-blanche',
      access: 'Admin',
      blocks: [
        {
          type: 'steps',
          steps: [
            { title: 'Vérifiez votre fiche', detail: 'Nom, offre (Identité ou Sérénité) et adresse postale de votre structure.' },
            { title: 'Gérez vos interlocuteurs', detail: 'Contacts et membres d’accès, avec le rôle **Admin** ou **Gestion bénéficiaires**.' },
            { title: 'Personnalisez la marque blanche', detail: 'Logo (5 Mo maximum), URL de redirection, texte d’accueil et bandeau avec bouton d’action.' }
          ]
        },
        {
          type: 'important',
          title: 'Offre Identité requise',
          text: 'La marque blanche n’est disponible qu’avec l’offre **Identité**. Le bouton d’action n’apparaît que si son texte et son lien sont renseignés.'
        }
      ]
    },
    {
      title: 'Bonnes pratiques',
      summary: 'Un parcours simple pour lancer, puis entretenir votre dispositif.',
      blocks: [
        { type: 'h3', text: 'Parcours de lancement recommandé' },
        {
          type: 'steps',
          steps: [
            { title: 'Financement', detail: 'Choisissez votre mode de prise en charge.' },
            { title: 'Catalogue', detail: 'Réglez l’éligibilité (et le barème QF en calcul manuel), puis enregistrez.' },
            { title: 'Bénéficiaires', detail: 'Diffusez votre code et saisissez les QF avec leur date d’expiration.' },
            { title: 'Dashboard', detail: 'Suivez le premier mois, puis ajustez vos règles.' }
          ]
        },
        {
          type: 'tip',
          text: 'Planifiez une revue chaque saison : critères de catalogue, nouveaux pays à arbitrer et QF arrivant à expiration.'
        }
      ]
    },
    supportChapter({ intro: 'Votre interlocuteur Resacolo reste disponible pour vous accompagner.' })
  ]
};

/* -------------------------------------------------------------------------- */
/*  4. COMMERCIAL (ADMIN_SALES)                                                */
/* -------------------------------------------------------------------------- */

const salesGuide: ProfileGuide = {
  slug: 'commercial',
  fileName: 'Resacolo-Guide-Commercial.pdf',
  profileName: 'Commercial',
  profileTagline: 'Développer et animer le réseau partenaires',
  spaceUrl: 'resacolo.com/admin',
  audience: 'Équipe commerciale',
  abstract:
    'Ce guide s’adresse aux commerciaux Resacolo. Votre espace est une version ciblée du back-office : vous créez et animez les partenaires, et vous suivez les réservations en lecture seule pour accompagner vos comptes.',
  learningGoals: [
    'Comprendre le périmètre de votre profil commercial',
    'Créer un partenaire et son premier compte utilisateur',
    'Ajouter ou mettre à jour les utilisateurs d’un partenaire',
    'Suivre les réservations pour accompagner vos comptes'
  ],
  chapters: [
    {
      title: 'Démarrer avec l’espace commercial',
      summary: 'Se connecter et comprendre ce que votre profil peut consulter ou modifier.',
      path: '/admin',
      access: 'Commercial',
      blocks: [
        {
          type: 'steps',
          steps: [
            { title: 'Connectez-vous', detail: 'Rendez-vous sur **resacolo.com/login**. Vous arrivez sur le **Dashboard commercial**.' },
            { title: 'Repérez les trois modules', detail: 'Le menu comprend **Dashboard**, **Réservations** et **Partenaires**. Les autres modules du back-office ne sont pas accessibles.' },
            { title: 'Déconnectez-vous en fin de session', detail: 'Le bouton **Déconnexion** se trouve en bas du menu.' }
          ]
        },
        {
          type: 'table',
          headers: ['Module', 'Votre droit', 'Usage'],
          widths: [2, 2, 5],
          rows: [
            ['Dashboard', 'Lecture', 'Nombre de partenaires, réservations à traiter, points d’attention'],
            ['Réservations', 'Lecture seule', 'Suivre les commandes de vos comptes sans modifier leur statut'],
            ['Partenaires', 'Lecture et modification', 'Créer, consulter et administrer les partenaires et leurs utilisateurs']
          ]
        },
        {
          type: 'important',
          title: 'Périmètre limité',
          text: 'Les séjours, hébergements, recettes, demandes, organismes et utilisateurs du back-office sont réservés aux administrateurs. Pour toute modification hors de votre périmètre, contactez un administrateur.'
        }
      ]
    },
    {
      title: 'Dashboard commercial',
      summary: 'Les chiffres utiles à votre pilotage : partenaires, réservations et alertes.',
      path: '/admin',
      access: 'Commercial',
      blocks: [
        {
          type: 'steps',
          steps: [
            { title: 'Consultez la carte « Partenaires »', detail: 'Elle donne le nombre de partenaires et ouvre la liste complète.' },
            { title: 'Surveillez les réservations à traiter', detail: 'La carte ouvre la liste filtrée sur le statut **Demande à traiter**.' },
            { title: 'Comparez les saisons', detail: 'Les cartes par saison et année renvoient vers les réservations correspondantes.' },
            { title: 'Passez par les actions rapides', detail: 'Gérer les partenaires, en créer un, voir les réservations à traiter ou toutes les réservations.' }
          ]
        },
        {
          type: 'tip',
          title: 'Point d’attention clé',
          text: 'Le Dashboard signale les **partenaires sans utilisateur rattaché** : ce sont vos premiers comptes à activer.'
        }
      ]
    },
    {
      title: 'Créer un partenaire',
      summary: 'Ouvrir une collectivité ou un CSE et son compte principal en une seule opération.',
      path: '/admin/partenaires/nouveau',
      access: 'Commercial',
      blocks: [
        {
          type: 'steps',
          steps: [
            { title: 'Cliquez sur « Créer un partenaire »', detail: 'Le bouton se trouve en haut de la page **Partenaires**.' },
            { title: 'Renseignez le partenaire', detail: 'Nom, **code de rattachement** (court, unique, en majuscules) et **offre** (Identité ou Sérénité).' },
            { title: 'Saisissez le compte principal', detail: 'Prénom, nom et e-mail du premier utilisateur.' },
            { title: 'Définissez un mot de passe temporaire', detail: 'Respectez la politique de sécurité affichée sous le champ.' },
            { title: 'Validez avec « Créer le partenaire »', detail: 'Le partenaire apparaît dans la liste ; communiquez ensuite les accès à votre contact.' }
          ]
        },
        {
          type: 'table',
          headers: ['Offre', 'À qui la proposer'],
          widths: [2, 6],
          rows: [
            ['Identité', 'Présence de marque et personnalisation visuelle de l’espace partenaire (marque blanche).'],
            ['Sérénité', 'Accompagnement renforcé et paramétrage partenaire plus complet pour un usage opérationnel.']
          ]
        },
        {
          type: 'important',
          text: 'Le code de rattachement est transmis aux salariés pour bénéficier de la prise en charge. Vérifiez-le avant de valider : il identifie votre partenaire.'
        }
      ]
    },
    {
      title: 'Administrer un partenaire',
      summary: 'Mettre à jour une fiche et gérer les accès des interlocuteurs.',
      path: '/admin/partenaires',
      access: 'Commercial',
      blocks: [
        {
          type: 'steps',
          steps: [
            { title: 'Retrouvez le partenaire', detail: 'Triez la liste par nom, code, abonnement, date de création, nombre d’utilisateurs ou dernière connexion.' },
            { title: 'Cliquez sur « Gérer »', detail: 'La fiche s’ouvre avec les informations générales et les utilisateurs partenaires.' },
            { title: 'Mettez à jour les informations générales', detail: 'Corrigez les coordonnées ou l’offre, puis enregistrez.' },
            { title: 'Ajoutez un utilisateur', detail: 'Dans « Utilisateurs partenaires », choisissez **Ajouter un utilisateur** pour créer ou lier un compte.' },
            { title: 'Modifiez ou retirez un accès', detail: 'Changez le rôle (**Admin** ou **Gestion bénéficiaires**) ou supprimez l’accès d’un collaborateur parti.' }
          ]
        },
        {
          type: 'tip',
          text: 'Utilisez la colonne **Dernière connexion** pour repérer les partenaires inactifs et planifier une relance.'
        }
      ]
    },
    {
      title: 'Suivre les réservations',
      summary: 'Garder un œil sur les commandes de vos comptes, en lecture seule.',
      path: '/admin/reservations',
      access: 'Commercial (lecture seule)',
      blocks: [
        {
          type: 'steps',
          steps: [
            { title: 'Ouvrez « Réservations »', detail: 'Ou cliquez sur une carte du Dashboard pour arriver sur une liste déjà filtrée.' },
            { title: 'Lisez la ligne de commande', detail: 'Séjour, session, client et nombre de participants, **collectivité**, statut.' },
            { title: 'Repérez les commandes de vos partenaires', detail: 'La colonne Collectivité permet de retrouver les commandes liées à votre partenaire.' },
            { title: 'Réinitialisez les filtres', detail: 'Utilisez le lien **Réinitialiser** du bandeau « Filtre actif ».' }
          ]
        },
        {
          type: 'important',
          title: 'Lecture seule',
          text: 'Le statut affiche « Lecture seule » : vous ne pouvez pas modifier une réservation. Transmettez la demande à un administrateur avec la référence de la commande.'
        }
      ]
    },
    {
      title: 'Bonnes pratiques commerciales',
      summary: 'Un rituel simple pour développer et fidéliser votre portefeuille.',
      blocks: [
        {
          type: 'bullets',
          items: [
            '**Activez vite** : un partenaire créé sans utilisateur actif ne génère aucune réservation.',
            '**Choisissez le bon code** : court, mémorisable, lié au nom de la structure.',
            '**Relancez les comptes inactifs** à partir de la dernière connexion.',
            '**Qualifiez l’offre** : Identité pour la visibilité de marque, Sérénité pour un accompagnement complet.',
            '**Partagez les accès en sécurité** : ne transmettez jamais un mot de passe par un canal public.',
            '**Escaladez** toute modification de réservation vers un administrateur, avec la référence.'
          ]
        },
        { type: 'h3', text: 'Rituel hebdomadaire conseillé' },
        {
          type: 'steps',
          steps: [
            { title: 'Dashboard', detail: 'Notez les partenaires sans utilisateur et les réservations à traiter.' },
            { title: 'Partenaires', detail: 'Relancez les comptes sans connexion récente.' },
            { title: 'Réservations', detail: 'Repérez les commandes en attente liées à vos partenaires.' }
          ]
        }
      ]
    },
    supportChapter({ intro: 'Vos relais pour débloquer une situation, côté technique comme côté commercial.' })
  ]
};

export const PROFILE_GUIDES: ProfileGuide[] = [adminGuide, organizerGuide, partnerGuide, salesGuide];
