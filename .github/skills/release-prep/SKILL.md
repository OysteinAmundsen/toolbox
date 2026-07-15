---
name: release-prep
description: Prepare a @toolbox-web library for release AND drive release-please versioning. Covers the pre-release checklist (lint, test, build, bundle size, CHANGELOG, docs) PLUS release-please version operations — graduating a prerelease to GA (rc → stable), switching the prerelease identifier (beta → rc), and the per-package path-scoped Release-As bootstrap commits. Use when cutting a release, promoting a prerelease line to stable, or whenever release-please proposes the wrong version (e.g. an rc/patch bump when you expect the clean GA version like 3.0.0).
argument-hint: optional library name
---

# Release Preparation

Run the full pre-release checklist for a @toolbox-web library.

## How to Use This Checklist

The checklist has 10 steps grouped into four phases. Complete each phase fully before starting the next; **do not interleave phases**. Within a phase, run the steps in order.

| Phase                  | Steps | Goal                                              |
| ---------------------- | ----- | ------------------------------------------------- |
| **Quality gates**      | 1     | Lint, test, and build the workspace cleanly.      |
| **Release validation** | 2–4   | Bundle budget, CHANGELOG, breaking-change review. |
| **Documentation**      | 5–7   | Docs updates, docs-site build, demo smoke test.   |
| **Commit hygiene**     | 8     | Final commit polish before merging.               |

## Handling Failures During the Checklist

If any command in steps 1–7 fails (lint error, failing test, type error, build break, bundle over budget, broken docs build, broken demo):

1. **Stop the checklist immediately** — do not move to the next step. The release is not ready.
2. **Diagnose the failure** by reading the actual command output. Do not retry the same command unchanged hoping for a different result.
3. **Fix the underlying cause** in code, tests, or docs (per the standard delivery workflow). For bundle-budget failures, follow the `bundle-check` skill's investigation checklist.
4. **Re-run only the failing command** to confirm it now passes.
5. **Restart the checklist from step 1** so any fix that could have ripple effects (e.g. a code change that affects bundle size, or a doc change that breaks the docs build) is re-validated end-to-end.
6. If the failure is a known intermittent or environmental issue (e.g. flaky test, transient network failure on docs build), document the cause and the rerun outcome in the release PR description rather than silently re-running.

Do not proceed to the **Release Process** section until every checklist step has passed cleanly in a single uninterrupted run.

## Pre-Release Checklist

### 1. Lint, Test & Build All Projects (parallel)

Run all three quality gates across the workspace in a single parallel command. Nx parallelizes the targets, prefixes each output line with its project, and returns one exit code plus an explicit `Failed tasks:` list — so you get the speedup and still collect real per-target results:

```bash
bun nx run-many -t lint test build
```

This covers grid, grid-angular, grid-react, and grid-vue. All targets must pass:

- **Lint** — fix any errors. Do not skip warnings either — either fix them, or **suppress with justification**, which means add a single-line ESLint disable directive on the offending line that includes the rule name **and** a brief reason, e.g. `// eslint-disable-next-line @typescript-eslint/no-explicit-any -- third-party API returns `any``. Bare `eslint-disable`directives without a`--` reason are not acceptable.
- **Test** — all tests must pass across grid, grid-angular, grid-react, and grid-vue.
- **Build** — verify clean builds with no TypeScript errors. The build target hard-enforces the bundle budget (see step 2).

> Do **not** pipe this command through `| tail`/`| head`/`2>&1` on this machine — it hangs the terminal. Let the tool capture output, then read the captured file if the output is large.

### 2. Check Bundle Size Budget

Step 1's build already hard-enforces the budget via the Vite `bundleBudget` plugin (build fails if `dist/libs/grid/index.js` exceeds 170 kB raw or 50 kB gzipped). To read the exact raw/gzip sizes for every entry deterministically, run the shared report script:

```bash
bun run tools/build-size-report.ts
```

Confirm the **core (index.js)** `grid` cell is within budget (≤ 170 kB raw, ≤ 50 kB gzipped; soft warning at 45 kB gzipped). For a soft-warning or over-budget result, follow the `bundle-check` skill's investigation checklist.

### 3. Review CHANGELOG

Check `libs/grid/CHANGELOG.md` (and other library CHANGELOGs):

- New features documented with clear descriptions
- Bug fixes listed with issue references where available
- Breaking changes clearly marked with migration guides
- Entries follow Conventional Commits format

### 4. Check for Breaking Changes

Review all changes since last release:

```bash
git --no-pager log --oneline $(git describe --tags --abbrev=0)..HEAD
```

**What constitutes a breaking change:**

- Removed/renamed exports from `public.ts`
- Changed method signatures (added required params, changed return types)
- Removed/renamed public properties/methods on `<tbw-grid>`
- Removed/renamed CSS custom properties
- Changed event names or payload structures
- Removed/renamed plugin hook methods in `BaseGridPlugin`
- Changed the `disconnectSignal` contract (plugins depend on it for cleanup)

**What is NOT a breaking change:**

- Adding new optional properties, methods, or events
- Internal refactoring that doesn't affect public API
- Bug fixes (even if they change incorrect behavior)
- Adding new exports to `public.ts`
- Performance improvements
- New plugins or plugin features

**If breaking changes exist:**

1. Document in CHANGELOG with migration guide
2. Ensure major version bump
3. Consider deprecation warnings before removal

### 5. Update Documentation

Check if these files need updates:

