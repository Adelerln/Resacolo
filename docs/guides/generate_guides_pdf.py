#!/usr/bin/env python3
"""Génère les guides PDF Resacolo (organisateurs + CSE/partenaires)."""

from __future__ import annotations

from datetime import date
from pathlib import Path

from fpdf import FPDF

ROOT = Path(__file__).resolve().parent
FONT_REG = "/System/Library/Fonts/Supplemental/Arial.ttf"
FONT_BOLD = "/System/Library/Fonts/Supplemental/Arial Bold.ttf"
TODAY = date.today().strftime("%d/%m/%Y")


class GuidePDF(FPDF):
    def __init__(self, audience: str, subtitle: str):
        super().__init__(format="A4", unit="mm")
        self.audience = audience
        self.subtitle = subtitle
        self.set_auto_page_break(auto=True, margin=18)
        self.add_font("ArialFR", "", FONT_REG)
        self.add_font("ArialFR", "B", FONT_BOLD)
        self.set_margins(16, 16, 16)

    def header(self):
        if self.page_no() == 1:
            return
        self.set_font("ArialFR", "", 8)
        self.set_text_color(100, 116, 139)
        self.cell(0, 6, f"Resacolo — {self.audience}", align="L")
        self.set_x(16)
        self.cell(0, 6, "Guide fonctionnel", align="R")
        self.ln(2)
        self.set_draw_color(226, 232, 240)
        self.line(16, self.get_y(), 194, self.get_y())
        self.ln(6)

    def footer(self):
        self.set_y(-14)
        self.set_font("ArialFR", "", 8)
        self.set_text_color(148, 163, 184)
        self.cell(0, 8, f"Document généré le {TODAY}  ·  page {self.page_no()}/{{nb}}", align="C")

    def cover(self, bullets: list[str]):
        self.add_page()
        self.set_fill_color(15, 23, 42)
        self.rect(0, 0, 210, 78, "F")
        self.set_y(28)
        self.set_font("ArialFR", "B", 28)
        self.set_text_color(255, 255, 255)
        self.cell(0, 12, "Resacolo", align="C", new_x="LMARGIN", new_y="NEXT")
        self.set_font("ArialFR", "B", 16)
        self.cell(0, 10, self.audience, align="C", new_x="LMARGIN", new_y="NEXT")
        self.set_font("ArialFR", "", 11)
        self.set_text_color(203, 213, 225)
        self.cell(0, 8, self.subtitle, align="C", new_x="LMARGIN", new_y="NEXT")

        self.set_y(95)
        self.set_text_color(30, 41, 59)
        self.set_font("ArialFR", "B", 13)
        self.cell(0, 8, "Ce guide explique, page par page :", new_x="LMARGIN", new_y="NEXT")
        self.set_font("ArialFR", "", 11)
        self.ln(2)
        for b in bullets:
            self.multi_cell(0, 6, f"•  {b}")
            self.ln(1)

        self.ln(8)
        self.set_font("ArialFR", "", 10)
        self.set_text_color(100, 116, 139)
        self.multi_cell(
            0,
            5,
            "Public concerné : équipes utilisant l’espace back-office Resacolo. "
            "Les libellés correspondent à l’interface actuelle. "
            f"Date du document : {TODAY}.",
        )

    def h1(self, text: str):
        self.ln(4)
        self.set_font("ArialFR", "B", 16)
        self.set_text_color(15, 23, 42)
        self.multi_cell(0, 8, text)
        self.ln(1)
        self.set_draw_color(37, 99, 235)
        y = self.get_y()
        self.line(16, y, 70, y)
        self.ln(4)

    def h2(self, text: str):
        if self.get_y() > 250:
            self.add_page()
        self.ln(2)
        self.set_font("ArialFR", "B", 12)
        self.set_text_color(30, 64, 175)
        self.multi_cell(0, 7, text)
        self.ln(1)

    def h3(self, text: str):
        self.set_font("ArialFR", "B", 10.5)
        self.set_text_color(51, 65, 85)
        self.multi_cell(0, 6, text)
        self.ln(0.5)

    def p(self, text: str):
        self.set_font("ArialFR", "", 10)
        self.set_text_color(51, 65, 85)
        self.multi_cell(0, 5.2, text)
        self.ln(1.5)

    def meta(self, path: str, access: str):
        self.set_fill_color(241, 245, 249)
        self.set_draw_color(226, 232, 240)
        x = self.l_margin
        y = self.get_y()
        self.set_font("ArialFR", "", 9)
        self.set_text_color(71, 85, 105)
        content = f"URL : {path}\nAccès : {access}"
        # estimate height
        self.set_xy(x + 2, y + 2)
        self.multi_cell(176, 4.5, content)
        h = self.get_y() - y + 2
        self.set_xy(x, y)
        self.rect(x, y, 178, h, "D")
        self.set_xy(x + 2, y + 2)
        self.multi_cell(174, 4.5, content)
        self.set_y(y + h + 2)

    def bullets(self, items: list[str]):
        self.set_font("ArialFR", "", 10)
        self.set_text_color(51, 65, 85)
        for item in items:
            self.multi_cell(0, 5.2, f"•  {item}")
            self.ln(0.4)
        self.ln(1.5)

    def callout(self, title: str, text: str):
        if self.get_y() > 245:
            self.add_page()
        self.set_fill_color(255, 251, 235)
        self.set_draw_color(251, 191, 36)
        start = self.get_y()
        self.set_xy(self.l_margin + 2, start + 2)
        self.set_font("ArialFR", "B", 9.5)
        self.set_text_color(146, 64, 14)
        self.multi_cell(174, 5, title)
        self.set_font("ArialFR", "", 9.5)
        self.set_text_color(120, 53, 15)
        self.multi_cell(174, 5, text)
        end = self.get_y() + 2
        self.rect(self.l_margin, start, 178, end - start, "D")
        self.set_y(end + 3)

    def table(self, headers: list[str], rows: list[list[str]], col_widths: list[float] | None = None):
        if col_widths is None:
            w = 178 / len(headers)
            col_widths = [w] * len(headers)
        self.set_font("ArialFR", "B", 9)
        self.set_fill_color(30, 41, 59)
        self.set_text_color(255, 255, 255)
        for i, h in enumerate(headers):
            self.cell(col_widths[i], 7, h, border=1, fill=True)
        self.ln()
        self.set_font("ArialFR", "", 8.5)
        self.set_text_color(51, 65, 85)
        fill = False
        for row in rows:
            if self.get_y() > 270:
                self.add_page()
                self.set_font("ArialFR", "B", 9)
                self.set_fill_color(30, 41, 59)
                self.set_text_color(255, 255, 255)
                for i, h in enumerate(headers):
                    self.cell(col_widths[i], 7, h, border=1, fill=True)
                self.ln()
                self.set_font("ArialFR", "", 8.5)
                self.set_text_color(51, 65, 85)
            self.set_fill_color(248, 250, 252)
            # wrap-aware simple row height
            line_h = 5
            max_lines = 1
            for i, cell in enumerate(row):
                lines = self.multi_cell(col_widths[i], line_h, cell, dry_run=True, output="LINES")
                max_lines = max(max_lines, len(lines))
            row_h = max_lines * line_h + 2
            x0, y0 = self.get_x(), self.get_y()
            for i, cell in enumerate(row):
                self.set_xy(x0 + sum(col_widths[:i]), y0)
                self.multi_cell(col_widths[i], line_h, cell, border=0, fill=fill)
            for i in range(len(headers)):
                self.rect(x0 + sum(col_widths[:i]), y0, col_widths[i], row_h)
            self.set_xy(x0, y0 + row_h)
            fill = not fill
        self.ln(3)


