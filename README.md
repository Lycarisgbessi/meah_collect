# MEAH COLLECT

Plateforme de **formulaires collaboratifs à liens dérivés** : créez un formulaire une seule
fois, invitez votre équipe, et chaque collecteur reçoit **son propre lien de collecte** —
chaque réponse est tracée sous le nom du bon membre.

- **Stack** : Next.js 16 (App Router) · React 19 · TypeScript strict · Tailwind 4 · shadcn/ui · Prisma 6 / **PostgreSQL (Neon)** · Zustand
- **Architecture** : route unique `/` avec routeur de vues interne (`?view=…`) — voir `src/lib/router.ts`
- **Design** : « luxe sobre » (ivoire / noir profond / or #B08D57, Playfair Display + Inter)

## Démarrage

```bash
bun install            # installe les dépendances
cp .env.example .env   # renseignez DATABASE_URL (PostgreSQL), AUTH_SECRET, IP_SALT
bun run db:generate    # génère le client Prisma
bun run db:push        # applique le schéma à la base PostgreSQL
bun run dev            # http://localhost:3000
```

Base de démonstration : `bun prisma/seed.ts` (4 comptes, 2 formulaires, 27 réponses).

| Rôle | Compte | Mot de passe |
|---|---|---|
| Admin | `admin@meahcollect.fr` | `Admin2026!` |
| Initiateur | `jean@demo.fr` | `Demo2026!` |
| Membre | `marie@demo.fr` / `sophie@demo.fr` | `Demo2026!` |

## Configuration (`.env`)

| Variable | Rôle |
|---|---|
| `DATABASE_URL` | PostgreSQL (ex. Neon : `postgresql://…?sslmode=require`) |
| `AUTH_SECRET` | Signature des sessions HMAC (≥ 16 caractères, **obligatoire en production**) |
| `IP_SALT` | Sel du hachage RGPD des adresses IP |

Les e-mails (vérification, reset, alertes) sont **tracés dans la console serveur** (`src/lib/mailer.ts`)
faute de SMTP configuré — branchez un transporteur réel avant tout usage en production.
En mode démonstration, le code de vérification et le jeton de reset sont donc à lire dans les logs serveur.

## Production

```bash
bun run build
bun run start
```

La base de démonstration est **PostgreSQL (Neon)** — compatible tout hébergeur Node (Vercel, VPS…).
Points d'attention avant une mise en production réelle :
- rate limiting en mémoire (mono-processus — prévoir un store partagé en multi-instance) ;
- `AUTH_SECRET` fort (le démarrage échoue s'il est absent) ;
- brancher un SMTP dans `src/lib/mailer.ts` ;
- purger les comptes et réponses de démonstration.

## Qualité

```bash
bun run lint         # ESLint — 0 erreur attendue
bunx tsc --noEmit    # TypeScript — 0 erreur attendue
```
