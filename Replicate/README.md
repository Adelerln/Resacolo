# Resacolo IA Image Studio

Application Next.js permettant de transformer des images grâce au modèle Replicate et de stocker les résultats dans Supabase.

## Installation

```bash
npm install
npm run dev
```

Toutes les dépendances sont définies dans `package.json`. Les scripts disponibles :

- `npm run dev` – lance le serveur de développement
- `npm run build` – génère la version de production
- `npm run start` – démarre le serveur Next.js en production
- `npm run lint` – exécute ESLint (configuration Next.js par défaut)

## Configuration

Les variables indispensables sont déjà renseignées dans `.env.local`. Pour les modifier :

```
NEXT_PUBLIC_SUPABASE_URL=
NEXT_PUBLIC_SUPABASE_ANON_KEY=
SUPABASE_SERVICE_ROLE_KEY=
SUPABASE_INPUT_BUCKET=input-images
SUPABASE_OUTPUT_BUCKET=output-images
REPLICATE_API_TOKEN=
REPLICATE_MODEL=google/nano-banana:1bwy6kt8r9rm80crx16t6161tm..
```

## Architecture

- `app/page.tsx` : interface principale avec upload, prompt et affichage du rendu.
- `app/api/generate/route.ts` : API serverless recevant l’image & le prompt, gérant les uploads dans Supabase, la génération Replicate et l’enregistrement en base.
- `lib/supabase-admin.ts` : client Supabase (service role) pour les opérations serveur.

Le bucket `input-images` accueille les fichiers d’origine, le bucket `output-images` enregistre les visuels générés. La table `projects` mémorise chaque transformation.

## Sécurité

L’API exploite la clé « service role ». Ne déployez jamais ce fichier sans mesures supplémentaires (variables d’environnement privées, RLS, etc.).
