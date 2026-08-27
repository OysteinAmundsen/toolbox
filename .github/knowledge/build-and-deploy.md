---
domain: build-and-deploy
related: [build-css, release-versioning, docs-agent-endpoints, grid-core]
---

# Build, CI & Tooling — Mental Model

> Release/versioning → release-versioning.md. Agent doc endpoints (llms.txt) → docs-agent-endpoints.md. CSS/theming → build-css.md.

## vite build ([libs/grid/vite.config.ts](libs/grid/vite.config.ts))

- OWNS: ES + UMD outputs (core + all-in-one), per-plugin builds, per-feature builds, theme distribution, `__GRID_VERSION__` injection.
- INPUT: `src/index.ts`, `src/all.ts`, `src/lib/plugins/*/index.ts` (auto-discovered), `src/lib/features/*.ts` (auto-discovered), `libs/themes/*.css`.
- OUTPUT: `dist/libs/grid/` → `index.js`, `all.js`, `lib/plugins/*/index.js`, `lib/features/*.js`, `umd/*.umd.js`, `themes/*.css`.
- INVARIANT: plugin scan auto-discovers from `src/lib/plugins/` (excludes `all/`, `shared/`).
- INVARIANT: plugins externalize core imports (`@toolbox-web/grid`) to prevent duplication.
- INVARIANT: UMD global naming `"pinned-rows"` → `TbwGridPlugin_pinnedRows`.
- DECIDED: parallel plugin/feature builds in the `writeBundle` hook with pre-created directories (race avoidance); ES only for plugins (no CJS); each entry self-contained (`manualChunks: undefined`); all comments stripped.
- DECIDED: terser inlines constant property accesses (`GridClasses.CELL_FOCUS` → `"cell-focus"`) — using `constants.ts` has ZERO bundle overhead vs raw strings.
- TENSION: bundle duplication vs shared chunks — larger total, simpler per-import.

## bundle budget ([tools/vite-bundle-budget.ts](tools/vite-bundle-budget.ts))