def build_organizer_pdf() -> Path:
    pdf = GuidePDF(
        audience="Guide Organisateurs",
        subtitle="Espace Organisateur — fonctionnalités page par page",
    )
    pdf.alias_nb_pages()
    pdf.cover(
        [
            "À quoi sert chaque page de l’espace Organisateur",
            "Les actions principales et les règles métier à connaître",
            "Qui peut accéder à quoi selon le rôle (Propriétaire, Éditeur, Gestionnaire)",
            "Le parcours de création et publication d’un séjour",
        ]
    )

    pdf.add_page()
    pdf.h1("1. Accès et rôles")
    pdf.p(
        "L’espace Organisateur est accessible via la navigation « Espace Organisateur ». "
        "Plusieurs personnes peuvent être rattachées au même organisme, avec des droits différents."
    )
    pdf.table(
        ["Rôle", "Libellé", "Pages accessibles"],
        [
            ["OWNER", "Propriétaire", "Toutes : dashboard, fiche, séjours, hébergements, résas, demandes, utilisateurs"],
            ["EDITOR", "Éditeur", "Dashboard, séjours, hébergements, réservations, demandes"],
            ["RESERVATION_MANAGER", "Gestionnaire", "Dashboard, réservations, demandes"],
        ],
        [32, 32, 114],
    )
    pdf.callout(
        "À retenir",
        "Seuls les Propriétaires gèrent la fiche organisateur (dont les CGV) et les comptes utilisateurs.",
    )

    pdf.h1("2. Dashboard — /organisme")
    pdf.meta("/organisme", "Propriétaire, Éditeur, Gestionnaire")
    pdf.p(
        "Vue d’ensemble de l’activité de l’organisateur sélectionné : remplissage, priorités et suivi des séjours."
    )
    pdf.h3("Ce que vous voyez")
    pdf.bullets(
        [
            "Indicateurs : séjours proposés, réservations, taux de remplissage, sessions complètes / ouvertes",
            "Badges d’équipe et de fréquentation des fiches séjour",
            "Actions prioritaires : top séjours réservés, plus consultés, séjours complets",
            "Tableau « Suivi des séjours » (statut, sessions, réservations, visibilité)",
            "Raccourcis vers la gestion des séjours et des réservations",
        ]
    )

    pdf.h1("3. Fiche organisateur — /organisme/organisateur")
    pdf.meta("/organisme/organisateur", "Propriétaire uniquement")
    pdf.p(
        "Identité publique de votre organisme, aides acceptées, documents et catalogue d’offre "
        "(saisons, activités, types de séjours)."
    )
    pdf.h3("Sections du formulaire")
    pdf.bullets(
        [
            "Identité : nom, email de contact, année de création, âges min/max",
            "Modes de règlement : chèques-vacances papier, ANCV Connect, agrément VACAF / CAF AVE",
            "Textes : accroche sous le titre et présentation riche",
            "Documents : logo (PNG/JPG), projet éducatif (PDF), CGV organisateur (PDF)",
            "Catalogue d’offre : saisons, activités, types de séjours, durées min/max",
        ]
    )
    pdf.callout(
        "Règle importante — CGV obligatoires",
        "Un PDF de Conditions Générales de Vente doit être déposé pour enregistrer la fiche. "
        "Les familles le téléchargent au récapitulatif du checkout. Sans CGV, la sauvegarde est refusée.",
    )

    pdf.h1("4. Séjours — liste — /organisme/sejours")
    pdf.meta("/organisme/sejours", "Propriétaire, Éditeur")
    pdf.p(
        "Inventaire des brouillons d’import et des séjours publiés, avec stock de places par session "
        "et statut catalogue."
    )
    pdf.h3("Actions principales")
    pdf.bullets(
        [
            "Créer un séjour (ouvre le choix import URL / saisie manuelle)",
            "Modifier ou supprimer un brouillon d’import",
            "Filtrer par statut, disponibilité, lieu",
            "Basculer un séjour Publié ↔ Masqué sans republier",
            "Éditer les places restantes d’une session depuis la liste",
            "Éditer ou supprimer un séjour",
        ]
    )

    pdf.h1("5. Créer un séjour")
    pdf.h2("5.1 Choix du point de départ — /organisme/sejours/new")
    pdf.meta("/organisme/sejours/new", "Propriétaire, Éditeur")
    pdf.bullets(
        [
            "Import via URL : préremplissage à partir de votre site, puis enrichissement",
            "Brouillon manuel : création immédiate d’un brouillon vide à compléter",
        ]
    )

    pdf.h2("5.2 Import via URL — /organisme/sejours/new/url")
    pdf.meta("/organisme/sejours/new/url", "Propriétaire, Éditeur")
    pdf.p(
        "Saisissez l’URL de votre fiche séjour, rattachez éventuellement un hébergement existant, "
        "lancez l’enrichissement, puis passez en relecture du brouillon."
    )

    pdf.h2("5.3 Brouillon manuel — /organisme/sejours/new/manual")
    pdf.meta("/organisme/sejours/new/manual", "Propriétaire, Éditeur")
    pdf.p("Crée un brouillon vide et ouvre directement la relecture.")

    pdf.h2("5.4 Relecture du brouillon — /organisme/sejours/drafts/[id]")
    pdf.meta("/organisme/sejours/drafts/[id]", "Propriétaire, Éditeur")
    pdf.p("Tunnel unique de validation avant mise en ligne, en 8 étapes :")
    pdf.bullets(
        [
            "Hébergement (obligatoire pour avancer)",
            "Séjour",
            "Photos + Liens",
            "Sessions",
            "Options",
            "Transports",
            "Partenaires",
            "SEO — puis « Valider le visuel »",
        ]
    )
    pdf.p("Actions : Enregistrer le brouillon, Précédent / Suivant, Valider le visuel.")

    pdf.h2("5.5 Aperçu et publication — /organisme/sejours/published-preview")
    pdf.meta("/organisme/sejours/published-preview", "Propriétaire, Éditeur")
    pdf.p(
        "Contrôlez le rendu public (carte + fiche détail), puis publiez via « Publier maintenant »."
    )
    pdf.callout(
        "Parcours recommandé",
        "Choix → (URL ou Manuel) → Brouillon → Relecture 8 étapes → Valider le visuel → Aperçu → Publier. "
        "Ensuite, masquez ou rééditez depuis la liste des séjours.",
    )

    pdf.h2("5.6 Consulter / éditer un séjour publié")
    pdf.meta("/organisme/sejours/[id] et /organisme/sejours/[id]/edit", "Propriétaire, Éditeur")
    pdf.bullets(
        [
            "Fiche de consultation depuis le dashboard",
            "Édition via le même tunnel que le brouillon (variante publiée), sans repasser par l’import URL",
        ]
    )

    pdf.h1("6. Hébergements — /organisme/hebergements")
    pdf.meta("/organisme/hebergements (+ /new et /[id])", "Propriétaire, Éditeur")
    pdf.p(
        "Catalogue d’hébergements réutilisables, liés aux séjours. Créez, archivez ou rouvrez une fiche lieu."
    )
    pdf.h3("Contenu d’une fiche")
    pdf.bullets(
        [
            "Type, adresse ou zone itinérante, description",
            "Lits, sanitaires, restauration, accessibilité",
            "Médias et carte (coordonnées / iframe Google Maps)",
        ]
    )
    pdf.p("Les hébergements archivés n’apparaissent plus dans les sélecteurs de création de séjour.")

    pdf.h1("7. Réservations — /organisme/reservations")
    pdf.meta("/organisme/reservations", "Propriétaire, Éditeur, Gestionnaire")
    pdf.p(
        "Suivez les commandes liées à votre organisme et traitez les aides externes (VACAF, ANCV Connect)."
    )
    pdf.h3("Tableau")
    pdf.bullets(
        [
            "Client, séjour, session, enfant, statut, traitement organisme, collectivité, montant",
            "Modal de détails par réservation",
        ]
    )
    pdf.h3("Actions de traitement")
    pdf.bullets(
        [
            "Si demande VACAF : saisir le montant CAF puis « Enregistrer le montant CAF »",
            "Si ANCV Connect : saisir le montant reçu puis « Enregistrer le montant ANCV »",
            "Le reste dû famille est recalculé (y compris après déduction d’une part CSE approuvée)",
        ]
    )
    pdf.p(
        "Les modes de paiement affichés peuvent inclure paiement total, acompte, ANCV (Connect / papier) et différé."
    )

    pdf.h1("8. Demandes — /organisme/demandes")
    pdf.meta("/organisme/demandes et /organisme/demandes/[id]", "Propriétaire, Éditeur, Gestionnaire")
    pdf.p(
        "Demandes de renseignements transférées depuis Mnemos. Liste (date, statut, type, contact, sujet) "
        "et détail avec action « Marquer comme résolu »."
    )

    pdf.h1("9. Utilisateurs — /organisme/utilisateurs")
    pdf.meta("/organisme/utilisateurs", "Propriétaire (écriture) ; lecture limitée pour les autres")
    pdf.p("Gérez les membres de votre espace organisateur et leurs rôles.")
    pdf.bullets(
        [
            "Ajout : prénom, nom, email, rôle, mot de passe temporaire",
            "Édition inline, réinitialisation du mot de passe, suppression",
            "Politique de mot de passe appliquée côté plateforme",
        ]
    )

    pdf.add_page()
    pdf.h1("10. Synthèse des pages")
    pdf.table(
        ["Page", "URL", "Rôles"],
        [
            ["Dashboard", "/organisme", "Tous"],
            ["Fiche organisateur", "/organisme/organisateur", "Propriétaire"],
            ["Séjours", "/organisme/sejours", "Propriétaire, Éditeur"],
            ["Création séjour", "/organisme/sejours/new…", "Propriétaire, Éditeur"],
            ["Hébergements", "/organisme/hebergements", "Propriétaire, Éditeur"],
            ["Réservations", "/organisme/reservations", "Tous"],
            ["Demandes", "/organisme/demandes", "Tous"],
            ["Utilisateurs", "/organisme/utilisateurs", "Propriétaire"],
        ],
        [48, 70, 60],
    )

    out = ROOT / "Resacolo-Guide-Organisateurs.pdf"
    pdf.output(str(out))
    return out


