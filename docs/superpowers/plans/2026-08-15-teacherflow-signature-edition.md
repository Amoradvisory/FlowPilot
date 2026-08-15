# TeacherFlow Signature Edition Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Transformer `/teacher` en application-démonstrateur TeacherFlow autonome, local-first, installable, réellement utilisable hors ligne et défendable professionnellement.

**Architecture:** Le dépôt SvelteKit reste unique, mais des groupes de routes séparent le layout TeacherFlow du legacy FlowPilot. Le domaine métier pur pilote un repository IndexedDB/Dexie versionné, un contrôleur Svelte 5 et cinq routes pré-rendues ; un service worker enregistré manuellement ne contrôle que `/teacher/` sous le base path GitHub Pages.

**Tech Stack:** Svelte 5.54, SvelteKit 2.50, TypeScript 5.9, Dexie 4.4, Vitest, fake-indexeddb, Playwright, axe-core, adapter-static, GitHub Actions et GitHub Pages.

## Global Constraints

- URL publique canonique : `https://amoradvisory.github.io/FlowPilot/teacher/`.
- Base path de production : `/FlowPilot` ; aucun chemin absolu ne doit ignorer ce préfixe.
- Routes principales : `/teacher/`, `/teacher/observe/`, `/teacher/memory/`, `/teacher/data/`, `/teacher/about/`.
- Données métier exclusivement locales dans IndexedDB ; aucun compte, backend, cloud, analytics ou synchronisation.
- Aucune donnée personnelle ou sensible d’élève n’est nécessaire ni encouragée.
- Démonstration et espace personnel séparés ; l’export exclut toujours la démonstration.
- IA : aucune intégration générative dans cette édition ; les amorces sont déterministes, visibles et éditables.
- PWA : après une première visite réussie, lecture, création, édition, suppression et reprise doivent fonctionner hors ligne.
- Service worker limité au scope `${base}/teacher/` et incapable de contrôler les routes legacy.
- Cache applicatif séparé d’IndexedDB ; aucune saisie utilisateur dans Cache Storage.
- Mise à jour contrôlée par l’utilisateur ; aucune activation brutale pendant une saisie.
- Texte normal ≥ 4,5:1 ; grands textes ≥ 3:1 ; cibles tactiles ≥ 44 × 44 px.
- Viewports obligatoires : 360, 390, 412, 768 et 1440 px.
- Toutes les fonctions visibles fonctionnent de bout en bout ; aucun bouton décoratif ou lien mort.
- Le produit reste présenté comme démonstrateur professionnel sans utilisateur, impact, partenariat ou validation inventés.
- Développement décrit honnêtement comme assisté par IA sous cadrage produit et pédagogique.
- Les routes FlowPilot historiques restent fonctionnelles mais ne sont ni rebrandées ni perfectionnées sans bénéfice TeacherFlow.
- Avant chaque commit : test ciblé, `svelte-check`, puis `git diff --check`.
- Avant release : tests complets, build Pages, E2E, CI, production, console, mobile, offline et update N → N+1.

---

## File map

### Route boundaries

- `src/routes/+layout.svelte` — racine minimale sans dépendance de marque.
- `src/routes/+error.svelte` — erreur publique neutre avec retour base-aware.
- `src/routes/(legacy)/+layout.svelte` — coque FlowPilot actuelle.
- `src/routes/(legacy)/+layout.ts` — options client-only du legacy.
- `src/routes/(legacy)/**` — routes FlowPilot existantes, URL inchangée.
- `src/routes/(teacher)/+layout.svelte` — contexte, shell et cycle PWA TeacherFlow.
- `src/routes/(teacher)/+layout.ts` — SSR, prerender et trailing slash TeacherFlow.
- `src/routes/(teacher)/teacher/**` — cinq routes TeacherFlow.
- `src/routes/teacherflow.css` — tokens et styles exclusivement TeacherFlow.

### Domain and data

- `src/lib/teacherflow/domain/types.ts` — entités, drafts, snapshots et résultats.
- `src/lib/teacherflow/domain/invariants.ts` — validation et normalisation pures.
- `src/lib/teacherflow/domain/commands.ts` — créations, éditions et transitions.
- `src/lib/teacherflow/domain/selectors.ts` — vues Aujourd’hui et Mémoire.
- `src/lib/teacherflow/data/repository.ts` — interface de persistance.
- `src/lib/teacherflow/data/database.ts` — schéma Dexie et transactions.
- `src/lib/teacherflow/data/migrations.ts` — migration legacy et sauvegardes.
- `src/lib/teacherflow/data/backup.ts` — format, validation, export et import.
- `src/lib/teacherflow/data/errors.ts` — erreurs techniques traduites en erreurs produit.
- `src/lib/teacherflow/demo/seed.ts` — dataset fictif déterministe.
- `src/lib/teacherflow/state/teacherflow-state.svelte.ts` — contrôleur réactif.
- `src/lib/teacherflow/state/context.ts` — injection typée du contrôleur.