| File                                       | Update When                                   |
| ------------------------------------------ | --------------------------------------------- |
| `libs/grid/README.md`                      | New features, API changes                     |
| Plugin READMEs                             | Plugin changes                                |
| `apps/docs/src/content/docs/grid/**/*.mdx` | Theming, API, getting started changes         |
| `llms.txt`                                 | Public API, plugins, events, CSS vars changed |
| `llms-full.txt`                            | Full AI guide needs updating                  |
| `.github/copilot-instructions.md`          | Workflow or conventions changed               |

### 6. Verify Docs Site Builds

```bash
bun nx build docs
```

Docs site must build without errors.

### 7. Test Demo Applications

```bash
bun nx serve demo-vanilla
bun nx serve demo-angular
bun nx serve demo-react
```

Manually verify demos work with the latest changes.

### 8. Final Commit Hygiene

- All commits follow Conventional Commits format: `type(scope): description`
- No WIP commits in the release branch
- Squash or rebase if needed for clean history

## Release Process

This project uses `release-please` for automated releases:

- Configuration in `release-please-config.json`
- Merging to main triggers release PR generation
- Approving the release PR publishes to npm

### Switching the prerelease identifier (e.g. `beta` → `rc`) for a new major

Changing `prerelease-type` in `release-please-config.json` does **NOT** relabel an
in-progress prerelease line — while already on `X.Y.Z-beta.N` release-please only
increments the existing identifier (`beta.4` → `beta.5`), ignoring the new type.
To jump the identifier (or seed a fresh major's prerelease), push a **one-time,
per-package, path-scoped** `Release-As` commit — attribution is by the **file
paths the commit changes**, not the commit scope:

```bash
# grid → 3.0.0-rc.0 (commit must touch a file under libs/grid/**)
printf '\n' >> libs/grid/CHANGELOG.md
git add libs/grid/CHANGELOG.md
git commit -m "chore(grid): bootstrap rc line" -m "Release-As: 3.0.0-rc.0"

# adapters → 2.0.0-rc.0 (SEPARATE commit: one Release-As is written to EVERY
# package the commit touches; a path-less/empty commit hits all 4 packages)
printf '\n' >> libs/grid-angular/CHANGELOG.md
printf '\n' >> libs/grid-react/CHANGELOG.md
printf '\n' >> libs/grid-vue/CHANGELOG.md
git add libs/grid-angular/CHANGELOG.md libs/grid-react/CHANGELOG.md libs/grid-vue/CHANGELOG.md
git commit -m "chore(adapters): bootstrap rc line" -m "Release-As: 2.0.0-rc.0"
```

After the bootstrap tag exists, release-please auto-increments the new identifier
(`rc.1`, `rc.2`…) — no further `Release-As` needed. **Verify the regenerated PR
bumps only the intended packages before merging.** Full rationale + the trap that
once forced adapters to `3.0.0-rc.0`: `.github/knowledge/build-and-deploy.md`
(release section).

### Graduating a prerelease to the stable (GA) release

Same bootstrap applies when promoting `X.Y.Z-rc.N` → `X.Y.Z`. Flipping the config
alone does **not** deterministically land the clean GA version: the last tag is a
prerelease, so any pending `feat`/`fix` in range makes release-please carry the
`rc` identifier forward and bump within it — e.g. it proposed `3.0.1-rc.1` instead
of `3.0.0`. Do both:

1. In `release-please-config.json` on `main`: set the branch `"prerelease": false`
   (or drop `prerelease`/`prerelease-type`) and remove `"versioning": "prerelease"`,
   `"prerelease": true`, `"prerelease-type"` from each package.
2. Push per-package, path-scoped `Release-As` commits (verified recipe — grid to
   `3.0.0`, adapters to `2.0.0`; separate commits because one `Release-As` value is
   written to EVERY package the commit touches, so a path-less/empty commit would
   force all four to the same version):

   ```bash
   # grid → 3.0.0 (commit MUST touch a file under libs/grid/**)
   printf '\n' >> libs/grid/CHANGELOG.md
   git add libs/grid/CHANGELOG.md
   git commit -m "chore(grid): graduate to stable 3.0.0" -m "Release-As: 3.0.0"

   # adapters → 2.0.0 (SEPARATE commit touching all three adapter dirs)
   printf '\n' >> libs/grid-angular/CHANGELOG.md
   printf '\n' >> libs/grid-react/CHANGELOG.md
   printf '\n' >> libs/grid-vue/CHANGELOG.md
   git add libs/grid-angular/CHANGELOG.md libs/grid-react/CHANGELOG.md libs/grid-vue/CHANGELOG.md
   git commit -m "chore(adapters): graduate to stable 2.0.0" -m "Release-As: 2.0.0"
   ```

   The trailing-newline on each package's `CHANGELOG.md` is a harmless routing
   anchor (release-please prepends its section, so it never conflicts). After the
   `3.0.0`/`2.0.0` tags exist, release-please resumes normal semver (`feat`→minor,
   `fix`→patch) — no more `Release-As`. **Verify the regenerated release PR bumps
   grid to exactly `3.0.0` and the adapters to `2.0.0` (and nothing else) before
   merging.**

Also flip the GA-only docs-deploy items in the **same** window so `main` stable
releases publish toolboxjs.com docs: the `ci.yml` `build-docs`/`deploy-pages` gate
+ the `github-pages` environment branch policy (`2.x` → `main`). **No npm dist-tag /
LTS move is needed** — this project does not maintain an LTS line on previous
majors: once GA publishes (version has no `-`) it auto-takes the `latest` dist-tag,
and the old major simply stops receiving releases. Details:
`.github/knowledge/build-and-deploy.md` (release section).

## Post-Release

- Verify npm packages published correctly
- Check that GitHub release notes are accurate
- Update any external documentation or announcements
