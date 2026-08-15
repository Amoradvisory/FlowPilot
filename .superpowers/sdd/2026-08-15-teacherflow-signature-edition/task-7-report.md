# Task 7 — Memory, CRUD and portable local data

Implemented versioned personal backups with a UTF-8 size bound, strict structural/domain validation, and demo exclusion. The Memory and Data placeholders were replaced with local-only UI flows: chronology filters, inline observation/decision editing, guarded deletion, decision status progression, demo reset, personal reset, export, import preview and atomic workspace replacement through the existing controller/repository queue.

Tests were written before production work:

- `tests/unit/teacherflow/backup.test.ts`
- `tests/e2e/teacherflow/crud-and-portability.spec.ts`

Static verification completed:

- `node node_modules/typescript/bin/tsc --noEmit` — exit 0
- targeted Prettier check — exit 0
- `git diff --check` — exit 0
- route/component scan found no `Dexie`, `indexedDB` or `localStorage` access.

## CI-required concern

Targeted Vitest could not start in this environment. Esbuild is blocked by the sandbox before test discovery with `Cannot read directory "../../../../../..": Access denied`, followed by unresolved `vitest.config.ts` / `Unexpected end of JSON input`. No test or E2E run is claimed green; CI (or an unrestricted local environment) must execute the new unit and Playwright specifications.