### UI

- `src/lib/teacherflow/components/AppShell.svelte`
- `src/lib/teacherflow/components/PrimaryNav.svelte`
- `src/lib/teacherflow/components/WorkspaceBadge.svelte`
- `src/lib/teacherflow/components/NetworkStatus.svelte`
- `src/lib/teacherflow/components/UpdateNotice.svelte`
- `src/lib/teacherflow/components/SessionCard.svelte`
- `src/lib/teacherflow/components/CourseForm.svelte`
- `src/lib/teacherflow/components/SessionForm.svelte`
- `src/lib/teacherflow/components/DecisionCard.svelte`
- `src/lib/teacherflow/components/ObservationForm.svelte`
- `src/lib/teacherflow/components/MemoryFilters.svelte`
- `src/lib/teacherflow/components/ConfirmDialog.svelte`
- `src/lib/teacherflow/components/EmptyState.svelte`
- `src/lib/teacherflow/components/StatusMessage.svelte`

### PWA, tooling and verification

- `src/lib/teacherflow/pwa/update-manager.ts` — enregistrement, update et coordination multi-onglets.
- `src/service-worker.ts` — stratégies cache et messages d’activation.
- `static/teacher/manifest.webmanifest` — manifeste relatif et brandé.
- `static/teacher/icons/*` — icônes 192, 512 et maskable.
- `static/teacher/social-card.png` — aperçu 1200 × 630.
- `scripts/quality.mjs` — exécution sans shell des outils locaux.
- `scripts/check-teacherflow-bundle.mjs` — budget du précache.
- `vitest.config.ts` — tests unitaires et intégration.
- `playwright.config.ts` — E2E production sous base path.
- `tests/unit/teacherflow/**`
- `tests/integration/teacherflow/**`
- `tests/e2e/teacherflow/**`
- `.github/workflows/teacherflow-quality.yml`
- `.github/workflows/deploy-teacherflow-pages.yml`

---

### Task 1: Quality harness and reproducible baseline

**Files:**
- Modify: `package.json`
- Modify: `package-lock.json`
- Create: `scripts/quality.mjs`
- Create: `vitest.config.ts`
- Create: `playwright.config.ts`
- Create: `tests/unit/teacherflow/baseline.test.ts`

**Interfaces:**
- Produces: `node scripts/quality.mjs <check|unit|integration|build-pages>`.
- Produces: npm scripts `test:unit`, `test:integration`, `test:e2e`, `check`, `lint:teacherflow`, `build:pages`.

- [ ] **Step 1: Capture the baseline with direct executables**

Run:

```powershell
& 'C:\Program Files\nodejs\node.exe' --test src/lib/teacherflow-demo.test.ts
& 'C:\Program Files\nodejs\node.exe' node_modules/@sveltejs/kit/svelte-kit.js sync
& 'C:\Program Files\nodejs\node.exe' node_modules/svelte-check/bin/svelte-check --tsconfig ./tsconfig.json
```

Expected: legacy tests report 5/5; direct `svelte-check` terminates with a clear status. Record duration and distinguish an npm shell/path defect from a Svelte defect.

- [ ] **Step 2: Add the test dependencies**

Install exact compatible current majors and update the lockfile:

```powershell
npm install --save-dev vitest @vitest/coverage-v8 fake-indexeddb @playwright/test @axe-core/playwright
npx playwright install chromium firefox webkit
```

If the current path containing `&` prevents npm execution, run these commands from the isolated short-path worktree created for execution; do not weaken the scripts.

- [ ] **Step 3: Write the harness test**

```ts
import { describe, expect, it } from 'vitest';
import pkg from '../../../package.json';

describe('quality scripts', () => {
	it('exposes every Signature Edition gate', () => {
		for (const name of ['test:unit', 'test:integration', 'test:e2e', 'check', 'build:pages']) {
			expect(pkg.scripts).toHaveProperty(name);
		}
	});
});
```

- [ ] **Step 4: Verify the test fails**

Run: `node node_modules/vitest/vitest.mjs run tests/unit/teacherflow/baseline.test.ts`  
Expected: FAIL because the scripts do not exist.

- [ ] **Step 5: Implement the shell-free runner and configs**

`scripts/quality.mjs` must use `spawn(process.execPath, args, { shell: false, stdio: 'inherit' })`. `check` runs SvelteKit sync then `svelte-check`; `build-pages` spawns Vite with `BASE_PATH=/FlowPilot` in the child environment. Vitest includes `tests/unit/**/*.test.ts` and `tests/integration/**/*.test.ts` by project. Playwright starts a production preview and uses `/FlowPilot/teacher/` as `baseURL`.

