# Resacolo

Plateforme Next.js pour agréger et présenter les séjours de colonies de vacances proposés par les membres de Résocolo.

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
```

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

## Limitations actuelles

- Les pages marketing contiennent du contenu éditorial à adapter.
- Une base de données n’est pas encore branchée : la synchronisation repose sur des appels live à OpenAI.
- Le style reprend Tailwind CSS avec une identité légère ; adaptez la charte graphique selon les besoins.
