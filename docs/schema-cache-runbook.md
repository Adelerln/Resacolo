# Runbook — Erreurs “column not found in schema cache”

Ce runbook couvre les erreurs du type:
- `Could not find the '<column>' column of '<table>' in the schema cache`

## 1) Appliquer les migrations

Appliquer les migrations Supabase dans l'ordre sur l'environnement concerné:
- local
- staging
- production

## 2) Vérifier les colonnes requises

Depuis le repo:

```bash
npm run check:schema-columns
```

Le script vérifie notamment:
- `collectivities.catalog_rules_draft`
- `collectivities.catalog_rules_published`
- `collectivities.catalog_rules_published_at`
- `collectivities.finance_mode`
- `collectivities.finance_percent_value`
- `collectivities.finance_fixed_cents`
- `collectivities.finance_rules_text`
- `accommodations.map_iframe_html`

La liste source est versionnée dans:
- `config/required-schema-columns.json` (mapping feature ↔ colonnes)

## 3) Rafraîchir le cache Supabase/PostgREST

Après migration:
- redémarrer les services API concernés (ou forcer un refresh de cache PostgREST selon l'infra).
- relancer `npm run check:schema-columns`.

## 4) Vérification applicative

Tester rapidement:
- `/partenaire/catalogue` (enregistrer + publier),
- `/partenaire/financement` (sauvegarde),
- fiche hébergement (lecture/édition iframe),
- checkout (pricing CSE).

## 5) Checklist release

Avant chaque déploiement applicatif:
1. migrations appliquées;
2. `npm run check:schema-columns` vert;
3. cache rafraîchi;
4. smoke test des pages partenaires.