- [ ] **Step 6: Run the harness**

Run:

```powershell
node scripts/quality.mjs unit
node scripts/quality.mjs check
node scripts/quality.mjs build-pages
```

Expected: each process terminates and returns a visible exit code; no silent npm success is accepted.

- [ ] **Step 7: Commit**

```powershell
git add package.json package-lock.json scripts/quality.mjs vitest.config.ts playwright.config.ts tests/unit/teacherflow/baseline.test.ts
git commit -m "test: establish TeacherFlow quality harness"
```

### Task 2: Isolate TeacherFlow routes from FlowPilot

**Files:**
- Modify: `svelte.config.js`
- Replace: `src/routes/+layout.svelte`
- Create: `src/routes/+error.svelte`
- Move: `src/routes/+layout.ts` → `src/routes/(legacy)/+layout.ts`
- Move: `src/routes/layout.css` → `src/routes/(legacy)/layout.css`
- Move: `src/routes/+page.svelte` and every legacy route directory except `teacher` → `src/routes/(legacy)/`
- Move: `src/routes/teacher/+page.svelte` → `src/routes/(teacher)/teacher/+page.svelte`
- Create: `src/routes/(teacher)/+layout.ts`
- Create: `src/routes/(teacher)/+layout.svelte`
- Create: `src/routes/teacherflow.css`
- Create: `tests/e2e/teacherflow/isolation.spec.ts`

**Interfaces:**
- Produces: unchanged public legacy URLs and standalone `/teacher/**` routes.
- Produces: TeacherFlow markup `.teacherflow-app`; legacy markup `.shell-grid` must never coexist on a TeacherFlow route.

- [ ] **Step 1: Write the failing isolation E2E**

```ts
import { expect, test } from '@playwright/test';

test('TeacherFlow never renders the legacy shell', async ({ page }) => {
	await page.goto('./');
	await expect(page.locator('.teacherflow-app')).toHaveCount(1);
	await expect(page.locator('.shell-grid')).toHaveCount(0);
	await expect(page.getByText(/Nexus|Neural Notebook|Nouvelle note/i)).toHaveCount(0);
});
```

- [ ] **Step 2: Verify it fails against the Pages build**

Run: `node scripts/quality.mjs build-pages` then `node node_modules/@playwright/test/cli.js test tests/e2e/teacherflow/isolation.spec.ts --project=chromium`  
Expected: FAIL because the Nexus shell is present under the base path.

- [ ] **Step 3: Move the legacy tree into `(legacy)`**

Move `agenda`, `analytics`, `auth`, `clarify`, `collections`, `focus`, `habits`, `inbox`, `media`, `projects`, `review`, `settings`, `tasks`, `vault` and the root page into `(legacy)`. Keep file contents unchanged during this step. Move the current layout and CSS with them.

- [ ] **Step 4: Create minimal root and TeacherFlow layouts**

Root layout renders only its child. Teacher layout imports `teacherflow.css`, wraps content in `.teacherflow-app`, and contains no import from `flowpilot.ts`, `supabase.ts`, `AuthGate`, `AccountBadge`, `CommandPalette` or the legacy component directory.

The root error page renders a neutral French message, the requested status and one base-aware return link. It never imports or renders the Nexus shell.

`src/routes/(teacher)/+layout.ts`:

```ts
export const ssr = true;
export const prerender = true;
export const trailingSlash = 'always';
```

- [ ] **Step 5: Configure static routing**

Use `adapter({ fallback: '404.html' })`. Preserve `paths.base`. Remove the workflow’s manual copies of `index.html`; prerendered TeacherFlow routes must generate their own `index.html` files.

- [ ] **Step 6: Verify route and bundle isolation**

Run all five legacy smoke URLs plus all five TeacherFlow URLs. Inspect the built TeacherFlow HTML for metadata and the browser network panel for Supabase/auth chunks. Expected: no legacy shell, no absolute root link, no auth initialization, no 404.

- [ ] **Step 7: Commit**

```powershell
git add svelte.config.js src/routes tests/e2e/teacherflow/isolation.spec.ts
git commit -m "refactor: isolate TeacherFlow route boundary"
```

### Task 3: Build the pure TeacherFlow domain

**Files:**
- Create: `src/lib/teacherflow/domain/types.ts`
- Create: `src/lib/teacherflow/domain/invariants.ts`
- Create: `src/lib/teacherflow/domain/commands.ts`
- Create: `src/lib/teacherflow/domain/selectors.ts`
- Create: `tests/unit/teacherflow/domain.test.ts`

**Interfaces:**
- Produces: `Course`, `Session`, `Observation`, `Decision`, `WorkspaceSnapshot`.
- Produces: `createCourse`, `createSession`, `createObservation`, `createDecision`, `updateDecisionStatus`.
- Produces: `selectToday(snapshot, now)` and `selectMemory(snapshot, filters)`.

