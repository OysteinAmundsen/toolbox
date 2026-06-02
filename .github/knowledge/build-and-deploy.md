---
domain: build-and-deploy
related: [build-css, grid-core]
---

# Build, CSS & Deploy — Mental Model

## vite-build (libs/grid/vite.config.ts)

- OWNS: ES & UMD outputs (core + all-in-one), per-plugin module builds, per-feature module builds, theme distribution, version injection (**GRID_VERSION**)
- INPUT: src/index.ts + src/all.ts (core), src/lib/plugins/_/index.ts (auto-discovered), src/lib/features/_.ts (auto-discovered), libs/themes/\*.css
- OUTPUT: dist/libs/grid/ → index.js, all.js, lib/plugins/_/index.js, lib/features/_.js, umd/_.umd.js, themes/_.css
- INVARIANT: plugin directory scan auto-discovers from src/lib/plugins/ (excludes all/, shared/)
- INVARIANT: plugins externalize core imports (@toolbox-web/grid) to prevent duplication
- INVARIANT: UMD global naming: "pinned-rows" → TbwGridPlugin_pinnedRows
- DECIDED: parallel plugin/feature builds (in writeBundle hook) with pre-created directories to avoid race conditions
- DECIDED: ES only for plugins (not CJS) — lighter, modern
- DECIDED: each entry is self-contained (manualChunks: undefined) — may duplicate shared code but simpler imports
- DECIDED: all comments stripped from final bundle (code golf for CDN)
- DECIDED: terser inlines constant property accesses (e.g. `GridClasses.CELL_FOCUS` → `"cell-focus"`) — using constants from `constants.ts` has zero bundle overhead vs raw strings; repeated string values are hoisted to single-letter variables
- TENSION: bundle duplication vs shared chunks — larger total but simpler per-import

## bundle-budget (tools/vite-bundle-budget.ts)

