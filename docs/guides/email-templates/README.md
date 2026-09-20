# Templates e-mail Auth Resacolo (Supabase)

Copier-coller le HTML de chaque fichier dans **Authentication → Email Templates**.

## Réservations (famille + organisateur)

Brouillons par mode de règlement / statut : voir le dossier [`reservation/`](./reservation/) (CB totalité, acompte, ANCV Connect, ANCV papier, différé, VACAF, prise en charge partenaire).

## Rapport stocks organisateurs (app)

- Brouillon visuel : `weekly-stock-report-draft.html`
- Envoi réel : cron `GET /api/cron/weekly-stock-report` (lundi 9h Paris, à partir du **2026-09-28**)
- Env : `SMTP_*` + `CRON_WEEKLY_STOCK_TOKEN` (ou `CRON_SECRET`)
- Test : `?token=...&dryRun=1` (calcule sans envoyer) ; `?token=...&force=1` pour forcer hors créneau

## Relance panier famille (app)

- Brouillon visuel : `cart-abandonment-reminder-draft.html`
- Objet : `[Resacolo] Votre séjour vous attend encore dans le panier — …`
- Envoi réel : cron horaire `GET /api/cron/cart-abandonment-reminder` (minute 20)
- Règle : panier `checkout_carts` encore `ACTIVE`, au moins 1 séjour, e-mail contact présent, référence (`addedAt` article ou `created_at`) entre **24 h** et **14 j**, et `abandonment_reminder_sent_at` vide
- Env : `SMTP_*` + `CRON_CART_ABANDONMENT_TOKEN` (ou `CRON_SECRET`)
- Migration : `20260919_checkout_cart_abandonment_reminder.sql`
- Test : `?token=...&dryRun=1` ; `?token=...&to=toi@exemple.fr` pour forcer le destinataire

## Relances paiement famille (app)

- Brouillons : `deposit-payment-reminder-draft.html` (acompte J+7), `balance-payment-reminder-draft.html` (solde J-30)
- Crons quotidiens :
  - `GET /api/cron/deposit-payment-reminder` (07:15 UTC)
  - `GET /api/cron/balance-payment-reminder` (07:30 UTC)
- Flags : `orders.deposit_reminder_sent_at`, `orders.balance_reminder_sent_at`
- Email manquant → alerte interne + liste Mnemos `/mnemos/payment-reminder-alerts`
- Checkout : acompte CB interdit si départ &lt; 30 j (sauf VACAF / ANCV)
- Migration : `20260920_payment_reminders_and_cancellations.sql`
- Env : `SMTP_*` + `CRON_PAYMENT_REMINDER_TOKEN` (ou `CRON_SECRET`)
- Test : `?token=...&dryRun=1`

| Template Supabase | Subject | Fichier |
|---|---|---|
| Confirm signup | Confirmez votre compte Resacolo | `confirm-signup.html` |
| Invite user | Vous êtes invité(e) sur Resacolo | `invite-user.html` |
| Magic link / OTP | Votre lien de connexion Resacolo | `magic-link.html` |
| Change email address | Confirmez votre nouvelle adresse e-mail Resacolo | `change-email.html` |
| Reset password | Réinitialisez votre mot de passe Resacolo | `reset-password.html` |
| Password changed | Votre mot de passe Resacolo a été modifié | `password-changed.html` |
| Email address changed | Votre adresse e-mail Resacolo a été modifiée | `email-changed.html` |

Pour les notifications Password / Email changed : activer **Enable notification**.

## Invitation famille (Mon compte)

Depuis `/mon-compte`, un parent peut inviter un proche via `auth.admin.inviteUserByEmail`.
Coller `invite-user.html` dans le template **Invite user** (garder `{{ .ConfirmationURL }}`).
Variables optionnelles : `{{ .Data.invited_by_name }}`.

## Redirect URLs à autoriser (Authentication → URL Configuration)

- `https://resacolo.com/auth/callback`
- `https://resacolo.com/auth/confirm`
- `http://localhost:3000/auth/callback`
- `http://localhost:3000/auth/confirm`

Site URL : `https://resacolo.com` (prod) ou `http://localhost:3000` (dev).

## Confirmation de compte

Le signup famille envoie `emailRedirectTo` vers `/auth/confirm?next=/confirmation-mail`.
Coller `confirm-signup.html` dans le template **Confirm signup** (garder `{{ .ConfirmationURL }}`).