- [ ] **Step 1: Define tests for invariants and lifecycle**

Cover normalization, invalid dates, empty notes, cross-workspace relations, optional target session, `to_prepare → ready → applied`, invalid reverse transitions and cascading deletion intent. Assert that `keep`, `adjust` and `verify` remain neutral pedagogical signals.

```ts
it('links a human-confirmed decision to a future session', () => {
	const observation = createObservation(validObservationDraft, clock);
	const decision = createDecision({
		workspaceId: observation.workspaceId,
		observationId: observation.id,
		targetSessionId: 'session-next',
		text: 'Prévoir un exemple chiffré avant la consigne'
	}, clock);
	expect(decision.status).toBe('to_prepare');
});
```

- [ ] **Step 2: Run and verify failure**

Run: `node node_modules/vitest/vitest.mjs run tests/unit/teacherflow/domain.test.ts`  
Expected: FAIL because domain modules are missing.

- [ ] **Step 3: Implement types and pure rules**

Use ISO UTC strings, `crypto.randomUUID()` behind an injectable `IdFactory`, normalized whitespace, explicit maximum lengths (`Course.name` 80, `Session.title` 120, `Observation.note` 600, `Decision.text` 300) and discriminated `DomainError` codes.

- [ ] **Step 4: Implement selectors**

`selectToday` returns the next dated session, unscheduled decisions and decisions targeting that session. `selectMemory` filters by course, signal and decision status, then orders newest observation first without mutating the snapshot.

- [ ] **Step 5: Run unit tests and check**

Run: `node scripts/quality.mjs unit` then `node scripts/quality.mjs check`.  
Expected: PASS and no TypeScript/Svelte errors.

- [ ] **Step 6: Commit**

```powershell
git add src/lib/teacherflow/domain tests/unit/teacherflow/domain.test.ts
git commit -m "feat: model the TeacherFlow learning loop"
```

### Task 4: Add versioned IndexedDB persistence and safe migration

**Files:**
- Create: `src/lib/teacherflow/data/repository.ts`
- Create: `src/lib/teacherflow/data/database.ts`
- Create: `src/lib/teacherflow/data/migrations.ts`
- Create: `src/lib/teacherflow/data/errors.ts`
- Create: `tests/integration/teacherflow/repository.test.ts`
- Create: `tests/integration/teacherflow/migration.test.ts`

**Interfaces:**
- Produces: `TeacherFlowRepository` with `load`, `putCourse`, `putSession`, `putObservationWithDecision`, `putDecision`, `deleteObservation`, `deleteCourse`, `replaceWorkspace`, `clearWorkspace`.
- Produces: `openTeacherFlowRepository(workspaceId, options)`.
- Consumes: domain entity types and validators from Task 3.

- [ ] **Step 1: Write repository contract tests**

Use `fake-indexeddb/auto`. Test transaction atomicity, workspace isolation, referential checks, cascade delete, persistence across repository instances and unchanged state after a forced transaction failure.

- [ ] **Step 2: Write migration failure tests**

Seed `teacherflow-observations-v1` with valid, partially invalid, malformed and invalid-date payloads. Assert raw backup creation, recovered counts, ignored counts and preservation of the source after a thrown migration.

- [ ] **Step 3: Run and verify failures**

Run: `node node_modules/vitest/vitest.mjs run tests/integration/teacherflow`  
Expected: FAIL because the repository is missing.

- [ ] **Step 4: Implement the Dexie database**

Create stores `courses`, `sessions`, `observations`, `decisions`, `meta`, `recoveryBackups` with workspace-prefixed compound indexes. Perform linked writes and deletions in one Dexie transaction. Never expose Dexie tables to routes or components.

- [ ] **Step 5: Implement the legacy migration**

Read `teacherflow-observations-v1` inside `try/catch`; store a bounded raw backup; recover valid observations into `Observations importées`; report ignored records; set migration id `legacy-localstorage-v1`; never remove the source on failure.

- [ ] **Step 6: Translate technical failures**

Map `QuotaExceededError`, `SecurityError`, invalid schema and migration failure to `StorageUnavailable`, `StorageFull`, `InvalidStoredData` and `MigrationFailed`, each carrying a French recovery instruction.

- [ ] **Step 7: Verify**

Run integration tests, unit tests and check. Expected: all green; failed writes leave snapshots unchanged.

- [ ] **Step 8: Commit**

```powershell
git add src/lib/teacherflow/data tests/integration/teacherflow
git commit -m "feat: persist TeacherFlow data with safe migrations"
```

### Task 5: Add deterministic demo data and the application controller

