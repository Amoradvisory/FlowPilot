# FlowPilot

PWA personnelle de productivite en mode local-first: inbox, clarification, taches, focus, projets, agenda, habitudes, revue et analytics, avec sync Supabase et stockage offline Dexie.

L'app demarre meme sans `.env` en mode local-only. Avec Supabase configure, l'auth et la sync multi-device sont actives.

## Demarrage local

```bash
npm install
npm run dev
```

Puis ouvrir l'URL locale affichee par Vite.

## Configuration Supabase

1. Creer un projet Supabase.
2. Ouvrir le SQL Editor.
3. Coller le contenu de [`supabase/schema.sql`](/C:/Users/user/Desktop/FIRE/supabase/schema.sql) puis executer.
4. Activer le provider Google dans `Authentication > Providers` si vous voulez la connexion Google.
5. Copier [`.env.example`](/C:/Users/user/Desktop/FIRE/.env.example) vers `.env` et renseigner:

```bash
PUBLIC_SUPABASE_URL=...
PUBLIC_SUPABASE_ANON_KEY=...
```

6. Redemarrer `npm run dev`.

Notes:
- L'app cree le profil utilisateur automatiquement au premier login.
- Realtime est utilise pour accelerer la propagation. Un polling de securite toutes les 30s couvre aussi les retours reseau.

## Build et deploiement Vercel

```bash
npm run build
```

Le projet utilise `@sveltejs/adapter-vercel`, donc vous pouvez connecter le repo a Vercel directement.

Pensez a recopier les variables d'environnement `PUBLIC_SUPABASE_URL` et `PUBLIC_SUPABASE_ANON_KEY` dans le projet Vercel.

## Installation Android

1. Deployer l'app.
2. Ouvrir l'URL dans Chrome sur Android.
3. Utiliser `Ajouter a l'ecran d'accueil`.

La PWA conserve les donnees hors ligne via IndexedDB et rejoue la file de sync quand le reseau revient.

## Fonctionnel aujourd'hui

- Auth email/mot de passe + Google via Supabase
- Layout responsive: sidebar desktop, bottom bar mobile, FAB inbox
- Inbox + clarification sequentielle
- CRUD taches + sous-taches + swipe actions
- Dashboard "Maintenant", "Aujourd'hui", focus, inbox, retards, habitudes
- Focus Pomodoro relie a une tache, historique inclus
- Projets, agenda time-blocking drag/drop, habitudes, revue, analytics, parametres
- Local-first Dexie + queue persistante + merge de conflit base sur `version`
- Service worker + manifest PWA

## Structure du projet

- [`src/lib/flowpilot.ts`](/C:/Users/user/Desktop/FIRE/src/lib/flowpilot.ts)
  Moteur principal: auth, donnees locales, queue de sync, conflits, actions metier.
- [`src/lib/db.ts`](/C:/Users/user/Desktop/FIRE/src/lib/db.ts)
  Schema IndexedDB Dexie, aligne sur le modele distant et les tables locales annexes.
- [`src/lib/parser.ts`](/C:/Users/user/Desktop/FIRE/src/lib/parser.ts)
  Parsing inbox basique: date, urgence, tags, projet.
- [`src/routes/+layout.svelte`](/C:/Users/user/Desktop/FIRE/src/routes/+layout.svelte)
  Coque applicative, navigation mobile/desktop, notifications, quick capture.
- [`src/routes/+page.svelte`](/C:/Users/user/Desktop/FIRE/src/routes/+page.svelte)
  Dashboard.
- [`src/routes/tasks/+page.svelte`](/C:/Users/user/Desktop/FIRE/src/routes/tasks/+page.svelte)
  Liste taches, edition, sous-taches.
- [`src/routes/focus/+page.svelte`](/C:/Users/user/Desktop/FIRE/src/routes/focus/+page.svelte)
  Timer focus.
- [`src/service-worker.ts`](/C:/Users/user/Desktop/FIRE/src/service-worker.ts)
  Cache shell PWA et fallback offline.
- [`supabase/schema.sql`](/C:/Users/user/Desktop/FIRE/supabase/schema.sql)
  Schema SQL a coller dans Supabase.

## Scripts utiles

```bash
npm run dev
npm run check
npm run build
```
