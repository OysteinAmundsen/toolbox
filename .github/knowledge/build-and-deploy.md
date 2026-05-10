---
domain: build-and-deploy
related: [grid-core]
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

## css-layer-strategy

- CASCADE (lowest→highest): @layer tbw-base → @layer tbw-plugins → @layer tbw-theme → unlayered (user CSS always wins)
- DECIDED: layers eliminate specificity wars; three layers separate structure / features / cosmetics
- DECIDED: unlayered CSS wins so users can always override without !important

## css-custom-properties

- ALL prefixed --tbw-\* (no collision risk)
- Em-based spacing/icons: scales proportionally with font size
- Colors use light-dark() function (CSS level 4): responds to `color-scheme` on :root
- Color mixing via color-mix(in hsl, ...) for derived colors
- Grid inherits: `color-scheme: inherit` (respects page settings)

## style-injection

- Grid styles: concatenated partials → `<style>` tag in shadow DOM (connectedCallback)
- Custom/plugin styles: CSSStyleSheet via document.adoptedStyleSheets (survives DOM rebuilds)
- Plugin styles registered via `grid.registerStyles(id, css)` → creates sheet → replaceSync → add to adopted

## css-partials (libs/grid/src/lib/core/styles/)

| File              | Layer    | Responsibility                             |
| ----------------- | -------- | ------------------------------------------ |
| variables.css     | tbw-base | ~150 CSS custom properties (design tokens) |
| base.css          | tbw-base | grid root, flex layout, box-sizing         |
| header.css        | tbw-base | column headers, sort icons, resize handles |
| rows.css          | tbw-base | data rows, cells, borders, focus           |
| shell.css         | tbw-base | toolbar, shell header                      |
| tool-panel.css    | tbw-base | side panels, accordion                     |
| icons.css         | tbw-base | icon sizing, SVG                           |
| loading.css       | tbw-base | spinners, overlay                          |
| animations.css    | tbw-base | keyframes, transitions                     |
| media-queries.css | tbw-base | @prefers-reduced-motion, responsive        |

- INVARIANT: order matters — variables first, media queries last
- Plugin CSS uses @layer tbw-plugins; theme CSS uses @layer tbw-theme

## themes (libs/themes/)

- 6 built-in: standard, material, bootstrap, contrast (a11y), vibrant, large (a11y)
- All wrap in @layer tbw-theme
- Source files (not built), copied as-is to dist
- Optional — grid works without any theme using base variables only
- Usage: `<link>` tag or `import '@toolbox-web/grid/themes/dg-theme-standard.css'`

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
- WHERE: `tools/build-since-map.ts` (git-history scan → `tools/since-map.json`), `tools/apply-since-tags.ts` (writes `@since` JSDoc into source), `tools/typedoc-mdx-shared.ts` (`sinceBadge` / `sinceBlock` helpers), `libs/grid/scripts/typedoc-to-mdx.ts` (calls helpers in genClass/genPluginClass/genInterface/genTypeAlias/genFunction/genEnum/genPropertiesTable/genMethod/genAccessor + `genDataGridSplit` Public API), `libs/{grid,grid-angular,grid-react,grid-vue}/typedoc.json` (`blockTags` allowlist includes `@since`).
- OWNS (footer): `apps/docs/src/components/VersionBadges.astro` reads `package.json` files via static `import` (NOT `readFileSync` — fails in `astro build`), `apps/docs/src/components/Footer.astro` slots it after `<Default />`. CSS in `apps/docs/src/styles/custom.css` (`.since-badge`, `.tbw-versions`).
- INVARIANT: `build-since-map.ts` MUST enumerate every TypeDoc entry point. Grid has 1 + 26 plugin entries (`libs/grid/src/lib/plugins/*/index.ts`); missing them silently drops plugin classes from the since-map and the MDX renders no Since pill. Adapter libs have a single entry each.
- INVARIANT: tag-prefix scoping is required — grid uses `grid-` (and legacy `v`), each adapter uses `grid-<framework>-`. Mixing causes wrong "since" attribution.
- INVARIANT: `apply-since-tags.ts` is idempotent — re-running on already-tagged source skips, never duplicates.
- FLOW (back-fill, run once per cycle): `bun tools/build-since-map.ts` → `bun tools/apply-since-tags.ts` → `bun nx typedoc grid && bun nx typedoc grid-angular && bun nx typedoc grid-react && bun nx typedoc grid-vue`.
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