**Files:**
- Create: `src/lib/teacherflow/demo/seed.ts`
- Create: `src/lib/teacherflow/state/teacherflow-state.svelte.ts`
- Create: `src/lib/teacherflow/state/context.ts`
- Modify: `src/routes/(teacher)/+layout.svelte`
- Create: `tests/unit/teacherflow/demo-seed.test.ts`
- Create: `tests/integration/teacherflow/state.test.ts`

**Interfaces:**
- Produces: `DEMO_WORKSPACE_ID`, `PERSONAL_WORKSPACE_ID`, `createDemoSeed(clock)`.
- Produces: `createTeacherFlowState({ repositoryFactory, clock, network })`.
- Produces controller methods: `switchWorkspace`, `saveObservationFlow`, `saveDecision`, `deleteObservation`, `resetDemo`, `resetPersonal`.

- [ ] **Step 1: Test deterministic, non-identifying seed data**

Assert stable entity ids, coherent course/session relations, absence of person/school names and presence of one complete observation → decision → future session loop.

- [ ] **Step 2: Test state transitions and error truthfulness**

Assert that `Enregistré localement` appears only after repository success; failed persistence retains the draft and exposes the mapped recovery message. Test switching workspaces cannot leak entities.

- [ ] **Step 3: Run and verify failures**

Run the two new test files. Expected: FAIL because seed and controller are absent.

- [ ] **Step 4: Implement seed and controller**

The controller owns `loading | ready | degraded | error`, active workspace, snapshot, form draft and transient status. Components receive derived readonly state and command methods. Repository creation occurs only in the browser after mount.

- [ ] **Step 5: Inject through Svelte context**

Create a typed context key and initialize the state in the TeacherFlow layout. SSR renders the meaningful static shell and demo explanation; hydration replaces it with the persisted workspace without legacy imports.

- [ ] **Step 6: Verify and commit**

Run unit, integration and check, then:

```powershell
git add src/lib/teacherflow/demo src/lib/teacherflow/state src/routes/(teacher)/+layout.svelte tests
git commit -m "feat: orchestrate separate TeacherFlow workspaces"
```

### Task 6: Build Today and Observe as the 90-second value loop

**Files:**
- Replace: `src/routes/(teacher)/teacher/+page.svelte`
- Create: `src/routes/(teacher)/teacher/observe/+page.svelte`
- Create: `src/lib/teacherflow/components/AppShell.svelte`
- Create: `src/lib/teacherflow/components/PrimaryNav.svelte`
- Create: `src/lib/teacherflow/components/WorkspaceBadge.svelte`
- Create: `src/lib/teacherflow/components/SessionCard.svelte`
- Create: `src/lib/teacherflow/components/CourseForm.svelte`
- Create: `src/lib/teacherflow/components/SessionForm.svelte`
- Create: `src/lib/teacherflow/components/DecisionCard.svelte`
- Create: `src/lib/teacherflow/components/ObservationForm.svelte`
- Create: `src/lib/teacherflow/components/StatusMessage.svelte`
- Create: `tests/e2e/teacherflow/value-loop.spec.ts`

**Interfaces:**
- Consumes: controller and selectors from Tasks 3–5.
- Produces: stable test ids `today-next-session`, `observe-form`, `saved-decision`.

- [ ] **Step 1: Write the 30-second and 90-second E2E tests**

The first test asserts the audience/problem/action copy and one primary CTA above the fold at 390 × 844. The second completes signal → note → decision → target session, saves, returns to Aujourd’hui and sees the exact decision text.

- [ ] **Step 2: Verify failures against the old page**

Expected: missing routes, huge preamble and no editable decision linked to a future session.

- [ ] **Step 3: Implement the application shell**

Use three primary links (`Aujourd’hui`, `Observer`, `Mémoire`), a secondary data/démarche menu, skip link and workspace badge. All hrefs use SvelteKit base-aware helpers; no literal domain-root route.

- [ ] **Step 4: Implement Today**

Render the concise proposition, next session, decisions to prepare, unplanned decisions and empty-state onboarding. Replace every fictitious metric with real counts computed from local entities or omit it.

The empty personal workspace opens `CourseForm`, then `SessionForm`, so a new user can create, edit and archive a course and create or edit a first session without leaving Aujourd’hui.

- [ ] **Step 5: Implement Observe**

Form fields: course/session context, signal, observation, editable decision and optional target session. Place the student-data warning adjacent to the note. On success, focus `saved-decision` and provide direct return to Aujourd’hui.

- [ ] **Step 6: Verify desktop/mobile and commit**

Run E2E at 390 and 1440, unit/integration/check, then commit:

```powershell
git add src/routes/(teacher) src/lib/teacherflow/components tests/e2e/teacherflow/value-loop.spec.ts
git commit -m "feat: deliver TeacherFlow's core value loop"
```

### Task 7: Build Memory, CRUD and portable local data

