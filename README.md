# Resacolo

Plateforme Next.js pour agréger et présenter les séjours de colonies de vacances proposés par les membres de Resacolo.

## Fonctionnalités clés

- Navigation marketing (accueil, association, organisateurs, ressources, contact et pages légales).
- Page « Séjours » avec filtres latéraux, affichage carte + fiche détaillée et URL dédiée par séjour.
- API `/api/sejours` qui récupère les sites des organisateurs, délègue l’extraction de contenu à l’API OpenAI et alimente la recherche.
- Mécanisme de cache mémoire avec option `?refresh=1` pour forcer une synchronisation.
- Jeu de données de secours (`src/data/sample-stays.json`) utilisé si la collecte échoue.

## Démarrage

```bash
npm install
npm run dev
```

## Variables d’environnement

Configurer la clé OpenAI dans `.env` :

```
OPENAI_API_KEY=sk-...
OPENAI_CHAT_MODEL=gpt-4o-mini
OPENAI_EMBED_MODEL=text-embedding-3-small
```

Pour le tunnel checkout/paiement :

```
# Provider carte : monetico (défaut) ou axepta
PAYMENT_PROVIDER=axepta
AXEPTA_MODE=mock   # mock | live — mock = pas de clés requises
# Live Axepta CB (API REST) + ANCV Connect (Limonetik limonetik.aspx) :
# AXEPTA_MERCHANT_ID=...
# AXEPTA_HMAC_SECRET=...   # hex ou chaîne fournie par BNP
# AXEPTA_BLOWFISH_KEY=...  # clé Blowfish Limonetik (distincte de l’API REST)
# AXEPTA_API_BASE_URL=https://paymentpage.axepta.bnpparibas
```

**ANCV Connect (CV_CONNECT)** : redirection TPE Limonetik (`PayType=cvconnect`), pas une simple demande.
En `AXEPTA_MODE=mock`, le checkout crée une commande `PENDING_PAYMENT` puis confirme le paiement en local
(page `/checkout/paiement`, comme le mock CB). En live, POST chiffré vers `limonetik.aspx` ;
retours : `/api/checkout/axepta/limonetik/{return,failure,notify}`.

Pour le chatbot RAG public :

```
NEXT_PUBLIC_CHATBOT_ENABLED=1
RAG_REINDEX_TOKEN=change-me
CHATBOT_ESCALATION_EMAIL=support@resacolo.com
SMTP_HOST=smtp.example.com
SMTP_PORT=465
SMTP_USER=user
SMTP_PASS=pass
SMTP_FROM=chatbot@resacolo.com
CRON_WEEKLY_STOCK_TOKEN=change-me
```

Rapport stocks organisateurs (lundi 9h Paris, dès le 2026-09-28) : cron `GET /api/cron/weekly-stock-report` — test `?token=...&dryRun=1`. Voir `docs/guides/email-templates/README.md`.

URL canonique du site (SEO, sitemap, métadonnées) :

```
NEXT_PUBLIC_SITE_URL=https://resacolo.com
```

Redirections de domaine Vercel (optionnel, à activer uniquement quand `resacolo.com` est servi par Vercel) :

```
ENABLE_CANONICAL_HOST_REDIRECTS=1
CANONICAL_HOST=resacolo.com
```

Voir `docs/vercel-domains-runbook.md` pour la bascule DNS / domaines.

## Synchronisation des séjours

- La page `/sejours` appelle `getStays()` côté serveur, qui
  - télécharge les pages des organisateurs,
  - demande à OpenAI (modèle `gpt-4.1`) de produire des fiches structurées,
  - normalise les filtres (âge, thématiques, périodes, transport) selon la taxonomie Resacolo.
- L’API est cacheée en mémoire pendant la durée du process. Ajoutez `?refresh=1` à `/api/sejours` pour relancer la collecte (utile pour créer un cron ou pipeline CI/CD).

## Personnalisation

- Ajoutez/retirez des organisateurs dans `src/lib/constants.ts`.
- Adaptez la taxonomie des filtres dans `FILTER_LABELS`.
- Le rendu des cartes et des fiches se trouve dans `src/components/sejours`.

## Chatbot RAG (V1)

- Endpoint question/réponse : `POST /api/chatbot/query`
- Handoff humain : `POST /api/chatbot/handoff`
- Instrumentation frontend : `POST /api/chatbot/event`
- Reindex manuel sécurisé : `POST /api/rag/reindex` (Bearer `RAG_REINDEX_TOKEN`)
- Cron full reindex : `GET /api/cron/rag-full-reindex?token=...`
- Fallback source publique : `/assistant/sources/[id]`
- Dashboard KPI interne : `/mnemos/chatbot`

## Limitations actuelles

- Les pages marketing contiennent du contenu éditorial à adapter.
- Une base de données n’est pas encore branchée : la synchronisation repose sur des appels live à OpenAI.
- Le style reprend Tailwind CSS avec une identité légère ; adaptez la charte graphique selon les besoins.
