# Windows and Sync Notes

## Core Architecture

- Keep Supabase as the shared backend for auth, SQL, and realtime.
- Keep Dexie as the local mirror for offline work.
- Write locally first, then enqueue sync work.
- Store a `version` per synced row and resolve conflicts against that field.

## Practical Validation Loop

1. Run `npm run check`.
2. Run `npm run build`.
3. Run the dev server with `--host 0.0.0.0`.
4. Test core flows in the browser.
5. Check the browser console for errors and warnings.

## Windows-Specific Lessons

- If `adapter-vercel` fails locally on symlink creation for a client-only app, use `adapter-static`.
- When Git status shows the whole home directory, the project is probably inside a parent worktree. Initialize a nested repository in the project root.
- Keep shell commands PowerShell-friendly when working on Windows.

## Device Testing

- `localhost` is for the PC only.
- The phone must use the PC's LAN IP while both devices are on the same network.
- A local dev URL is useful for testing, not for long-term usage.

## Real Sync Requirements

- Add real Supabase keys in `.env`.
- Run the SQL schema in Supabase.
- Sign in with the same account on both devices.
- Prefer a deployed public URL for daily usage and Android installability.

## Playwright Caveat

- Treat full `open` calls cautiously when checking persistence. Use in-app navigation for the cleanest validation of client-side state.
