# FlowPilot Decisions

## What This Version Is

FlowPilot is a single-user local-first productivity PWA built with SvelteKit, TypeScript, Tailwind, Dexie, and Supabase.

The main product loop is:

- Inbox
- Clarify
- Tasks
- Focus
- Review

## Core Product Decisions

### 1. Local-first before sync

Every important write goes to Dexie first so the app stays instant and works offline.

### 2. Supabase is the shared layer, not the primary UX layer

Supabase handles auth, database, and realtime propagation between devices, but the app should still be usable when the network is gone.

### 3. Client-heavy shell

The app is intentionally client-heavy and offline-oriented, so the shell stays simple and resilient.

### 4. Conflict handling by version

Synced entities carry a `version` field. Conflicts are merged around that field and logged locally.

### 5. Validation discipline

The reliable validation loop for this project is:

1. `npm run check`
2. `npm run build`
3. browser smoke test
4. clean console

## Difficulties Solved

### Windows build fragility

The local Windows build hit adapter friction with Vercel symlink behavior. For this client-only app, switching to a static adapter kept the project buildable and deployable.

### Offline UX ambiguity

The app initially risked showing sync intent even when no backend was configured. The local-only mode was made explicit so the product stays honest.

### Skill capture

The reusable know-how from this build was extracted into the `local-first-sveltekit-pwa` Codex skill so future work can start from the same delivery pattern.

### Auth and release closure

The app did not become truly usable across devices until the release loop was closed:

- public Vercel URL
- Supabase URL configuration
- Google Auth Platform web client
- Supabase Google provider activation
- real end-to-end sign-in test on the deployed app

That sequence is now part of the reusable skill instead of living only in chat history.

### Notes, prompts, and snippets without a schema migration

The broader note-taking layer was added as a `Vault` built on top of the existing `notes` table instead of introducing new remote tables right away.

Metadata such as item kind, color, pinning, and snippet language is encoded in `notes.tags` with reserved prefixes.

The note body itself can now hold a structured Vault document with plain text plus lightweight attachments such as links, images, short audio clips, or small videos.

That choice kept three things stable:

- no Supabase SQL migration for this pass
- no Dexie mirror change for sync
- no regression risk for offline replay and conflict handling

To keep the product reliable, embedded media is intentionally capped to small files in this version. Larger files should move to dedicated object storage in a later pass.

If the Vault later needs attachments, sharing, or richer search, it can graduate to dedicated tables. For now, the metadata-on-tags approach is the fastest safe extension.

## What Unlocks True Cross-Device Sync

To get real phone-to-PC sync:

1. create a Supabase project
2. run the SQL schema
3. set the Supabase keys in `.env`
4. deploy the app to a public URL
5. sign in with the same account on both devices

## Google OAuth Pattern That Worked

For this version, the reliable pattern was:

1. create the Google OAuth client after the production URL exists
2. use the Supabase callback URL as the Google redirect URI
3. register both production and localhost origins
4. if Google OAuth stays in `Test`, add the real user email as a test user
5. enable Google in Supabase and test from the deployed app, not only localhost

This is a reusable delivery shortcut for future single-user apps.

## Reusable Acceleration

The next app of the same family can start faster by reusing:

- the `local-first-sveltekit-pwa` skill
- the SQL schema pattern with `version` fields
- the static SvelteKit plus Vercel deployment pattern
- the Supabase URL configuration pattern
- the Google OAuth checklist
- the validation loop: typecheck, build, deployed auth test, cross-device sync test

## Preservation

This repository should keep this version as the baseline before future variants or experiments.