def build_partner_pdf() -> Path:
    pdf = GuidePDF(
        audience="Guide CSE / Partenaires",
        subtitle="Espace Partenaire — fonctionnalités page par page",
    )
    pdf.alias_nb_pages()
    pdf.cover(
        [
            "À quoi sert chaque page de l’espace Partenaire (CSE / collectivité)",
            "Comment paramétrer le financement et le catalogue éligible",
            "Quand et comment saisir les quotients familiaux (QF)",
            "Qui peut accéder à quoi (Admin vs Gestion bénéficiaires)",
        ]
    )

    pdf.add_page()
    pdf.h1("1. Accès et rôles")
    pdf.p(
        "L’espace Partenaire permet à un CSE (ou collectivité) de gérer ses ayants-droit, "
        "son catalogue éligible, son mode de prise en charge et le suivi des réservations."
    )
    pdf.table(
        ["Rôle", "Libellé", "Pages accessibles"],
        [
            ["PARTNER_ADMIN", "Admin", "Toutes les pages partenaire"],
            [
                "PARTNER_BENEFICIARY_MANAGER",
                "Gestion bénéficiaires et réservations",
                "Dashboard, Bénéficiaires, Réservations",
            ],
        ],
        [48, 42, 88],
    )
    pdf.p(
        "La navigation « Marque blanche » n’apparaît que si votre offre est « Identité »."
    )

    pdf.h1("2. Modes de financement (référence)")
    pdf.p("Le mode choisi sur la page Financement détermine le calcul de la part CSE au checkout.")
    pdf.table(
        ["Mode", "Effet"],
        [
            ["Prise en charge totale (TOTAL)", "Le CSE prend 100 % du séjour éligible"],
            ["Pas de financement (NONE)", "La famille paie 100 %"],
            ["Quote-part en % (PERCENT)", "Pourcentage global appliqué"],
            ["Quote-part fixe (FIXED)", "Forfait € global"],
            [
                "Calcul manuel (MANUAL)",
                "Barème QF du catalogue + QF des bénéficiaires (+ ajustement possible en réservation)",
            ],
        ],
        [58, 120],
    )
    pdf.callout(
        "Lien QF ↔ Calcul manuel",
        "La saisie des quotients familiaux et le barème QF du catalogue ne s’appliquent "
        "que si le mode Financement est « Calcul manuel ».",
    )

    pdf.h1("3. Dashboard — /partenaire")
    pdf.meta("/partenaire", "Admin, Gestion bénéficiaires")
    pdf.p("Pilotage sur 30 jours et accompagnement d’onboarding des ayants-droit.")
    pdf.h3("Contenu")
    pdf.bullets(
        [
            "Alerte des nouveaux pays catalogue à trancher (si accès Catalogue)",
            "Bandeau d’onboarding si aucun bénéficiaire (code de rattachement + liens)",
            "KPIs : ayants-droit actifs, réservations 30j, taux finalisées, montant total, part partenaire",
            "Graphiques d’évolution et répartition des statuts",
            "Dernières réservations et top séjours",
        ]
    )

    pdf.h1("4. Fiche partenaire — /partenaire/fiche")
    pdf.meta("/partenaire/fiche", "Admin")
    pdf.p("Identité de la collectivité, adresse, interlocuteurs et membres d’accès.")
    pdf.bullets(
        [
            "Nom et mode d’offre (Identité / Sérénité) en lecture",
            "Adresse postale",
            "Interlocuteurs et accès : contacts + membres Admin / Gestion bénéficiaires",
        ]
    )

    pdf.h1("5. Bénéficiaires — /partenaire/beneficiaires")
    pdf.meta("/partenaire/beneficiaires", "Admin, Gestion bénéficiaires")
    pdf.p(
        "Liste des ayants-droit rattachés via le code CSE. En mode Calcul manuel, saisie du QF et de sa date d’expiration."
    )
    pdf.h3("Éléments affichés")
    pdf.bullets(
        [
            "Nombre d’ayants-droit et code de rattachement à transmettre aux familles",
            "Identité, email, téléphone, ville, date de rattachement",
            "Champs QF + expiration (uniquement si mode MANUAL)",
        ]
    )
    pdf.callout(
        "Règle QF",
        "Hors Calcul manuel, les champs QF sont masqués / refusés à l’enregistrement. "
        "Une mise à jour de QF peut recalculer les contributions des commandes concernées.",
    )

    pdf.h1("6. Catalogue — /partenaire/catalogue")
    pdf.meta("/partenaire/catalogue", "Admin")
    pdf.p(
        "Paramétrez les règles d’éligibilité des séjours Resacolo pour vos bénéficiaires, "
        "et (en Calcul manuel) les règles financières / barème QF. Prévisualisez les sessions éligibles."
    )
    pdf.h3("Critères d’éligibilité")
    pdf.bullets(
        [
            "Âge, prix, durée, saisons, types de séjours, organisateurs",
            "Pays : autoriser ou refuser",
        ]
    )
    pdf.h3("Règles financières (Calcul manuel uniquement)")
    pdf.bullets(
        [
            "Plafonds, filtre QF min/max",
            "Barème QF par tranches (% ou forfait)",
            "Hors MANUAL : message renvoyant vers Financement ; les taux viennent de cette page",
        ]
    )
    pdf.callout(
        "Enregistrer = publier",
        "Quand les règles sont valides, l’enregistrement écrit le brouillon et publie les règles runtime "
        "(catalog_rules_published). C’est ce jeu de règles que le checkout utilise pour l’éligibilité et l’aide.",
    )

    pdf.h1("7. Financement — /partenaire/financement")
    pdf.meta("/partenaire/financement", "Admin")
    pdf.p("Choisissez le mode global de prise en charge et renseignez le % ou le forfait si besoin.")
    pdf.bullets(
        [
            "Select du mode + aide contextuelle",
            "Pourcentage ou montant fixe selon le mode",
            "Texte libre de règles éventuel",
            "En MANUAL : compléter ensuite Catalogue (barème) et Bénéficiaires (QF)",
        ]
    )

    pdf.h1("8. Commandes Organisateurs — /partenaire/montants-organisateurs")
    pdf.meta("/partenaire/montants-organisateurs", "Admin")
    pdf.p(
        "Synthèse des montants de prise en charge CSE agrégés par organisateur "
        "(filtre saison, KPIs, détail par organisme)."
    )

    pdf.h1("9. Marque blanche — /partenaire/marque-blanche")
    pdf.meta("/partenaire/marque-blanche", "Admin + offre Identité")
    pdf.p("Personnalisation visuelle de l’expérience familles rattachées à votre CSE.")
    pdf.bullets(
        [
            "Logo (max. 5 Mo), URL de redirection, texte d’accueil",
            "Hero : titre, corps, CTA (libellé + URL), activation",
            "Le CTA n’apparaît que si le texte et le lien sont renseignés",
        ]
    )
    pdf.callout(
        "Offre Identité requise",
        "Cette page est masquée / inaccessible pour l’offre Sérénité. L’accès Admin seul ne suffit pas.",
    )

    pdf.h1("10. Réservations — /partenaire/reservations")
    pdf.meta("/partenaire/reservations", "Admin, Gestion bénéficiaires")
    pdf.p(
        "Suivi des commandes ayant utilisé le code CSE (historique inclus). "
        "En Calcul manuel, vous pouvez saisir ou ajuster la part partenaire."
    )
    pdf.h3("Tableau")
    pdf.bullets(
        [
            "Commande (détails), bénéficiaire, séjour, participants, statut",
            "Total, part partenaire, reste client",
            "Éditeur de montant manuel + message partenaire (mode MANUAL)",
        ]
    )
    pdf.p(
        "L’enregistrement manuel crée / met à jour la contribution collectivité (approuvée) "
        "et peut être visible côté espace famille après recalcul."
    )

    pdf.add_page()
    pdf.h1("11. Parcours recommandé (Calcul manuel)")
    pdf.bullets(
        [
            "1. Financement → choisir Calcul manuel",
            "2. Catalogue → critères d’éligibilité + barème QF → Enregistrer (publication)",
            "3. Bénéficiaires → saisir QF + dates d’expiration",
            "4. (Optionnel) Réservations → ajuster une part partenaire au cas par cas",
            "5. Suivre l’activité sur le Dashboard et Commandes Organisateurs",
        ]
    )

    pdf.h1("12. Synthèse des pages")
    pdf.table(
        ["Page", "URL", "Rôles"],
        [
            ["Dashboard", "/partenaire", "Admin, Gestion béné."],
            ["Fiche partenaire", "/partenaire/fiche", "Admin"],
            ["Bénéficiaires", "/partenaire/beneficiaires", "Admin, Gestion béné."],
            ["Catalogue", "/partenaire/catalogue", "Admin"],
            ["Financement", "/partenaire/financement", "Admin"],
            ["Commandes Organisateurs", "/partenaire/montants-organisateurs", "Admin"],
            ["Marque blanche", "/partenaire/marque-blanche", "Admin + Identité"],
            ["Réservations", "/partenaire/reservations", "Admin, Gestion béné."],
        ],
        [52, 72, 54],
    )

    out = ROOT / "Resacolo-Guide-CSE-Partenaires.pdf"
    pdf.output(str(out))
    return out


def main():
    orga = build_organizer_pdf()
    cse = build_partner_pdf()
    print(orga)
    print(cse)


if __name__ == "__main__":
    main()