- RUNS IN: Vite `closeBundle` (after all sub-builds). Raw + gzip via zlib.
- BUDGETS: core `index.js` ≤170 kB raw / ≤50 kB gz hard fail, ≤45 kB gz soft warn; plugins ≤50 kB each (**editing 55 kB** — the `commitCellValue` surface); adapters react ≤50 kB, vue ≤50 kB; grid-angular fesm ≤276 kB (`libs/grid-angular/project.json` `bundle-check`).
- INVARIANT: `warnSize`/`warnGzip` never fail the build; `maxSize`/`maxGzip` fail with exit 1 under `severity: 'error'`.
- POLICY: design target 45 kB gz, hard ceiling 50 kB. Any new code pushing core toward 50 kB MUST first try a plugin extraction — land in core only if a plugin would damage performance (hot path, render scheduler, virtualization).
- CURRENT (#370 v3 landed): `index.js` **145.11 kB raw / 42.46 kB gz**; shell chunk 40.72 kB / 10.99 gz. (Pre-extraction baseline was 172.46 kB / 49.25 kB gz — the shell cut reclaimed ~27 kB raw / 6.7 kB gz. All `TEMP-BUDGET-370` thresholds reverted.)
- DECIDED (#259): `forbiddenSymbols` option (`{ path, symbols: string[], reason? }`) fails the build if any listed substring appears in the matched file — used to assert the shell controller tree-shakes OUT of core `index.js`. Signal choice is subtle: use public ShellPlugin METHOD names `openToolPanel`/`registerHeaderContent`/`unregisterHeaderContent` (terser preserves property names with `mangle.properties` off). RULED OUT: `tbw-shell-header` (core `dom-builder.ts` always emits that placeholder → false positive), `ShellController`/`ShellPlugin` class names (mangled away in both chunks), `getToolPanels` (substring leaks into core). This build-time assertion replaces a unit test.

## ci pipeline ([.github/workflows/ci.yml](.github/workflows/ci.yml))

- FLOW: setup (detect release merge) → validation (lint + test + build + bench, parallel) → e2e (build all → start 4 demo servers with `USE_DIST=true` → Playwright) → release-please → build-docs → deploy-pages.
- INVARIANT: e2e runs against `dist/` (validates release packaging).
- INVARIANT: release-please merge commits skip validation (already passed on the feature branch).
- INVARIANT: the `bench` job is parallel to `test`/`build`/`e2e`, gated only on `setup`, and is **NOT** in `release-please.needs` — bench is informational and must never block a release merge.
- INVARIANT (e2e diagnosability): a failing Playwright task MUST print to stdout. Three things conspire to hide it: Nx buffers task output into a collapsed `##[group]` (→ `bun run e2e` passes `--output-style=stream`); `e2e/reporters/github-summary-reporter.ts` writes only to `$GITHUB_STEP_SUMMARY` (→ both configs keep `['list']` + `['github']` in the CI reporter array); and the `playwright-report` artifact used to upload only the root `playwright-report/` (→ it now also uploads `apps/docs-e2e/playwright-report/` and both `test-results/`). Removing any one of these makes a `docs-e2e` failure undiagnosable — CI reports only "exited with non-zero status code". `.github/skills/run-e2e/SKILL.md` → "Diagnosing a CI failure" has the retrieval recipe.
- INVARIANT: `USE_DIST=true` affects only the **demo** apps (`demos/shared/resolve-aliases.ts`). `apps/docs` picks source-vs-dist from `isProductionBuild` in its own `gridAliases()`, and `docs-e2e` runs `astro dev` → docs-e2e always tests **source**, never `dist/`.

## bench regression ([tools/compare-benches.ts](tools/compare-benches.ts), [tools/merge-bench-runs.ts](tools/merge-bench-runs.ts))

Compares Vitest `bench()` output (`hz`, `mean`, `moe`, `rme`) of PR head against the **last released commit on `main`** (most recent reachable tag), both measured on the **same runner in a single job**. Comparison window = full release cycle, so regressions accumulate visibly instead of being absorbed. Push to main: artifact only, no comparison.

- INVARIANT: PR job scoped via `nx affected --with-target=bench`; docs/chore PRs exit early with `## Bench: skipped`. Primary wall-time lever.
- INVARIANT (`sharedGlobals` workaround): when ONLY `sharedGlobals` files (`ci.yml`) change, `nx affected --with-target=bench` returns the adapters but NOT `grid`. CI force-includes `grid` whenever any adapter is affected (case statement in the bench step). RULED OUT: filing upstream.
- INVARIANT: baseline via `git worktree add ../base $LAST_TAG_SHA` (`git describe --tags --abbrev=0 origin/main` → `git rev-list -n 1`; fallback `origin/main`). Baseline measured FIRST (warm-up paid before head). Each side measured `BENCH_ITERATIONS` times (currently **1**), merged with **max-of-N on `hz`** (Netflix TVUI methodology — shared-runner outliers are always slower). The affected list is computed once in the PR-head checkout and reused for the baseline loop.
- INVARIANT: `merge-bench-runs.ts` returns the winning run **as a unit** (`mean`/`moe`/`rme`/`hz` from the same measured run) so the `mean ± moe` interval is a real distribution. RULED OUT: `mean = 1000/winner.hz` (hz is sample-derived); `min(moeA, moeB)` (artificially tightens the band). Only normalization: fall back to `mean * rme/100` when `moe` is absent.
- INVARIANT: regression flagged only if `current.hz < baseline.hz * (1 - threshold)` AND `current.mean ± moe` does NOT overlap `baseline.mean ± moe` (default ±25 %, CI runs `--threshold 0.30`). Regression and improvement need SEPARATE disjointness checks (`currentHzHigh < baselineHzLow` vs `currentHzLow > baselineHzHigh`) — one shared flag biases a direction.
- INVARIANT: one-sided benches report `🆕 new` / `🗑️ removed`, never a non-zero exit. Missing baseline file → exit 0.
- INVARIANT: Vitest bench JSON `mean` (ms) and `hz` (ops/s) are NOT exact reciprocals; bounds derived consistently as `1/(mean ± moe)` on both sides.
- INVARIANT: Vitest resolves `--outputJson=<path>` relative to the **config's project root**, NOT shell cwd — CI passes anchored `$PWD/tmp/...`.
- INVARIANT: [.github/skills/bench/bench-vs-tag.ts](.github/skills/bench/bench-vs-tag.ts) long-running children MUST spawn via `node:child_process.spawn` (the `shAsync` helper), NOT `Bun.spawn`/`Bun.spawnSync` — Bun-spawning-Bun on Windows kills the child mid-run with exit 58 (Bun 1.3.12, all stdio modes). Sync `sh()` is fine for short git commands. Success signal for `vitest bench` is `existsSync(outputJson)`, NOT the exit code (Vitest 4.x worker teardown flakes it).
- INVARIANT: baseline + current MUST run SEQUENTIALLY on the same runner. RULED OUT: `Promise.all`/`concurrently` (asymmetric variance inflation). Cross-runner matrix parallelism is fine.
- DECIDED: soft-warn mode — the script computes regressions but CI omits `--fail-on-regression`.
- DECIDED: bench coverage = `grid` + `grid-react` + `grid-vue` (each has its own Nx `bench` target); `grid-angular` excluded (directive-based, no pure-function hot path). `merge-bench-runs.ts` keys on `group.fullName` (includes file path → no cross-project collisions). Bench files MUST be co-located with the code they test, and MUST be in `exclude` in every adapter `tsconfig.lib.json` (`"src/**/*.bench.ts"`) or `tsc -p tsconfig.lib.json` + typedoc trip on fixtures.
- RULED OUT: cached cross-runner baselines (±30–60 % flips); Netflix-style anomaly/changepoint detection over N=40 history (needs persistent storage); shrinking per-bench `time`/`warmupTime`.

## grid-angular ng-packagr (Bun dual-package hazard)

- INVARIANT: feature secondary entry points (`libs/grid-angular/features/*/src/index.ts`) MUST NOT `import type { TemplateRef } from '@angular/core'` directly when calling `adapter.createTrackedEmbeddedView(...)`. Use the type inferred from the helper (`getDetailTemplate`, `getResponsiveCardTemplate`) which comes from `@toolbox-web/grid-angular`.
- TENSION: under Bun, `@angular/core` resolves twice during secondary entry-point builds — `node_modules/.bun/@angular+core@<hash>/` (local imports) vs `node_modules/@angular/core/` (what the built adapter `.d.ts` references). The two `TemplateRef`s differ only by the private `_declarationLView` brand → `Types have separate declarations of a private property`.
- DECIDED (May 2026): do NOT use `as unknown as TemplateRef<...>` in feature bridges — it hides the mismatch in one direction and breaks on the next `.d.ts` rebuild. Files: `features/master-detail/src/index.ts`, `features/responsive/src/index.ts`. The cast is still acceptable inside the main adapter (`angular-grid-adapter.ts`) where both endpoints resolve through the same package instance.
- DECIDED (Jul 2026, `link-grid-dist` must repoint BOTH node_modules): adapters declare `@toolbox-web/grid` as a VERSIONED dep, so `bun install` drops the published (stale) grid into `libs/grid-*/node_modules/@toolbox-web/grid`, which SHADOWS the workspace-root symlink because **ng-packagr uses Node module resolution**. [link-grid-dist.ts](tools/link-grid-dist.ts) junction-links BOTH root AND adapter-local paths → `dist/libs/grid`. SYMPTOM if only root is linked: `TS2305: '@toolbox-web/grid/plugins/*' has no exported member '<NewType>'` for any API added since the last publish. RULED OUT as red herrings: stale `dist/`, Nx cache (`nx reset` clears neither `dist/` nor `node_modules/.vite`), vite-plugin-dts emit. NOTE: a passing React/Vue **build** is NOT proof a grid type resolves — esbuild strips types without checking; only ngc + the explicit `typecheck` targets (see "Typecheck coverage matrix" below) really type-check.
- DECIDED (Aug 2026 audit M3): the script is SHARED and parameterized — `bun run tools/link-grid-dist.ts <adapter-dir>`, with a `link-grid-dist` target on all three of `grid-angular`, `grid-react`, `grid-vue` (each `dependsOn` `grid:build`; `typecheck`/`build` depend on it). WHY React/Vue too even though Vite honours tsconfig `paths`: the stale copy still misleads every Node-resolution-based tool (fallow, ESLint resolvers, IDE go-to-definition). The old `libs/grid-angular/scripts/link-grid-dist.ts` is deleted.
- INVARIANT: `linkToDist()` MUST stay idempotent and retry on `EEXIST`/`ENOTEMPTY`/`ENOENT`/`EPERM`. All three adapters write the SAME workspace-root `node_modules/@toolbox-web/grid`, and Nx runs their `link-grid-dist` targets in PARALLEL — the old check→`rmSync`→`symlinkSync` sequence let a peer win in between (CI-only `EEXIST`, run 31183787525). Never remove an entry that already resolves to `dist/libs/grid`: another adapter may be resolving through it.

## nx config (nx.json)

- Plugins: `@nx/js/typescript`, `@nx/vite/plugin`, `@nx/vitest`, `@nx/eslint/plugin`, `@nx/playwright/plugin`.
- Named inputs: `production` excludes test + `.bench.ts` files; `sharedGlobals` = `ci.yml`, `tsconfig.base.json`, `vitest.config.ts`, `bun.lock`.
- TENSION: `ci.yml` in `sharedGlobals` means any CI change invalidates all caches.
- DECIDED (Jul 2026): `targetDefaults` sets `cache: true` + `inputs` for `build` / `typecheck` / `test`; `bench` is `cache: false` (timings must be re-measured). WHY: `libs/*/project.json` hand-declares these targets with an explicit `executor`, which SHADOWS the inferred `@nx/vite/plugin` / `@nx/vitest` targets and silently drops the plugins' built-in `cache: true`. Symptom was zero cache hits on test/build while lint (inferred, not shadowed) cached fine. Measured: build 92s→13s, test 73s→9s, lint 24s→4s.
- INVARIANT: a hand-written target in `project.json` inherits NOTHING from the matching inferred plugin target. If you add one, set `cache`/`inputs` explicitly or add a `targetDefaults` entry.
- INVARIANT: any `tsc`/`vue-tsc` target that resolves `@toolbox-web/grid*` (paths → `dist/`) MUST declare `dependsOn: [{ projects: ["grid"], target: "build" }]` itself. Listing both `typecheck` and `grid:build` under `build.dependsOn` is NOT enough — Nx runs `dependsOn` entries in PARALLEL, so `<adapter>:typecheck` can start before `grid:build` emitted `.d.ts`. SYMPTOM: 100+ `TS2307: Cannot find module '@toolbox-web/grid/...'` plus cascading `TS7006` / `TS4112` / `TS2339` noise. Fixed Jul 2026 in `libs/grid-react/project.json`.
- GOTCHA: CLI flags are part of the task hash, so `bun run test` (`--silent`) and a bare `nx test <proj>` keep SEPARATE cache entries. Alternating between the two looks like cache instability; it is not.
- DECIDED (Aug 2026): root `test` script pins `--parallel=2`. At Nx's default 3, each concurrent project spins up its own vitest fork pool and Windows spawn latency trips `[vitest-pool]: Failed to start forks worker … Timeout waiting for worker to respond`. SYMPTOM is deceptive: every reported test file passes, but the FILE COUNT is short (grid-vue 27/33, grid-react 29/37) and Nx exits non-zero with those projects in `Failed tasks:`. Diagnose by comparing the per-project file count against a solo `nx test <proj>` run before assuming a real regression.
- INVARIANT: root `package.json` MUST keep `typescript-eslint` in devDependencies. `@nx/eslint-plugin/dist/src/flat-configs/{typescript,javascript}.js` do `require("typescript-eslint")` but declare it in NEITHER `dependencies` NOR `peerDependencies`, and root `eslint.config.mjs` spreads `nx.configs['flat/typescript'] + ['flat/javascript']`. Removing it makes `@nx/eslint/plugin` `createNodes` throw → `NX Failed to process project graph` in EVERY Nx command. Aug 2026: this passed locally (stale `node_modules/typescript-eslint` survives `bun install`'s prune) and broke all three CI jobs on a fresh install — run 31181502277.
- INVARIANT (dep-pruning): before deleting a devDependency, verify against a FRESH install, not local `node_modules`. `bun install` does not reliably prune removed packages, so `require.resolve` keeps succeeding locally. Check `grep -o '"<pkg>"' bun.lock` (absent = CI won't have it) and grep `node_modules/@nx/**` for undeclared `require("<pkg>")`.
- TODO: `@nx/vite:build` executor is deprecated (removed in Nx v24) while `@nx/vite/plugin` is already registered. Migrate with `nx g @nx/vite:convert-to-inferred` — needs re-verification of the custom `vite.config.ts` plugin chain + bundle-budget plugin.
- INVARIANT (Astro 7 dev daemon): every `astro dev` invocation MUST clear `GIT_PAGER`. Astro 7 calls `am-i-vibing`, whose `vscode-copilot-agent` rule matches `TERM_PROGRAM=vscode` **and** `GIT_PAGER=cat` — both set by EVERY VS Code integrated terminal, agent or not. On a match it forks a daemon, prints a JSON `"Dev server running at …"` line, and exits 0, so `bun start` / `nx serve docs` looks successful but leaves nothing in the foreground (and a stray process holding the port). `--background` is opt-IN only; there is no `--no-background`, and `ASTRO_DEV_BACKGROUND` is astro's internal child marker. Fix applied Aug 2026 in `apps/docs/project.json` (`serve.options.env.GIT_PAGER: ""`), `apps/docs-e2e/project.json`, and `apps/docs-e2e/playwright.config.ts` (`webServer.env`). `playwright.promo.config.ts` sidesteps it by using `astro preview`.

## Typecheck coverage matrix

| Project        | `typecheck` target | Compiler                           | Why                                                                  |
| -------------- | ------------------ | ---------------------------------- | -------------------------------------------------------------------- |
| `grid`         | ✅                 | `tsc --noEmit`                     | `@nx/vite:build` (esbuild) strips types WITHOUT checking             |
| `grid-react`   | ✅                 | `tsc --noEmit`                     | same                                                                 |
| `grid-vue`     | ✅                 | `vue-tsc --noEmit`                 | same; plain `tsc` cannot parse the 9 `.vue` SFCs in `src/lib/`       |
| `grid-angular` | ❌ by design       | ngc (inside `@nx/angular:package`) | ng-packagr type-checks during build → a separate target is redundant |

- DECIDED (Jul 2026): added `grid-vue:typecheck` via `vue-tsc` (devDep `vue-tsc@3`, TS 6.0.3) + wired `"typecheck"` into `grid-vue:build.dependsOn`. WHY: `grid-vue` was the only vite-built lib with zero type checking — errors surfaced only via vitest or the editor. Passed clean on first run.
- INVARIANT: `libs/grid-vue/tsconfig.lib.json` MUST keep `"src/**/*.vue"` in `include` or `vue-tsc` silently checks nothing but the `.ts` files.

## tsconfig paths (tsconfig.base.json)

- All map to `dist/` (built artifacts) for CI type checking: `@toolbox-web/grid` → `dist/libs/grid/index.d.ts`; `@toolbox-web/grid/plugins/*` → `dist/libs/grid/lib/plugins/*/index.d.ts`; `@toolbox-web/grid/features/*` → `dist/libs/grid/lib/features/*.d.ts`; `@toolbox/themes/*` → `libs/themes/*` (source).
- INVARIANT: `compilerOptions.paths` does **NOT merge** across `extends` — a child tsconfig declaring its own `paths` fully REPLACES the parent's. Same for `types` and `lib`.
- DECIDED: a child overriding one mapping (e.g. `tsconfig.typedoc.json` pointing `@toolbox-web/grid-angular` at source) MUST repeat every `@toolbox-web/grid*` parent mapping it still needs, using wildcards for compactness. Detection signal: a burst of `TS2307: Cannot find module '@toolbox-web/...'` from a child config with its own `paths` block → suspect path shadowing first.

## dependency clusters ([.ncurc.cjs](.ncurc.cjs))

Keeps `npm-check-updates` from proposing breaking upgrades. Default `target: latest`; cluster-anchored packages forced to `minor`; Nx + Angular toolchain `reject`ed (owned by `nx migrate`).

| Cluster            | Members / anchor                                                                                             | Gate                                                   |
| ------------------ | ------------------------------------------------------------------------------------------------------------ | ------------------------------------------------------ |
| Nx                 | `nx` == every `@nx/*` (byte-identical)                                                                       | rejected — only via `nx migrate latest`                |
| Angular            | `@angular/*` pinned 21.2.x via root `overrides`; `@angular-devkit/build-angular` + `ng-packagr` match major  | rejected — `@nx/angular` 22.7.x supports Ng 20–21 only |
| TypeScript ceiling | `typescript` capped `<6`                                                                                     | Angular 21 + typescript-eslint 8                       |
| ESLint             | `eslint` + `@eslint/js` held at 9                                                                            | typescript-eslint 8 / `@nx/eslint` lack ESLint 10      |
| Vite/Vitest        | `vite`, `vite-plugin-dts`, `@vitejs/plugin-react`, `@vitejs/plugin-vue`, `vitest`, `@vitest/*` (== `vitest`) | `@nx/vite` 22.7.x → Vite 7                             |
| Astro/Starlight    | `astro`, `@astrojs/mdx`, `@astrojs/starlight`, `@astrojs/cloudflare`, `astro-mermaid`                        | Starlight gates the safe Astro major                   |
| Vue                | `vue` + `vue-router` (demo-only)                                                                             | —                                                      |

- FREE (majors OK): `concurrently`, `jsdom`, `jsonc-eslint-parser`, `wait-on`, `happy-dom`, `mermaid`, `pagefind`, `@types/node`, `typedoc*`.
- HARDENING: `majorLocked` entries ending in `/` (`@astrojs/`, `@vitejs/`, `@vitest/`) match by PREFIX via `isMajorLocked()` so new family members auto-lock.
- FLOW: `bun run update` → [tools/update-deps.ts](tools/update-deps.ts) sequences `nx migrate latest` + run-migrations → `bunx npm-check-updates -u` (**no `--target` flag** — a CLI flag would override `.ncurc.cjs`) → `bun install` → verify lint/test/build. `bun run update:dry` reports only; `bun run update:full` adds both e2e suites (`e2e:full` + `nx e2e docs-e2e`, the only suite exercising the Astro/Starlight cluster). Never auto-commits; prints a rollback SHA on failure.

## workspace tooling (`tools/`)

- All root-level workspace dev scripts live in `tools/` (root `scripts/` was merged in Jun 2026). Per-project `scripts/` folders (`libs/grid/scripts/typedoc-to-mdx.ts`, `libs/grid-angular/scripts/typedoc-to-mdx.ts`) stay project-scoped — do NOT hoist them. `link-grid-dist.ts` moved the other way (project → `tools/`) once all three adapters needed it.
- ESLint covers `**/scripts/*.ts` + `tools/**/*.ts` with `@nx/enforce-module-boundaries` off. Neither folder is in any tsconfig — they run via Bun (types stripped), so `tsc`/editor does not typecheck them.
- DECIDED (Jun 2026, `watch-libs.ts` rewrite): spawn via `node:child_process` (the old `Bun.spawnSync(['bun','run','build:libs'])` died with exit 58 on Windows — same INVARIANT as bench); map changed dir → single Nx project (`libs/themes` → `grid`) and run `nx build <project>` with cache ON; a `pending` Set re-flush loop drains mid-build edits; yalc-push only the rebuilt project.
- DECIDED (Jun 2026): `bench-vs-tag.ts` lives in `.github/skills/bench/` (backs the `bench` skill), while `tools/merge-bench-runs.ts` + `tools/compare-benches.ts` stay in `tools/` because CI calls them directly. `ROOT = resolve(import.meta.dirname,'..','..','..')`. The `package.json` `bench:vs-tag` alias was REMOVED — the raw path `bun .github/skills/bench/bench-vs-tag.ts` is the contract.
- fallow (`bunx fallow`, not a repo dep) is configured in `.fallowrc.json`. Published **subpath entry points** MUST be listed under `entry` or every adapter feature hook reads as a dead file: `libs/grid-{react,vue}/src/features/*.ts`, `libs/grid-angular/src/lib/{directives,interfaces}/index.ts` — fallow reads neither the package `exports` map nor `vite.config.mts` `build.lib.entry`. `ignorePatterns` carries `libs/themes/**` (pure CSS, no package.json) and `libs/*/node_modules/**` (nested installs of our own packages double-count every symbol); `ignoreDependencies` carries `lightningcss` (build-only, `libs/grid/vite.config.ts`). Its "unused class member" hits are mostly public plugin API or #370 duck-typed seams — triage, don't delete.

## demos layout

- All four frameworks use the route-based shell under `demos/<framework>/`; each shell bootstraps an idiomatic router and registers one lazy route per demo. Demos live at `src/demos/<demo-name>/`.
- INVARIANT: per-demo data/types/styles live in `demos/shared/<demo-name>/` so every framework imports identical fixtures via `@demo/shared/<demo-name>` — required for cross-framework parity tests in `e2e/`.
- INVARIANT: [demos/shared/resolve-aliases.ts](demos/shared/resolve-aliases.ts) enumerates demo names in a `demoNames` array; adding a demo = appending one string. The Angular esbuild plugin (`demos/angular/tools/esbuild-alias-plugin.mjs`) duplicates this logic (Angular bypasses Vite) — keep them in sync.
- INVARIANT: every shell loads routes lazily (`import()` for vanilla/Vue, `lazy()` for React, `loadComponent` for Angular).
- INVARIANT: `/` renders a demo index listing every registered route (unknown paths too) and returns 200, so CI `wait-on http://localhost:<port>` keeps working. E2E targets `localhost:<port>/employee-management` via `e2e/tests/utils.ts:DEMOS`.
- INVARIANT: the docs site imports the pure grid factory via `@demo/vanilla/<demo-name>` (→ `demos/vanilla/src/demos/<demo-name>/grid-factory.ts`), NOT the route module — keep factory (`createEmployeeGrid()`) separate from the route module's mount/teardown + control panel. React/Vue/Angular need no factory (docs does not import their adapters).
- Routers: vanilla = hand-rolled `shell/router.ts` (~50 LOC, pathname-based); React = `react-router-dom` v7; Vue = `vue-router` v4 (`createWebHistory()`); Angular = `provideRouter()` + `loadComponent`. DECIDED: framework demos double as reference setups so they use idiomatic routers; the vanilla demo is a fixture, so an extra dependency would be noise. Angular flattens to `demos/angular/src/` (no `src/app/` wrapper).