- OWNS: per-PR perf-regression detection by comparing Vitest `bench()` output (`hz`, `mean`, `moe`, `rme`) of PR head against the **last released commit on `main`** (most recent reachable tag, e.g. `grid-2.8.0`), both measured **on the same CI runner in a single job** (same VM, kernel, thermal state, neighbour). Comparison window is the entire release cycle, not just the PR diff — regressions accumulate visibly across PRs instead of being absorbed into the next baseline. On push to main/next: bench JSON uploaded as artifact only — no comparison performed.
- INVARIANT: PR job is **scoped via `nx affected --with-target=bench`** — only projects whose bench-relevant code (or upstream deps in the Nx graph) changed are benched. Docs-only / chore PRs produce an empty list and the job exits early with a `## Bench: skipped` step-summary section. Single-project PRs skip the other adapter suites. This is the primary lever keeping wall time bounded; without it a typical PR would burn ~30+ minutes on suites it never touches.
- INVARIANT: when ONLY `sharedGlobals` files (e.g. `.github/workflows/ci.yml`, declared in `nx.json` as `"sharedGlobals": ["{workspaceRoot}/.github/workflows/ci.yml"]`) change in a PR, `nx affected --with-target=bench` is **internally inconsistent**: it returns `grid-react` / `grid-vue` / `grid-angular` (the adapters) but **NOT** `grid` itself, even though the adapters depend on grid. Verified May 2026: directly editing a file under `libs/grid/src/` correctly surfaces all three; only the sharedGlobals path misses the upstream library. The CI bench step works around this by force-including `grid` whenever any adapter is in the affected bench set (`case " $AFFECTED " in ... " grid-react "*|*" grid-vue "*|*" grid-angular "*) AFFECTED="grid $AFFECTED" ;; esac`). RULED OUT: investigating Nx internals or filing upstream — the workaround is one shell case-statement and the semantic ("if adapters bench, grid benches too") is what we want anyway.
- INVARIANT: PR job uses `git worktree add ../base $LAST_TAG_SHA` to materialise the last-released commit alongside the PR head (resolved via `git describe --tags --abbrev=0 origin/main` after `git fetch --tags origin main`; falls back to `origin/main` tip if no tags exist yet). Baseline is measured FIRST (warm-up cost paid before PR head is sampled). Each side is measured **N times** (`BENCH_ITERATIONS` env var, currently `1`) and merged via `tools/merge-bench-runs.ts` taking **max-of-N on `hz`** (highest = fastest = least polluted by GC/scheduler/fs-cache outliers). Borrowed from Netflix TVUI methodology — outliers on shared CI runners are almost always slower than reality, never faster. The affected list (also `--base=$LAST_TAG_SHA`) is computed once in the PR-head checkout and reused verbatim for the baseline loop, so the same project set is sampled on both sides regardless of whether the baseline commit knew about new bench files.
- INVARIANT: `merge-bench-runs.ts` returns the winning run **as a unit** — `mean`, `moe`, `rme`, and `hz` all come from the same measured run, so the `(mean ± moe)` interval used by `compare-benches.ts` corresponds to a real distribution. RULED OUT: rewriting `mean = 1000/winner.hz` (Vitest's `hz` is sample-derived, not exactly `1000/mean`, so the rewritten value pairs the winner's `moe` with a slightly off mean). RULED OUT: `min(moeA, moeB)` across runs (artificially tightens the CI band by pairing the winner's mean with a _different_ run's moe, which makes the disjointness gate fire MORE often, i.e. more false positives, not fewer). The only normalization done is fall back to `(mean * rme/100)` if `moe` is absent on either side.
- INVARIANT: comparison is CI-overlap gated AND threshold-gated (default ±25%). A bench is flagged as regression only if `current.hz < baseline.hz * (1 - threshold)` AND `current.mean ± moe` does NOT overlap `baseline.mean ± moe`. Both conditions must hold — filters runner noise without hiding real algorithmic regressions.
- INVARIANT: benches present on only one side (added or removed in a PR) are reported as `🆕 new` / `🗑️ removed` and NEVER cause a non-zero exit. Cold-start, cache-expiry, and bench file additions/removals must not break the build.
- INVARIANT: missing baseline file → exit 0 with informational message. (Possible only on push runs which intentionally skip the comparison step.)
- INVARIANT: Vitest bench JSON has `mean` in milliseconds and `hz` in ops/sec; they are NOT exact reciprocals (`hz ≈ 1000 / mean`). When fabricating test fixtures, change both consistently or the CI-overlap check disagrees with the hz delta. Bounds in `compareOne` are derived consistently as `1/(mean ± moe)` for both sides, so the 1000× factor cancels in the relative disjointness test — but anyone converting to absolute hz must multiply by 1000.
- INVARIANT: regression and improvement classification require **separate** disjointness checks (`currentHzHigh < baselineHzLow` and `currentHzLow > baselineHzHigh` respectively). A single shared flag biases one direction — the original PR shipped a single `intervalsDisjointSlower` gate that made improvements impossible to detect. File: [tools/compare-benches.ts](tools/compare-benches.ts).
- INVARIANT: Vitest resolves `--outputJson=<path>` relative to the **config's project root** (e.g. `libs/grid-vue/`), NOT the shell cwd. CI passes anchored paths (`--outputJson="$PWD/tmp/..."` or `--outputJson="$GITHUB_WORKSPACE/tmp/..."` from the worktree); a bare `tmp/...` lands inside `libs/<project>/tmp/` and the workspace-root merge step fails with ENOENT.
- INVARIANT: in `scripts/bench-vs-tag.ts`, long-running children (`bun install`, `bunx vitest bench`, `bun tools/compare-benches.ts`) MUST be spawned via `node:child_process.spawn` (the `shAsync` helper), NOT `Bun.spawn`/`Bun.spawnSync`. WHY: when the parent process is Bun on Windows, Bun-spawning-Bun reliably kills the child mid-run with exit 58 (reproduced on Bun 1.3.12 with both `Bun.spawn` and `Bun.spawnSync`, regardless of stdio mode). Node's `child_process.spawn` is still available under Bun and sidesteps the nested-Bun lifecycle bug. Sync `sh()` (using `Bun.spawnSync`) is fine for short git commands (<1s) where the bug doesn't trigger. Canonical success signal for `vitest bench` is `existsSync(outputJson)`, not the child exit code — Vitest 4.x worker teardown can flake the exit code even when the run completed and wrote JSON.
- INVARIANT: baseline and current MUST run **sequentially** on the same runner, never concurrently. The whole same-runner methodology assumes both sides see identical CPU/cache/thermal/memory-bandwidth state; running them in parallel makes them contend for cores and inflates variance asymmetrically (whichever finishes first leaves the other a quiet machine for its tail). RULED OUT: `concurrently` / `Promise.all([baseline, current])` parallelism — it defeats the noise-reduction this whole pipeline is built around. Cross-runner parallelism (CI matrix per project) is fine because each runner is its own machine; concurrency on one machine is not.
- DECIDED (Feb 2026): bench baseline = **last tag reachable from `origin/main`**, NOT PR merge-base. WHY: with merge-base as baseline, a regression introduced earlier in the release cycle is silently absorbed into every subsequent PR's baseline and disappears from the diff. Last-tag baseline keeps the comparison window = full release cycle, so accumulated regression vs last shipped product is always visible on every PR. Resolution: `git fetch --tags origin main` then `git describe --tags --abbrev=0 origin/main` → `git rev-list -n 1 <tag>`. Tag scheme is per-package (`grid-x.y.z`, `grid-vue-x.y.z`, ...) written by release-please; whichever fired most recently is a valid "last shipped" anchor. Fallback to `origin/main` tip if zero tags. File: [.github/workflows/ci.yml](.github/workflows/ci.yml) `bench:` job, `Resolve bench baseline` step. Both `nx affected --base` and `git worktree add ../base` use this resolved SHA. Local equivalent: `bun run bench:vs-tag` ([scripts/bench-vs-tag.ts](scripts/bench-vs-tag.ts)) mirrors the same worktree + merge + compare pipeline; supports `--ref`, `--project`, `--iterations`, `--threshold`, `--keep-worktree`.
- DECIDED (May 2026): same-runner base-vs-head replaced the cached-baseline approach. Previous design cached the most recent main run and compared PR runs against it; baseline and PR ran on different `ubuntu-latest` VMs so cross-runner variance produced spurious ±30–60% flips on every push. RULED OUT: parallel jobs / matrix / background processes for the two measurements — splitting across runners reverts to the noise problem; same-runner background processes contend for the 4 vCPU and produce worse results than serial. RULED OUT: Netflix-style anomaly + changepoint detection over rolling history of N=40 / N=100 runs — needs persistent storage and significant stats code; way over-engineered for our scale. Same-runner base-vs-head + max-of-N covers ~the same problem with a fraction of the machinery.
- DECIDED (May 2026): `BENCH_ITERATIONS=1` per side. Started at 3 (Netflix-style max-of-N), trialled at 2, settled at 1 to keep affected-PR wall time bounded — `nx affected` scoping + same-runner same-VM measurement already cut variance enough that the marginal noise reduction from N>1 didn't justify ~2× the bench wall time. Bump to 2 (re-enabling max-of-N) only with evidence the false-positive rate at the current ±30% threshold is unacceptable. RULED OUT: shrinking per-bench `time`/`warmupTime` (those are per-`bench()` options in tinybench, not a global vitest config knob; would require touching every `*.bench.ts` and trades looser `moe` against tighter loop — likely undoes the noise reduction same-runner already buys).
- DECIDED (May 2026): on push to main/next, bench runs ONCE across **all** projects (no `nx affected` filtering) so the trend artifact is continuous. No max-of-N needed because there's no comparison; uploads `tmp/bench-current.json` as a 30-day artifact for offline trend tracking. There is no comparison step on push — the same-runner model has no meaningful baseline target.
- DECIDED: soft-warn mode — script computes regressions but CI step omits `--fail-on-regression`. With same-runner same-VM measurements + max-of-N, the noise floor should drop substantially; revisit hard-fail after a few PRs of data.
- DECIDED: bench coverage spans `grid` + `grid-react` + `grid-vue`. Each project has its own Nx `bench` target; CI runs all three (`vitest bench --config libs/<project>/vite.config.{ts,mts}` per project) per iteration. `merge-bench-runs.ts` collapses across both iterations and projects in one pass — keyed on `group.fullName` which already includes the bench file path so cross-project collisions are impossible. `grid-angular` is excluded — directive-based, no equivalent pure-function hot path. Bench files MUST be co-located next to the code they test.
- DECIDED (May 2026): bench files MUST be added to `exclude` in every adapter `tsconfig.lib.json` (`grid`, `grid-react`, `grid-vue`). They import from co-located source but are NOT part of the published API surface; if included they get type-checked against `tsc -p tsconfig.lib.json` (and `typedoc`) which trips on test-style fixtures. Pattern: `"src/**/*.bench.ts"` alongside the existing `"src/**/*.spec.ts"` exclude.
- FLOW (PR): checkout PR head (fetch-depth: 0) → `bun install` → `git fetch --tags origin main` + `git describe --tags --abbrev=0 origin/main` → resolve `BASE_SHA` (last-tag SHA, fallback `origin/main`) → `bun nx show projects --affected --with-target=bench --base=$BASE_SHA --head=$head.sha` → if empty, write `Bench: skipped` to step summary and exit; otherwise `git worktree add ../base $BASE_SHA` → in `../base`: `bun install` + for each affected project: N×`vitest bench` → in PR head: for each affected project: N×`vitest bench` → `merge-bench-runs.ts` produces `tmp/bench-{baseline,current}.json` (max-hz per bench) → `compare-benches.ts --threshold 0.30 --summary "$GITHUB_STEP_SUMMARY"`. Project-name → vite-config-path mapping is a small case statement in the workflow (`grid` → `libs/grid/vite.config.ts`, `grid-react`/`grid-vue` → `vite.config.mts`); unknown names emit `::warning::` and skip.
- FLOW (push to main/next, non-release-merge): single `vitest bench` run per project (all three, no affected filter) → merge → upload artifact. No comparison.

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

## ci-pipeline (.github/workflows/ci.yml)
