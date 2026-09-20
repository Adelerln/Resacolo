# Templates e-mail Auth Resacolo (Supabase)

Copier-coller le HTML de chaque fichier dans **Authentication → Email Templates**.

## Rapport stocks organisateurs (app)

- Brouillon visuel : `weekly-stock-report-draft.html`
- Envoi réel : cron `GET /api/cron/weekly-stock-report` (lundi 9h Paris, à partir du **2026-09-28**)
- Env : `SMTP_*` + `CRON_WEEKLY_STOCK_TOKEN` (ou `CRON_SECRET`)
- Test : `?token=...&dryRun=1` (calcule sans envoyer) ; `?token=...&force=1` pour forcer hors créneau

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
