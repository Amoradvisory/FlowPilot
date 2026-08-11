# TeacherFlow Public Demo Implementation Plan

> **For Codex:** Execute this plan task by task on `teacherflow-demo`. Preserve the frozen CV repositories and never reuse the corrected-away ICET claim.

**Goal:** Turn `/teacher` into a credible, interactive, publicly accessible decision-maker proof while preserving the existing FlowPilot application.

**Architecture:** A route-specific shell bypasses FlowPilot authentication and navigation. A pure TypeScript domain module owns observation validation, improvement derivation, and defensive persistence; the Svelte page renders the public narrative and local-only interaction. GitHub Actions builds the static SvelteKit app with a project base path and deploys it to Pages.

**Tech Stack:** SvelteKit 2, Svelte 5 runes, TypeScript, Tailwind CSS 4, Node test runner, GitHub Actions, GitHub Pages.

---

### Task 1: Protect the observation behavior with failing tests

**Files:**

- Create: `src/lib/teacherflow-demo.test.ts`
- Create: `src/lib/teacherflow-demo.ts`

**Steps:**

1. Write Node tests for whitespace rejection, normalization, improvement derivation, malformed persisted data, and bounded history.
2. Run `node --test src/lib/teacherflow-demo.test.ts` and confirm failure because the production module does not exist.
3. Implement the smallest pure TypeScript module that satisfies the contracts.
4. Re-run the test and confirm it passes.

### Task 2: Give `/teacher` an autonomous public shell

**Files:**

- Modify: `src/routes/+layout.svelte`

**Steps:**

1. Detect the `/teacher` route from `$app/state`.
2. Render the route children directly for TeacherFlow, before auth or FlowPilot initialization UI.
3. Prevent FlowPilot initialization, keyboard shortcuts and teardown from running for the public route.
4. Run `svelte-check` and confirm the existing reactivity warning is gone after Task 3.

### Task 3: Build the interactive decision-maker demonstration

**Files:**

- Replace: `src/routes/teacher/+page.svelte`

**Steps:**

1. Implement the dedicated TeacherFlow header, hero, five-step loop and « Aujourd’hui » cockpit with fictional data.
2. Connect the capture form to the tested domain module and browser-only persistence.
3. Show saved observations and derived improvement actions; add a reset control.
4. Add the case-study narrative, proof boundaries and controlled-IA explanation.
5. Add metadata, semantic landmarks, focus styles, responsive layouts and reduced-motion handling.
6. Run `svelte-check`, the domain tests and a production build.

### Task 4: Turn repository documentation into a decision asset

**Files:**

- Modify: `README.md`
- Modify: `TEACHERFLOW.md`

**Steps:**

1. Put TeacherFlow and its demo URL near the top of the README while retaining FlowPilot’s origin.
2. Expand `TEACHERFLOW.md` into a concise case study: problem, users, constraints, design decisions, reuse, data flow, role of IA, limits, proof and next experiment.
3. Check only changed documentation with Prettier where applicable.

### Task 5: Publish through GitHub Pages

**Files:**

- Modify: `svelte.config.js`
- Create: `.github/workflows/deploy-teacherflow-pages.yml`

**Steps:**

1. Read `BASE_PATH` in SvelteKit config while preserving the empty default used by Vercel and local development.
2. Add a Pages workflow triggered by `teacherflow-demo` and manual dispatch.
3. Build with `BASE_PATH=/FlowPilot`, copy the SPA fallback to `404.html`, upload and deploy the artifact.
4. Validate the YAML and locally build with the same base path.

### Task 6: Verify, publish and update the existing PR

**Files:**

- Verify all modified files.

**Steps:**

1. Run the focused tests, `svelte-check`, changed-file formatting checks and both default/base-path production builds.
2. Launch a local server and verify the complete user story at desktop and 375 px, including reset and browser persistence.
3. Commit intentionally and update `teacherflow-demo` / PR #1.
4. Enable GitHub Pages with GitHub Actions if the repository setting is not already active.
5. Wait for CI/deployment, verify the unauthenticated public URL and update the PR body with the live proof and test evidence.

### Task 7: Record strategic progress outside the code

**Files:**

- Notion Mission 03, INTEL GitHub, Journal de bord, TeacherFlow proof page, portfolio/Second Brain pages as warranted by verified results.

**Steps:**

1. Record the LinkedIn correction check and the role replacement actually saved.
2. Record commit, PR, public URL, tests, screenshots and the Vercel protection blocker.
3. Update INTEL with the repo/branch/PR/deployment facts and remove any reuse of the inaccurate ICET sentence.
4. Advance PiloteCours and the Second Brain only where a clean, data-safe public asset can be verified in this mission.
5. State the next highest-leverage action with a named owner or blocking dependency.