**Files:**
- Create: `src/routes/(teacher)/teacher/memory/+page.svelte`
- Create: `src/routes/(teacher)/teacher/data/+page.svelte`
- Create: `src/lib/teacherflow/components/MemoryFilters.svelte`
- Create: `src/lib/teacherflow/components/ConfirmDialog.svelte`
- Create: `src/lib/teacherflow/components/EmptyState.svelte`
- Create: `src/lib/teacherflow/data/backup.ts`
- Create: `tests/unit/teacherflow/backup.test.ts`
- Create: `tests/e2e/teacherflow/crud-and-portability.spec.ts`

**Interfaces:**
- Produces: `exportWorkspace(snapshot, appVersion): TeacherFlowBackup`.
- Produces: `parseTeacherFlowBackup(input): ParseResult<TeacherFlowBackup>`.
- Produces: edit/delete/reset/import/export UI.

- [ ] **Step 1: Write strict backup tests**

Test format id/version, demo exclusion, maximum file size, invalid relations, unknown enum, malformed date and valid round-trip. Test import failure leaves the existing snapshot byte-for-byte equivalent.

- [ ] **Step 2: Write CRUD E2E**

Create a course and session, edit both, create an observation, edit its note and decision, mark the decision ready/applied, filter it in Mémoire, delete it after confirmation, archive the course, reload and confirm persistence. Export, reset personal, import with preview, confirm restore.

- [ ] **Step 3: Verify failures**

Run targeted unit and E2E files; expect missing functionality.

- [ ] **Step 4: Implement Memory**

Render a semantic chronology grouped by course/session with filters `Cours`, `Signal`, `État`. Editing occurs in an accessible inline panel or dialog; deletion describes cascaded objects and returns focus.

- [ ] **Step 5: Implement Data**

Show local-only explanation, shared-device warning, last export, export button, import preview/replace confirmation, demo reset and strongly confirmed personal reset. Never label data as cloud-saved or synchronized.

- [ ] **Step 6: Verify and commit**

Run unit, integration, E2E and check, then:

```powershell
git add src/routes/(teacher)/teacher/memory src/routes/(teacher)/teacher/data src/lib/teacherflow tests
git commit -m "feat: make TeacherFlow memory portable and editable"
```

### Task 8: Apply the Signature design system and accessibility contract

**Files:**
- Modify: `src/routes/teacherflow.css`
- Modify: all `src/lib/teacherflow/components/*.svelte`
- Modify: all `src/routes/(teacher)/teacher/**/*.svelte`
- Create: `tests/e2e/teacherflow/accessibility.spec.ts`
- Create: `tests/e2e/teacherflow/responsive.spec.ts`

**Interfaces:**
- Produces CSS tokens `--tf-*` for color, space, type, radius, shadow and focus.
- Produces reusable states for buttons, fields, cards, dialogs and feedback.

- [ ] **Step 1: Write automated accessibility assertions**

Use `@axe-core/playwright` on all five routes, reject serious/critical violations, assert one H1, labelled controls, visible focus, dialog focus return and keyboard completion of the observation loop.

- [ ] **Step 2: Write responsive assertions**

At 360, 390, 412, 768 and 1440: assert no horizontal overflow, 44 px primary targets, visible save/result, no sticky obstruction and stable navigation. Repeat Observe in landscape mobile.

- [ ] **Step 3: Verify failures**

Expected: current palette contrast and touch target failures are detected.

- [ ] **Step 4: Implement tokens and component states**

Use system fonts; warm ivory background; deep ink; accessible muted green and terracotta; no gradient. Add `:focus-visible`, invalid, disabled, hover, pressed, offline and success states. Respect `prefers-reduced-motion`.

- [ ] **Step 5: Perform manual keyboard and screen-size review**

Tab through every critical action; inspect 360/390/412/768/1440 screenshots; test textarea with virtual keyboard emulation. Record observations in the release report, not as unverified claims.

- [ ] **Step 6: Verify and commit**

Run accessibility, responsive, value-loop E2E and check. Commit:

```powershell
git add src/routes/teacherflow.css src/routes/(teacher) src/lib/teacherflow/components tests/e2e/teacherflow
git commit -m "style: establish TeacherFlow Signature experience"
```

### Task 9: Implement the scoped PWA and offline lifecycle

**Files:**
- Modify: `svelte.config.js`
- Replace: `src/service-worker.ts`
- Create: `src/lib/teacherflow/pwa/update-manager.ts`
- Modify: `src/routes/(teacher)/+layout.svelte`
- Create: `src/lib/teacherflow/components/NetworkStatus.svelte`
- Create: `src/lib/teacherflow/components/UpdateNotice.svelte`
- Create: `static/teacher/manifest.webmanifest`
- Create: `static/teacher/icons/icon-192.png`
- Create: `static/teacher/icons/icon-512.png`
- Create: `static/teacher/icons/icon-maskable-512.png`
- Create: `tests/unit/teacherflow/pwa.test.ts`
- Create: `tests/e2e/teacherflow/offline.spec.ts`
- Create: `tests/e2e/teacherflow/update.spec.ts`