- OWNS: budget validation, file size calculation (raw + gzip via zlib), glob resolution
- RUNS IN: Vite closeBundle hook (after all sub-builds complete)
- BUDGETS: core index.js ≤170 kB raw / ≤50 kB gzip hard fail, ≤45 kB gzip soft warn; plugins ≤50 kB each; adapters: react ≤50 kB / vue ≤50 kB
- INVARIANT: both raw and gzip checked if thresholds configured
- INVARIANT: warn-only thresholds (`warnSize` / `warnGzip`) emit yellow warnings but never fail the build; hard thresholds (`maxSize` / `maxGzip`) fail when severity: 'error'
- INVARIANT: build fails with exit code 1 if severity: 'error' mode
- DECIDED (Apr 2026): raised hard gzip ceiling 45 → 50 kB and added 45 kB warn gate. Bundle was at the 45 kB cliff blocking bug fixes; new policy is design-target 45 kB, hard ceiling 50 kB. Any new code that pushes core toward 50 kB MUST first try a plugin extraction — only land in core if a plugin would damage performance (hot path, render scheduler, virtualization).
- BASELINE (Jun 2026, pre-#370 ShellPlugin extraction): `index.js` = **172.46 kB raw / 49.25 kB gz** (vite report) — budget tool reports **48.1 kB gz** (no sourcemap). UMD `grid.umd.js` = 169.50 kB raw / 47.98 kB gz. Already **over** the 45 kB gz soft warn (warning fires) but under the 50 kB hard ceiling. This is the number every #370 phase compares against (plan invariant 9). #370 v3 cut is expected to reclaim ~20–24 kB raw by tree-shaking the shell out of the default graph. NOTE: the plan's "~1.9 KiB headroom to 45 kB" remark is stale — there is negative headroom to the soft warn today.
- DECIDED (#370, Phase 4 v3 dry-run): with the shell auto-registered (current v2.x default), `index.js` = **175.28 kB raw / 50.10 kB gz** — at the 50 kB hard ceiling (build still passes; a `// TEMP-BUDGET-370` bump covers the seam during the deprecation window). Projected **v3** (ShellPlugin tree-shaken: import made type-only + `#resolveShellPlugin`/cleanup stubbed) = **148.24 kB raw / 43.41 kB gz** — reclaims **27 kB raw / 6.7 kB gz**, dropping back UNDER both the 50 kB hard ceiling and the 45 kB soft warn. Slightly conservative: the 15 deprecated grid-element shell delegates (still in core until v3) remain bundled, so real v3 lands a touch smaller. WHY: confirms removing the core→shell seam at v3 restores budget headroom; any TEMP budget bump can be reverted then. Measured via `bun nx build grid` on `grid.ts` (marker `SHELL-AUTOREGISTER-V3-370`).

## release (release-please-config.json)

- OWNS: per-package versioning (grid, grid-angular, grid-react, grid-vue)
- MODE: prerelease (all versions tagged -rc.X)
- PATTERN: single PR for all package bumps, component in tag (grid-v2.0.0-rc.4)
- COMMIT TYPES: feat/fix/enhance/perf visible in changelog; docs/style/chore/refactor/test/build/ci hidden
- INVARIANT: each library is an independent release-please component; major bumps are per-scope. A `feat(<scope>)!:` (or `BREAKING CHANGE:` footer) on one scope triggers a major for **only** that scope.
- INVARIANT: `separate-pull-requests: false` ⇒ all pending bumps land in a single coordinated release PR.
- INVARIANT (peer-dep cascade): release-please does NOT bump `peerDependencies` automatically. When `grid` jumps a major, every adapter's `peerDependencies."@toolbox-web/grid"` range must be widened **manually** in the same PR. That peer change is itself a breaking change, so adapters get a major even when they have no own deprecation removals.
- DECIDED: publish order on a coordinated multi-major is `grid` first, then `grid-angular` / `grid-react` / `grid-vue` (peer-range satisfied at install time).
- DECIDED: v1.x deprecation commits intentionally do NOT use `!`; the `!` is reserved for the major-bump PR itself.
- DECIDED (cadence): aim for ~1 major / quarter (v1 → v2 was 22 Jan → 16 Apr 2026). Long-lived release branches are NOT used; branch from `main` ~1 week before the cut, run the cleanup as 4 `feat(<scope>)!:` commits + peer-dep bumps in one PR, let release-please publish, delete branch.

## docs versioning (`@since` pipeline + version badges)

- OWNS: per-symbol "introduced in vX.Y.Z" pills in TypeDoc-generated MDX, footer version badges linking to changelogs.
- WHERE: `.github/skills/since-tag/build-since-map.ts` (git-history scan → `.github/skills/since-tag/since-map.json`), `.github/skills/since-tag/apply-since-tags.ts` (writes `@since` JSDoc into source), `.github/skills/since-tag/resolve-since.mjs` (deterministic next-`@since` for a single new symbol), `tools/typedoc-mdx-shared.ts` (`sinceBadge` / `sinceBlock` helpers), `libs/grid/scripts/typedoc-to-mdx.ts` (calls helpers in genClass/genPluginClass/genInterface/genTypeAlias/genFunction/genEnum/genPropertiesTable/genMethod/genAccessor + `genDataGridSplit` Public API), `libs/{grid,grid-angular,grid-react,grid-vue}/typedoc.json` (`blockTags` allowlist includes `@since`). Scripts live in the `since-tag` skill (nothing automated calls them).
- OWNS (footer): `apps/docs/src/components/VersionBadges.astro` reads `package.json` files via static `import` (NOT `readFileSync` — fails in `astro build`), `apps/docs/src/components/Footer.astro` slots it after `<Default />`. CSS in `apps/docs/src/styles/custom.css` (`.since-badge`, `.tbw-versions`).
- INVARIANT: `build-since-map.ts` MUST enumerate every TypeDoc entry point. Grid has 1 + 26 plugin entries (`libs/grid/src/lib/plugins/*/index.ts`); missing them silently drops plugin classes from the since-map and the MDX renders no Since pill. Adapter libs have a single entry each.
- INVARIANT: tag-prefix scoping is required — grid uses `grid-` (and legacy `v`), each adapter uses `grid-<framework>-`. Mixing causes wrong "since" attribution.
- INVARIANT: `apply-since-tags.ts` is idempotent — re-running on already-tagged source skips, never duplicates.
- FLOW (back-fill, run once per cycle): `bun .github/skills/since-tag/build-since-map.ts` → `bun .github/skills/since-tag/apply-since-tags.ts` → `bun nx typedoc grid && bun nx typedoc grid-angular && bun nx typedoc grid-react && bun nx typedoc grid-vue`.
- DECIDED: `@since` lives in source JSDoc (not in a separate sidecar) so it survives refactors and is visible in IDE hovers. Generator no-ops when the tag is absent.
- DECIDED: Plugin/Adapter splits of `DataGridElement` (internal API pages) intentionally do NOT show the Since pill — it lives only on the Public API split to avoid noise on plugin-developer pages.
- DECIDED: Version badges link to `/grid/<framework>/changelog/` (slug convention); changelog pages are MDX shells that import the package CHANGELOG.md.

## ci-pipeline (.github/workflows/ci.yml)

- FLOW: setup (detect release merge) → validation (lint + test + build + bench, parallel) → e2e (build all → start 4 demo servers with USE_DIST=true → Playwright) → release-please → build-docs → deploy-pages
- INVARIANT: e2e runs against dist/ (validates release packaging)
- INVARIANT: release-please merge commits skip validation (already passed on feature branch)
- INVARIANT: docs deploy only triggers on grid release
- INVARIANT: `bench` job is parallel to `test`/`build`/`e2e` and gated only on `setup`. **NOT** in `release-please.needs` — bench is informational and must never block a release merge.

## bench-regression (tools/compare-benches.ts + tools/merge-bench-runs.ts + CI bench job)

- OWNS: per-PR perf-regression detection comparing Vitest `bench()` output (`hz`, `mean`, `moe`, `rme`) of PR head against **last released commit on `main`** (most recent reachable tag, e.g. `grid-2.8.0`), both measured on the **same CI runner in a single job** (same VM/kernel/thermal/neighbour). Comparison window = full release cycle (regressions accumulate visibly across PRs instead of getting absorbed). Push to main/next: bench JSON uploaded as artifact only, no comparison.
- INVARIANT: PR job scoped via `nx affected --with-target=bench`. Docs-only/chore PRs exit early with `## Bench: skipped`. Primary wall-time lever; without it a typical PR burns ~30+ min on suites it never touches.
- INVARIANT: `sharedGlobals` workaround \u2014 when ONLY `sharedGlobals` files (`.github/workflows/ci.yml` declared in `nx.json`) change, `nx affected --with-target=bench` returns adapters (`grid-react`/`grid-vue`/`grid-angular`) but NOT `grid`. Verified May 2026. Workaround in CI bench step: force-include `grid` whenever any adapter is in the affected set (`case " $AFFECTED " in ... " grid-react "*|*" grid-vue "*|*" grid-angular "*) AFFECTED="grid $AFFECTED" ;; esac`). RULED OUT: filing upstream \u2014 workaround is one case statement.
- INVARIANT: PR uses `git worktree add ../base $LAST_TAG_SHA` (resolved via `git describe --tags --abbrev=0 origin/main` after `git fetch --tags origin main`; fallback `origin/main` if no tags). Baseline measured FIRST (warm-up paid before head). Each side measured **N times** (`BENCH_ITERATIONS` env, currently `1`), merged via `tools/merge-bench-runs.ts` taking **max-of-N on `hz`** (Netflix TVUI methodology \u2014 shared-runner outliers always slower, never faster). Affected list (also `--base=$LAST_TAG_SHA`) computed once in PR-head checkout + reused for baseline loop so same project set on both sides regardless of baseline knowing new bench files.
- INVARIANT: `merge-bench-runs.ts` returns winning run **as unit** \u2014 `mean`/`moe`/`rme`/`hz` from same measured run so `(mean \u00b1 moe)` interval in `compare-benches.ts` is a real distribution. RULED OUT: `mean = 1000/winner.hz` rewrite (`hz` is sample-derived, not exact); `min(moeA, moeB)` (artificially tightens CI band \u2192 more false positives). Only normalization: fall back to `mean * rme/100` if `moe` absent.
- INVARIANT: regression flagged only if `current.hz < baseline.hz * (1 - threshold)` AND `current.mean \u00b1 moe` does NOT overlap `baseline.mean \u00b1 moe` (default \u00b125%). Both conditions \u2014 filters runner noise without hiding real regressions. Regression + improvement need **separate** disjointness checks (`currentHzHigh < baselineHzLow` vs `currentHzLow > baselineHzHigh`); single shared flag biases one direction. File: [tools/compare-benches.ts](tools/compare-benches.ts).
- INVARIANT: one-sided benches (added/removed in PR) reported as `\ud83c\udd95 new` / `\ud83d\uddd1\ufe0f removed`, NEVER non-zero exit. Missing baseline file \u2192 exit 0 informational.
- INVARIANT: Vitest bench JSON has `mean` in ms and `hz` in ops/sec \u2014 NOT exact reciprocals. Bounds in `compareOne` derived consistently as `1/(mean \u00b1 moe)` on both sides (1000\u00d7 cancels in relative test); when fabricating fixtures change both consistently.
- INVARIANT: Vitest resolves `--outputJson=<path>` relative to **config's project root** (e.g. `libs/grid-vue/`), NOT shell cwd. CI passes anchored paths (`--outputJson="$PWD/tmp/..."`); bare `tmp/...` lands inside `libs/<project>/tmp/` and workspace-root merge fails ENOENT.
- INVARIANT: `scripts/bench-vs-tag.ts` long-running children (`bun install`, `bunx vitest bench`, `bun tools/compare-benches.ts`) MUST spawn via `node:child_process.spawn` (the `shAsync` helper), NOT `Bun.spawn`/`Bun.spawnSync`. WHY: parent Bun + Bun-spawning-Bun on Windows reliably kills child mid-run with exit 58 (Bun 1.3.12, both APIs, all stdio modes). Sync `sh()` (Bun.spawnSync) fine for short git commands (<1s). Canonical success signal for `vitest bench` is `existsSync(outputJson)`, NOT child exit code (Vitest 4.x worker teardown flakes exit code even on completed runs).
- INVARIANT: baseline + current MUST run **sequentially** on same runner, never concurrently \u2014 parallel runs contend for cores and asymmetrically inflate variance (winner leaves loser quiet machine for tail). RULED OUT: `Promise.all` / `concurrently` parallelism. Cross-runner CI-matrix parallelism is fine (separate machines).\n- DECIDED (Feb 2026, last-tag baseline): bench baseline = last tag reachable from `origin/main`, NOT PR merge-base. WHY: merge-base baseline silently absorbs accumulated regression into every subsequent PR's baseline. Resolution: `git fetch --tags origin main` \u2192 `git describe --tags --abbrev=0 origin/main` \u2192 `git rev-list -n 1 <tag>`. Per-package tag scheme (`grid-x.y.z`, `grid-vue-x.y.z`...) via release-please; most-recent valid. Fallback `origin/main`. File: [.github/workflows/ci.yml](.github/workflows/ci.yml) `bench:` job, `Resolve bench baseline` step. Both `nx affected --base` and `git worktree add` use resolved SHA. Local: `bun run bench:vs-tag` ([scripts/bench-vs-tag.ts](scripts/bench-vs-tag.ts)) supports `--ref`, `--project`, `--iterations`, `--threshold`, `--keep-worktree`.\n- DECIDED (May 2026, same-runner): replaced cached-baseline (previous design ran baseline + PR on different `ubuntu-latest` VMs \u2192 cross-runner variance \u00b130\u201360% flips). RULED OUT: parallel jobs/matrix/background (reverts noise problem or contends for 4 vCPU); Netflix-style anomaly + changepoint detection over N=40/100 history (needs persistent storage, over-engineered for our scale).\n- DECIDED (May 2026, `BENCH_ITERATIONS=1`): started at 3 (Netflix max-of-N), trialled 2, settled 1 to keep affected-PR wall time bounded \u2014 `nx affected` scoping + same-VM already cut variance enough that N>1 didn't justify 2\u00d7 bench time. Bump to 2 only with evidence of unacceptable false-positive rate at \u00b130%. RULED OUT: shrinking per-bench `time`/`warmupTime` (per-`bench()` tinybench option, not vitest knob; would touch every `*.bench.ts` and trade looser `moe` against tighter loop).\n- DECIDED (May 2026): push to main/next runs ONCE across **all** projects (no `nx affected`) for continuous trend artifact; no max-of-N (no comparison); `tmp/bench-current.json` uploaded 30-day artifact.\n- DECIDED: soft-warn mode \u2014 script computes regressions, CI step omits `--fail-on-regression`. Revisit hard-fail after data.\n- DECIDED: bench coverage = `grid` + `grid-react` + `grid-vue` (each has own Nx `bench` target). `merge-bench-runs.ts` collapses across iterations + projects in one pass, keyed on `group.fullName` (includes bench file path; cross-project collisions impossible). `grid-angular` excluded (directive-based, no pure-function hot path). Bench files MUST be co-located next to code they test.\n- DECIDED (May 2026): bench files MUST be in `exclude` in every adapter `tsconfig.lib.json` (`"src/**/*.bench.ts"` alongside `"src/**/*.spec.ts"`). Otherwise `tsc -p tsconfig.lib.json` + `typedoc` trip on test-style fixtures.\n- FLOW (PR): checkout (fetch-depth: 0) \u2192 `bun install` \u2192 `git fetch --tags origin main` + `git describe --tags --abbrev=0 origin/main` \u2192 resolve `BASE_SHA` \u2192 `bun nx show projects --affected --with-target=bench --base=$BASE_SHA --head=$head.sha` \u2192 if empty, write `Bench: skipped` + exit; else `git worktree add ../base $BASE_SHA` \u2192 in `../base`: `bun install` + N\u00d7`vitest bench` per affected project \u2192 in PR head: N\u00d7`vitest bench` per project \u2192 `merge-bench-runs.ts` \u2192 `tmp/bench-{baseline,current}.json` \u2192 `compare-benches.ts --threshold 0.30 --summary "$GITHUB_STEP_SUMMARY"`. Project\u2192config path mapping: workflow case statement (`grid` \u2192 `libs/grid/vite.config.ts`, `grid-react`/`grid-vue` \u2192 `vite.config.mts`); unknown emits `::warning::` skip.\n- FLOW (push main/next, non-release-merge): single `vitest bench` per project (all three, no affected filter) \u2192 merge \u2192 upload artifact. No comparison.

## grid-angular ng-packagr build (Bun dual-package hazard)

- INVARIANT: feature secondary entry points (`libs/grid-angular/features/*/src/index.ts`) MUST NOT `import type { TemplateRef } from '@angular/core'` directly when calling `adapter.createTrackedEmbeddedView(...)`. Use the inferred type from the helper (`getDetailTemplate`, `getResponsiveCardTemplate`, etc., which come from `@toolbox-web/grid-angular`).
- TENSION: under Bun, `@angular/core` resolves twice during ng-packagr secondary entry-point builds — once via `node_modules/.bun/@angular+core@<hash>/...` (what local `import` statements bind) and once via `node_modules/@angular/core/...` (what the built adapter `.d.ts` in `dist/libs/grid-angular/` references). The two `TemplateRef` instances differ only by a private `_declarationLView` brand, so passing one where the other is expected fails with `Types have separate declarations of a private property '_declarationLView'`. Inferred-from-helper types route through the same package instance as the adapter and sidestep the brand mismatch entirely.
- DECIDED (May 2026): drop the `as unknown as TemplateRef<...>` cast pattern in feature bridges; the cast just hides the mismatch in one direction (pin to `.bun/`) and breaks once the adapter `.d.ts` is rebuilt against the other instance. Files: [features/master-detail/src/index.ts](libs/grid-angular/features/master-detail/src/index.ts), [features/responsive/src/index.ts](libs/grid-angular/features/responsive/src/index.ts). Pattern still acceptable inside the main adapter (`libs/grid-angular/src/lib/angular-grid-adapter.ts`) where both endpoints resolve through the same package instance during the primary entry-point build.

## nx-config (nx.json)

- Plugins: @nx/js/typescript, @nx/vite/plugin, @nx/vitest, @nx/eslint/plugin, @nx/playwright/plugin
- Named inputs: production excludes test files; sharedGlobals includes ci.yml
- TENSION: CI workflow in sharedGlobals means any CI change invalidates all caches

## tsconfig-paths (tsconfig.base.json)

- All point to dist/ (built artifacts) for CI type checking
- @toolbox-web/grid → dist/libs/grid/index.d.ts
- @toolbox-web/grid/plugins/_ → dist/libs/grid/lib/plugins/_/index.d.ts
- @toolbox-web/grid/features/_ → dist/libs/grid/lib/features/_.d.ts
- @toolbox/themes/_ → libs/themes/_ (source, not built)
- INVARIANT: TypeScript `compilerOptions.paths` does **NOT merge** across `extends`. A child tsconfig that declares its own `paths` block fully **replaces** the parent's. Same applies to `compilerOptions.types` and `compilerOptions.lib`.
- DECIDED: when a child tsconfig must override one mapping (e.g. `tsconfig.typedoc.json` pointing `@toolbox-web/grid-angular` at source instead of dist), it MUST repeat every `@toolbox-web/grid*` parent mapping it still needs, using wildcard forms (`plugins/*`, `features/*`) for compactness. Detection signal: a sudden burst of `TS2307: Cannot find module '@toolbox-web/...'` from a child config that has its own `paths` block — suspect path-shadowing first.

## v3.0.0 cleanup plan (deprecation removal)

Tracked in milestone `v3.0.0` and epic issue #263. Sub-issues: #259 (grid), #260 (grid-angular), #261 (grid-react), #262 (grid-vue) and #228 (touch DnD). Use `grep -rn '@deprecated\|MOVE-IN-V2' libs/` to enumerate at cut time.

### grid → 3.0.0

- Remove `DGEvents`, `DGEventName`, `PluginEvents`, `PluginEventName` from `libs/grid/src/public.ts`. Replacement: `keyof DataGridEventMap`.
- Delete `libs/grid/src/lib/plugins/reorder-rows/**` and `libs/grid/src/lib/features/reorder-rows.ts`. Superseded by `row-drag-drop`.
- Prune legacy `PinnedRowsConfig` fields (`top`, `bottom`, `showRowCount`, `showSelectedCount`, `showFilteredCount`, `panels`, `aggregations`) and the legacy `PinnedRowSlot` type. Keep only the unified `slots[]` API.
- Drop `RowDragDropConfig.canDragRow` (use `canDrag`).
- Drop `ServerSidePlugin.getNodeCount` / `isLoaded` aliases (use `getTotalNodeCount` / `isNodeLoaded`).

### grid-angular → 2.0.0

ng-packagr forbids primary→secondary imports, so the source must be **written in** the feature secondary entry and the primary-entry copy deleted in the **same commit**. Source files currently carry `MOVE-IN-V2:` markers (NOT `@deprecated`, because that would leak warnings to consumers importing from the correct feature entry).

- Move `base-filter-panel.ts` → `features/filtering/`.
- Move `base-grid-editor.ts`, `base-grid-editor-cva.ts`, `base-overlay-editor.ts` → `features/editing/`.
- Move `directives/grid-column-editor.directive.ts`, `grid-form-array.directive.ts`, `grid-lazy-form.directive.ts` → `features/editing/`.
- Split `directives/structural-directives.ts`: `TbwEditor` → `features/editing/`. **`TbwRenderer` STAYS in core** (editor-agnostic).
- Master-detail: `GridDetailView`, `GridDetailContext`, `getDetailTemplate` → `features/master-detail/`.
- Strip every `@deprecated` re-export from `src/index.ts`.
- Strip every `@deprecated` per-feature input/output shim prop from `directives/grid.directive.ts` (~lines 538–1098 in current file).
- Bump `peerDependencies."@toolbox-web/grid"` to `^3.0.0`.

### grid-react → 2.0.0

- Drop `reorderRows` alias (use `rowDragDrop`) and `SSRProps` + `ssr` prop entirely from `feature-props.ts`.
- Bump `peerDependencies."@toolbox-web/grid"` to `^3.0.0`.

### grid-vue → 2.0.0

- Drop `reorderRows` alias and `SSRProps` + `ssr` prop from `feature-props.ts`.
- Remove the deprecated re-export in `vue-grid-adapter.ts` (consumers import from `./editor-mount-hooks`).
- Bump `peerDependencies."@toolbox-web/grid"` to `^3.0.0`.

### Verification before tagging

- `bun nx run-many -t build lint test -p grid grid-angular grid-react grid-vue`
- `bun nx build demo-angular` / `demo-react` / `demo-vue` (catches dangling main-entry imports)
- `bun nx build docs` (catches stale code blocks)
- `bun nx run grid-angular:typedoc` (regen MDX matches new file layout)
- `bun nx run e2e:e2e` and `bun nx run docs-e2e:e2e`

## demos-layout

- OWNS: cross-framework demo apps. All four frameworks now use the route-based shell layout under `demos/<framework>/` (no per-framework `employee-management` wrapper, no `app/` wrapper inside Angular). Each shell bootstraps an idiomatic router and registers one lazy route per demo; demos live under `src/demos/<demo-name>/` (Angular: `src/demos/<demo-name>/`).
- INVARIANT: per-demo data/types/styles live in `demos/shared/<demo-name>/` so every framework imports identical fixtures via `@demo/shared/<demo-name>` — required for cross-framework parity tests in `e2e/`.
- INVARIANT: `demos/shared/resolve-aliases.ts` enumerates demo names in a `demoNames` array and emits `@demo/shared/<name>`, `@demo/shared/<name>/styles`, `@demo/shared/<name>/demo-styles.css` aliases. Adding a new demo = appending one string here. Angular esbuild plugin (`demos/angular/tools/esbuild-alias-plugin.mjs`) duplicates this logic since Angular bypasses Vite — keep them in sync.
- INVARIANT: every shell loads its routes lazily (dynamic `import()` for vanilla/Vue, `lazy()` for React, `loadComponent` for Angular) so each demo ships as its own chunk and unused demos never bundle.
- INVARIANT: `/` in every shell renders a demo index page that lists every registered route as a navigation link; unknown paths render the same index. CI `wait-on http://localhost:<port>` health checks keep working because the index returns 200. E2E tests target `localhost:<port>/employee-management` explicitly via `e2e/tests/utils.ts:DEMOS`.
- INVARIANT: docs site imports the pure grid factory via `@demo/vanilla/<demo-name>` (alias points at `demos/vanilla/src/demos/<demo-name>/grid-factory.ts`), NOT the route module. Factory exports `createEmployeeGrid()` etc.; route module's `index.ts` owns mount/teardown + control panel. Keep these separate so importing the factory doesn't drag in route-shell DOM code. React/Vue/Angular do NOT need a separate factory because the docs site does not import their adapters.
- INVARIANT: per-framework router choices: vanilla = hand-rolled `shell/router.ts` (~50 LOC, `pathname`-based); React = `react-router-dom` v7 with `BrowserRouter` + `<Routes>`; Vue = `vue-router` v4 with `createWebHistory()`; Angular = `@angular/router` with `provideRouter()` + `loadComponent`. Routes register the demo paths in `shell/App.tsx` / `shell/router.ts` / `shell/App.vue` / `app.routes.ts` respectively.
- DECIDED (May 2026): hand-rolled router for vanilla, idiomatic per-framework routers for the others. WHY: the framework demos serve double duty as reference setups, so they must look like real apps would; the vanilla demo is a fixture, so an extra router dependency would be noise.
- DECIDED (May 2026): Angular shell flattens to `demos/angular/src/` (no `src/app/` wrapper). WHY: the `app/` folder is just Angular CLI scaffolding convention, not a framework requirement; flattening keeps the layout symmetric with React/Vue/vanilla. Demo modules live at `demos/angular/src/demos/<name>/`.
- DECIDED (May 2026): `/` renders a demo-index page (with nav links) instead of redirecting to the first route. WHY: with multiple demos planned, an index gives discoverability; the index returns 200 so existing CI `wait-on` health checks keep working without change. Each shell has its own `demo-index` view (`demos/vanilla/src/shell/demo-index.ts`, `DemoIndexComponent` in Angular, equivalents in React/Vue).
