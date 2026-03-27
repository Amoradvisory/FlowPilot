---
name: local-first-sveltekit-pwa
description: Build, stabilize, or ship a local-first SvelteKit PWA with Dexie local storage, Supabase auth/realtime sync, offline queues, and Windows-safe validation. Use when Codex needs to deliver or debug a single-user app that must work offline first, sync later, and run well on desktop and Android.
---

# Local-First SvelteKit PWA

## Overview

Use this skill when the app must feel instant locally, keep working offline, and later synchronize through Supabase without turning the UX into a server-first product.

## Workflow

1. Inspect the runtime mode.
- Confirm whether the app is `local-only` or `online-sync`.
- Treat missing Supabase keys as a supported mode, not as a build failure.
- Make the UI explicit about the current mode.

2. Keep the data model mirrored.
- Mirror the synced Supabase tables in Dexie.
- Write locally first.
- Persist a sync queue for remote replay.
- Use `version` fields for conflict handling.
- Keep local-only tables such as conflict logs and local notifications out of remote sync.

3. Prefer a client-heavy shell when the product is truly offline-first.
- If SSR is not needed, keep `ssr = false`.
- If the app is client-only and `adapter-vercel` fails on Windows symlink creation during local build, switch to `adapter-static`.
- Keep deployment simple rather than forcing server logic the product does not need.

4. Preserve the shell before polishing.
- Mobile: bottom bar plus FAB.
- Desktop: persistent sidebar.
- Make the dark theme readable before adding extra features.
- Add modules only after auth, storage, sync, and layout are stable.

5. Validate in the same order every time.
- `npm run check`
- `npm run build`
- run the app on `0.0.0.0` for phone testing
- smoke test key flows with Playwright CLI
- confirm the browser console is clean

6. Use a device-safe testing loop.
- For LAN testing, run `npm run dev -- --host 0.0.0.0 --port 4173`.
- The phone can open the LAN IP only while the PC stays on.
- For real sync across devices, deploy a public URL and sign into Supabase on both devices.

## Validation Notes

- Prefer same-session Playwright navigation when checking local persistence. Fresh `open` calls can behave like a new browser context and make client storage checks noisy.
- Validate at least one cross-screen flow, not isolated screens only.
- When a route depends on locally created data, prefer navigating from inside the running app instead of reopening the URL from scratch.

## Windows and Deployment Notes

- For a pure client app, `adapter-static` plus a simple Vercel rewrite can be the least fragile path.
- If the project lives under a giant parent Git worktree, initialize a nested repository at the project root before committing.
- Run the dev server on `0.0.0.0` when testing from Android on the same Wi-Fi.

## References

- Read [references/windows-and-sync.md](references/windows-and-sync.md) when Windows build quirks, Dexie behavior, phone testing, or release hardening become the bottleneck.