**Interfaces:**
- Produces: `createUpdateManager({ base, onUpdateReady, onOfflineReady })`.
- Worker messages: `{ type: 'SKIP_WAITING' }`, `{ type: 'OFFLINE_READY', version }`.
- Cache names: `teacherflow-shell-${version}` and `teacherflow-runtime-${version}`.

- [ ] **Step 1: Write manifest and policy unit tests**

Parse the manifest; assert `name`, `short_name`, relative `start_url: './'`, relative `scope: './'`, standalone display and three valid icons. Test request classification: hashed asset cache-first, TeacherFlow navigation network-first, cross-origin/network-only and non-GET ignored.

- [ ] **Step 2: Write offline E2E**

Visit online; await `OFFLINE_READY`; create data; set context offline; reload each critical route; create/edit/delete; close context; reopen offline with persistent profile; verify all changes.

- [ ] **Step 3: Write N → N+1 test**

Serve build N, create IndexedDB data, replace served assets with build N+1, trigger `registration.update()`, assert update notice, activate, reload once, assert new visible build marker and unchanged data.

- [ ] **Step 4: Verify failures**

Expected: old manifest paths, root-scoped worker and offline navigation fail.

- [ ] **Step 5: Implement manual registration and scoped caching**

Set `kit.serviceWorker.register = false`. Register `${base}/service-worker.js` with scope `${base}/teacher/`. Precache emitted build files plus filtered `static/teacher/**`; cache no user data. Reject requests outside same origin or outside TeacherFlow client purpose.

- [ ] **Step 6: Implement controlled update**

Check on load, visibility and navigation with throttling. Keep the new worker waiting; show French notice; coordinate tabs; send `SKIP_WAITING` only after action; reload once on `controllerchange`. Delete only previous TeacherFlow caches and the audited obsolete orphan prefix.

- [ ] **Step 7: Generate and inspect icons**

Use one simple TeacherFlow mark with adequate maskable safe zone. Inspect the three raster files at original resolution and in installed-app previews; no Nexus/Svelte/FlowPilot identity remains.

- [ ] **Step 8: Verify and commit**

Run unit, offline, update, cross-browser critical E2E, check and build Pages. Commit:

```powershell
git add svelte.config.js src/service-worker.ts src/lib/teacherflow/pwa src/lib/teacherflow/components src/routes/(teacher) static/teacher tests
git commit -m "feat: make TeacherFlow reliably available offline"
```

### Task 10: Add static metadata, truthful proof and release budgets

**Files:**
- Create: `src/routes/(teacher)/teacher/about/+page.svelte`
- Modify: all TeacherFlow route heads
- Create: `static/teacher/social-card.png`
- Create: `scripts/check-teacherflow-bundle.mjs`
- Create: `tests/unit/teacherflow/public-contract.test.ts`
- Create: `tests/e2e/teacherflow/metadata.spec.ts`

**Interfaces:**
- Produces: canonical/OG metadata in raw HTML.
- Produces: bundle check with 2 MiB compressed precache ceiling.

- [ ] **Step 1: Write the public-contract tests**

Build under `/FlowPilot`; read `build/teacher/index.html`; assert French lang, title, description, canonical with trailing slash, OG/Twitter fields, manifest, favicon and 1200 × 630 social image. Scan TeacherFlow source/build for `Nexus`, `Neural Notebook`, dead root hrefs, unfinished-work markers, false impact/adoption wording and unsafe `{@html}`.

- [ ] **Step 2: Verify failures**

Expected: raw HTML metadata and brand assets are incomplete.

- [ ] **Step 3: Implement metadata and Démarche**

Every route receives a precise title/description and the same canonical policy. Démarche states problem, hypothesis, local-first choice, absence of IA, limits, no institutional validation and `Développement assisté par IA sous cadrage produit et pédagogique`.

- [ ] **Step 4: Add measurable budgets**

The script reads build output and service-worker asset lists, reports compressed totals and fails above 2 MiB. Record before/after JS/CSS and first-load request counts.

- [ ] **Step 5: Verify and commit**

Run public-contract, metadata, bundle, check and build. Commit:

```powershell
git add src/routes/(teacher) static/teacher scripts/check-teacherflow-bundle.mjs tests
git commit -m "feat: complete TeacherFlow public proof"
```

### Task 11: Enforce CI, deployment and production smoke tests

**Files:**
- Create: `.github/workflows/teacherflow-quality.yml`
- Modify: `.github/workflows/deploy-teacherflow-pages.yml`
- Create: `scripts/verify-teacherflow-production.mjs`
- Create: `tests/e2e/teacherflow/production.spec.ts`
- Modify: `package.json`
- Modify: `package-lock.json`

