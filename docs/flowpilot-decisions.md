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

## What Unlocks True Cross-Device Sync

To get real phone-to-PC sync:

1. create a Supabase project
2. run the SQL schema
3. set the Supabase keys in `.env`
4. deploy the app to a public URL
5. sign in with the same account on both devices

## Preservation

This repository should keep this version as the baseline before future variants or experiments.
