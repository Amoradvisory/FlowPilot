# Nexus Notes

PWA de prise de notes locale-first pour capturer une idee, une photo, un lien ou un memo en quelques secondes, puis les retrouver avec priorite, decay et sync multi-device.

L'app demarre meme sans `.env` en mode local-only. Avec Supabase configure, l'auth Google/email et la sync entre appareils sont actives.

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
4. Copier [`.env.example`](/C:/Users/user/Desktop/FIRE/.env.example) vers `.env` et renseigner:

```bash
PUBLIC_SUPABASE_URL=...
PUBLIC_SUPABASE_ANON_KEY=...
```

5. Dans `Authentication > URL Configuration`, ajouter:
   - `http://localhost:5173`
   - l'URL Vercel de production
6. Si tu veux la connexion Google, activer le provider Google dans Supabase et renseigner le client OAuth Google.

## Build et deploiement

```bash
npm run build
```

Le projet est client-only et utilise `@sveltejs/adapter-static`, ce qui simplifie le build sur Windows et le deploiement Vercel.

Pense a recopier les variables d'environnement `PUBLIC_SUPABASE_URL` et `PUBLIC_SUPABASE_ANON_KEY` dans le projet Vercel.

## Installation Android

1. Deployer l'app.
2. Ouvrir l'URL dans Chrome sur Android.
3. Utiliser `Ajouter a l'ecran d'accueil`.

La PWA conserve les donnees hors ligne via IndexedDB et rejoue la file de sync quand le reseau revient.

## Fonctionnel aujourd hui

- Prise de notes locale-first avec Dexie + queue de sync persistante
- Connexion Supabase email/mot de passe + Google
- Capture rapide texte/photo/media avec commentaire
- Slash commands `/todo`, `/meeting`, `/idea`, `/later`
- Priorite chromee P0 -> P4
- Etats de vie `Graine`, `Active`, `Solide`, `Obsolete`
- Decay system `Fraiche`, `Tiede`, `Dormante`, `Fantome`
- Smart collections et constellation de tags
- Galerie media
- Dashboard de note velocity
- PWA installable sur desktop/mobile

## Structure du projet

- [`src/lib/flowpilot.ts`](/C:/Users/user/Desktop/FIRE/src/lib/flowpilot.ts)
  Moteur principal: auth, donnees locales, queue de sync, conflits, actions metier.
- [`src/lib/db.ts`](/C:/Users/user/Desktop/FIRE/src/lib/db.ts)
  Schema IndexedDB Dexie, aligne sur le modele distant et les tables locales annexes.
- [`src/lib/note-vault.ts`](/C:/Users/user/Desktop/FIRE/src/lib/note-vault.ts)
  Meta-modele des notes: couleur, priorite, etat de vie, decay.
- [`src/lib/nexus-notes.ts`](/C:/Users/user/Desktop/FIRE/src/lib/nexus-notes.ts)
  Intelligence locale des notes: slash commands, smart search, smart collections, velocity.
- [`src/lib/vault-document.ts`](/C:/Users/user/Desktop/FIRE/src/lib/vault-document.ts)
  Format de contenu des notes et pieces jointes.
- [`src/routes/+page.svelte`](/C:/Users/user/Desktop/FIRE/src/routes/+page.svelte)
  Dashboard Nexus Notes.
- [`src/routes/vault/+page.svelte`](/C:/Users/user/Desktop/FIRE/src/routes/vault/+page.svelte)
  Bibliotheque complete et editeur principal.
- [`src/routes/collections/+page.svelte`](/C:/Users/user/Desktop/FIRE/src/routes/collections/+page.svelte)
  Constellation, smart collections et decay.
- [`src/routes/media/+page.svelte`](/C:/Users/user/Desktop/FIRE/src/routes/media/+page.svelte)
  Galerie des notes avec medias.
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
