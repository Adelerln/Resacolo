# Mails de réservation (famille + organisateur)

Brouillons HTML à brancher ensuite dans l’envoi SMTP post-checkout.

Placeholders communs : `{{ORDER_ID}}`, `{{FAMILY_NAME}}`, `{{FAMILY_EMAIL}}`, `{{FAMILY_PHONE}}`, `{{ORGANIZER_NAME}}`, `{{STAY_TITLE}}`, `{{SESSION_LABEL}}`, `{{CHILD_NAME}}`, `{{AMOUNT_LABEL}}`.

Placeholders ANCV : `{{ANCV_CONNECT_MATRICULE}}`, `{{ANCV_CONNECT_AMOUNT}}`, `{{ANCV_PAPER_MAILING_ADDRESS}}`.

| Cas | Famille | Organisateur |
|---|---|---|
| CB totalité (le plus fréquent) | `family-cb-full.html` | `organizer-cb-full.html` |
| Acompte 200 € | `family-cb-deposit.html` | `organizer-cb-deposit.html` |
| ANCV Connect | `family-ancv-connect.html` | `organizer-ancv-connect.html` |
| ANCV papier | `family-ancv-paper.html` | `organizer-ancv-paper.html` |
| Paiement différé (prise en charge partenaire à calculer dans le back-office) | `family-deferred.html` | `organizer-deferred.html` |
| VACAF (rare) | `family-vacaf.html` | `organizer-vacaf.html` |
| Prise en charge partenaire (totalité) | `family-partner-full.html` | `organizer-partner-full.html` |

Notes :
- Ouvrir les fichiers dans un navigateur pour prévisualiser.
- Les envois live passent par `src/lib/reservation-notifications.server.ts` (police Raleway).
