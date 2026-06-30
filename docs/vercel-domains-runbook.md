# Domaines Vercel — runbook Resacolo

## Problème connu : `www.resacolo.vercel.app`

L’URL `https://www.resacolo.vercel.app` **ne peut pas fonctionner** : le certificat SSL Vercel couvre `*.vercel.app`, pas les sous-domaines en double (`www.resacolo…`).

**À communiquer en attendant le domaine custom :**

```
https://resacolo.vercel.app
```

(sans `www`)

---

## Mise en place de `resacolo.com`

### 1. Vercel → Project → Settings → Domains

Ajouter :

- `resacolo.com` (domaine principal)
- `www.resacolo.com` (redirigé automatiquement vers `resacolo.com` via `vercel.json`)

Ne pas ajouter `www.resacolo.vercel.app` (impossible à certifier).

### 2. DNS (chez le registrar)

Configurer les enregistrements indiqués par Vercel, en général :

| Type | Nom | Valeur |
|------|-----|--------|
| A | `@` | `76.76.21.21` |
| CNAME | `www` | `cname.vercel-dns.com` |

Attendre la propagation DNS et la validation du certificat (quelques minutes à 48 h).

### 3. Variables d’environnement Vercel (Production)

```
NEXT_PUBLIC_SITE_URL=https://resacolo.com
```

Optionnel, une fois `resacolo.com` validé et servi par Vercel :

```
ENABLE_CANONICAL_HOST_REDIRECTS=1
CANONICAL_HOST=resacolo.com
```

Cela redirige aussi `https://resacolo.vercel.app` → `https://resacolo.com`.

**Ne pas activer `ENABLE_CANONICAL_HOST_REDIRECTS` tant que `resacolo.com` pointe encore vers l’ancien site WordPress.**

### 4. Preview / staging

Ne pas activer `ENABLE_CANONICAL_HOST_REDIRECTS` sur Preview : les URLs `*.vercel.app` de branche doivent rester accessibles.

---

## Redirections déjà configurées dans le repo

| Mécanisme | Règle | Actif quand |
|-----------|-------|-------------|
| `vercel.json` | `www.resacolo.com` → `resacolo.com` | Domaine custom branché sur Vercel |
| Middleware | `www.resacolo.com` → `resacolo.com` | Même condition (filet de sécurité) |
| Middleware | `resacolo.vercel.app` → `resacolo.com` | `ENABLE_CANONICAL_HOST_REDIRECTS=1` |

---

## Vérifications après bascule

```bash
curl -sI https://resacolo.com | head -5
curl -sI https://www.resacolo.com | head -5
curl -sI https://resacolo.vercel.app | head -5
```

Attendu :

- `resacolo.com` → `200`
- `www.resacolo.com` → `308` vers `resacolo.com`
- `resacolo.vercel.app` → `200` (ou `308` si redirection canonique activée)

---

## Bascule depuis WordPress

1. Tester la prod Next sur `resacolo.vercel.app`.
2. Brancher `resacolo.com` sur Vercel, valider le certificat.
3. Mettre `NEXT_PUBLIC_SITE_URL=https://resacolo.com`.
4. Activer `ENABLE_CANONICAL_HOST_REDIRECTS=1`.
5. Vérifier login, checkout, images Supabase, sitemap (`/sitemap.xml`).