**Interfaces:**
- Produces: PR quality workflow and main-only Pages release.
- Produces: `node scripts/verify-teacherflow-production.mjs <url>`.

- [ ] **Step 1: Write production smoke assertions**

Check HTTP success for all five URLs/assets; raw metadata; zero 4xx/5xx requests; zero console errors; creation/persistence/refresh; manifest/service-worker scope; no legacy shell; direct deep link and back navigation.

- [ ] **Step 2: Build the quality workflow**

On pull request and push to the feature/main branches: `npm ci`, Playwright browser install, unit, integration, check, targeted format, Pages build, critical Chromium E2E and artifact upload on failure. No deploy permission in this workflow.

- [ ] **Step 3: Harden the deploy workflow**

Trigger on `main`, use `concurrency` to cancel obsolete builds, depend on all gates, build with `BASE_PATH=/FlowPilot`, upload exact `build/`, deploy through official Pages actions and expose the deployment URL. Remove the `teacherflow-demo` trigger and manual HTML copying.

- [ ] **Step 4: Run the complete local gate**

```powershell
node scripts/quality.mjs unit
node scripts/quality.mjs integration
node scripts/quality.mjs check
node scripts/quality.mjs build-pages
node node_modules/@playwright/test/cli.js test
node scripts/check-teacherflow-bundle.mjs
git diff --check
```

Expected: all green; Chromium, Firefox and WebKit critical flows pass.

- [ ] **Step 5: Commit**

```powershell
git add .github package.json package-lock.json scripts tests/e2e/teacherflow/production.spec.ts
git commit -m "ci: gate and deploy TeacherFlow from main"
```

### Task 12: Documentation, proof package and release verification

**Files:**
- Modify: `README.md`
- Replace: `TEACHERFLOW.md`
- Create: `docs/teacherflow-decisions.md`
- Create: `docs/teacherflow-explain.md`
- Create: `docs/teacherflow-proof-matrix.md`
- Create: `docs/teacherflow-proof-package.md`
- Create: `docs/reports/2026-08-15-teacherflow-signature-release.md`
- Create: `docs/proof/teacherflow/*.png`

**Interfaces:**
- Produces: oral explanation, decision log, evidence matrix, demo script and A–AE final report.

- [ ] **Step 1: Write the documentation contract**

Add a unit scan requiring each document and mandatory headings: problem, audience, architecture, data, migrations, privacy, offline, IA decision, limits, assisted-development role, tests and production.

- [ ] **Step 2: Write and verify the documents**

Use only measured results. Explain that TeacherFlow is a demonstrator, that data stay on one browser, that shared-device exposure remains possible and that no institutional validation or measured impact is claimed.

- [ ] **Step 3: Capture the proof package**

Capture 3–5 representative production screenshots: Aujourd’hui desktop, Observer mobile, saved decision, Mémoire, offline state. Record URL, final commit, architecture summary, five decisions, exact limits and the 90-second script.

- [ ] **Step 4: Release candidate review**

Review `git diff origin/main...HEAD`, dependency changes, generated assets and every public string. Run the complete gate again from a clean install/build. Fix all P0 and major P1 findings before continuing.

- [ ] **Step 5: Push branch and open PR**

Push `codex/teacherflow-signature-edition`, open a focused PR with design/plan links, measured checks and release risks. Wait for required CI and address failures without bypassing gates.

- [ ] **Step 6: Merge and verify production N**

Merge only when review and CI are green. Wait for Pages. Run `verify-teacherflow-production.mjs`, E2E production smoke, manual mobile/desktop/keyboard/offline checks and save evidence.

- [ ] **Step 7: Verify production N → N+1**

Publish one benign final version marker/documentation-linked UI change through the same green pipeline. From a profile holding N data, detect the waiting update, activate it, confirm N+1 and confirm all IndexedDB data. Remove the visible marker if it has no product value through another green release; retain only truthful version information.

- [ ] **Step 8: Finalize report and stable version**

Fill report sections A–AE, list remaining debt and exactly one next recommendation. Tag the verified stable commit. Update the Notion execution journal with executed actions, proofs, production URL, limits, blockers and next action.

- [ ] **Step 9: Commit documentation**

```powershell
git add README.md TEACHERFLOW.md docs
git commit -m "docs: hand off TeacherFlow Signature Edition"
```

---

## Plan self-review result

- Every section of the Signature design maps to at least one task.
- The route, type, status, workspace and cache names are consistent across tasks.
- No task adds backend, cloud, synchronization, analytics, IA, accounts or student data.
- PWA and persistence responsibilities remain separated.
- The plan contains no deferred implementation placeholder.
- Release claims depend on observed production behavior, never on code presence alone.
