# `libs/` Health Audit — 2026-08-07

Scope: `libs/grid`, `libs/grid-angular`, `libs/grid-react`, `libs/grid-vue` (themes excluded).
Method: `bunx fallow health|dead-code|dupes`, targeted source review, existing bench artifacts
(`tmp/bench-current-grid-1.json`), coverage summaries (`coverage/libs/*`), knowledge base.

> **Status: remediated 2026-08-07.** All security findings (S1–S5), the modularity enforcement
> gaps (M1–M2), and the `formatCsvValue`/`escapeHtml` duplication (I2) have been fixed and are
> **removed from this document**. What remains below is the current, unresolved state. See
> "Remediation log" at the end for what changed and which findings were reclassified after
> closer inspection.

---

## Scorecard

| Dimension               | Grade | One-line verdict                                                               |
| ----------------------- | ----- | ------------------------------------------------------------------------------ |
| Security                | A−    | Zero deps, structural sanitizer, machine-enforced `innerHTML` rule             |
| Modularity              | A     | Excellent core/plugin split, now enforced by lint rather than discipline       |
| Code isolation          | B+    | Zero circular deps, clean core; adapter↔adapter duplication is the weak spot   |
| API surface & DX        | A−    | Tiny, deprecation-free public surface; i18n is the notable gap                 |
| Performance             | A     | Architecturally competitive; measured numbers are good; harness already exists |
| Dead code / duplication | B+    | 5.7 % duplication (concentrated in adapters); dead-code signal now configured  |

**Fallow composite at time of audit: 73.5 / 100 (grade B).** Penalty breakdown: hotspots 10,
unit size 10, maintainability 2.4, dead files 1.5, coupling 1.3, duplication 0.7, dead exports 0.6.
Complexity, p90 complexity, unused deps and circular deps all score **0 penalty**. The dead-files
and dead-exports penalties (2.1 points) were false positives and should drop on the next run now
that `.fallowrc.json` declares the adapter subpath entry points.

Raw vitals: 834 files, 5 620 functions, avg cyclomatic **3.1**, p90 cyclomatic **7**,
maintainability avg **90.2**, circular deps **0**, unused deps **0**, duplication **5.7 %**.

---

## 1. Security

### What is genuinely good

- **Zero runtime dependencies** in `@toolbox-web/grid`. The entire supply-chain attack surface is
  the build toolchain. This is the single strongest security property of the library.
- **`sanitizeHTML()` is a real, documented, near-universally-applied invariant.** 13+ call sites,
  a `<template>`-based inert parse, a solid `DANGEROUS_TAGS` list (including the commonly-missed
  `template`, `slot`, `noscript`, `noembed`, `xmp`, `plaintext`, `listing`), event-handler
  stripping, URL-protocol blocking (`javascript:`/`vbscript:`/`data:`/`blob:`), and a `style`
  attribute expression filter.
- **The `{{ }}` template evaluator does not use `eval`/`new Function`.** It is a hand-written
  recursive-descent parser whose only identifier resolution is a whitelist
  (`value`, `row.*`, `typeDefault.*`) — see `resolveId()` in
  [sanitize.ts](libs/grid/src/lib/core/internal/sanitize.ts). Combined with a forbidden-token
  regex, an 80-char expression cap, and a single-dot-chain limit, this is a well-designed sandbox.
- **Prototype-pollution barriers are present and deliberate.** `isUnsafeKey` in
  [value-accessor.ts](libs/grid/src/lib/core/internal/value-accessor.ts) uses explicit `===`
  comparisons (so CodeQL recognises the barrier), and `RowManager.#applyRowChanges` inlines the
  same guard rather than importing the editing plugin's copy.
- **Untrusted deserialization is validated, not trusted.** `decodePayload` in
  [drag-drop-protocol.ts](libs/grid/src/lib/plugins/shared/drag-drop-protocol.ts) shape-checks
  every field and rejects non-integer indices; `parseClipboardHtmlPayload` in
  [clipboard-payload.ts](libs/grid/src/lib/plugins/clipboard/clipboard-payload.ts) deliberately
  avoids `DOMParser` on attacker-controlled clipboard HTML and validates the decoded shape.
- **`setSanitizedHTML(el, html)` is the single canonical markup sink**, and an ESLint
  `no-restricted-syntax` rule now fails the build on any computed `innerHTML =` assignment in
  `libs/grid/src/lib/**`. The invariant is machine-checked, not grep-and-hope.
- **Spreadsheet formula injection is neutralised by default** in both CSV export and clipboard
  copy via `formatDelimitedValue`, with `escapeFormulas` as an explicit opt-out.

### Findings

#### S3 (residual) — sanitizer hardening still available (LOW)

The mutation-XSS round trip is gone (`setSanitizedHTML` inserts nodes via `replaceChildren`
instead of re-assigning a serialized string) and `math` is now blocked. Two optional hardening
steps remain:

1. **Prefer the platform when available.** `Element.setHTML(html, { sanitizer })` (Sanitizer API,
   Chrome 138+/Firefox 141+) with the current implementation as fallback would be
   browser-maintained and mXSS-safe by construction. Not urgent now that the round trip is gone.
2. **Trusted Types.** CSP-hardened apps still cannot use the grid's string-renderer paths without
   a policy. This is a **docs** gap, not a code gap — add a note describing the required policy.

Also still open: consider adding `is=` to the stripped-attribute list (custom-element upgrade
vector).

#### S5 — `data:` URL blocking is coarser than necessary (LOW)

`DANGEROUS_URL_PROTOCOL` blocks `data:` outright, which also blocks legitimate `data:image/png`
icons. Consider allowing `data:image/(png|jpeg|gif|webp)` explicitly — but **not**
`data:image/svg+xml`, which is scriptable.

#### S6 — Editor markup is deliberately not sanitized (ACCEPTED RISK, documented)

`editor-injection.ts` assigns editor HTML to `innerHTML` without sanitizing, because the sanitizer
strips `input`/`select`/`textarea`/`button` — i.e. everything an editor is made of. The strings
come from author-supplied editor factories and light-DOM `<template editor>` markup (code, not row
data), and interpolated row values are HTML-escaped by the compiled template. Both sites carry an
inline `eslint-disable-next-line no-restricted-syntax` with that rationale.

This is the correct trade-off today, but it means **a column editor is a code-trust boundary**. If
editor specs ever become configurable from a serialized/remote source, this becomes a live
vulnerability. Worth an explicit note in the editing docs.

### Not findings (verified clean)

- No `eval`, `new Function`, `document.write`, or `insertAdjacentHTML` anywhere in `libs/`.
- No `dangerouslySetInnerHTML` in the React adapter; no `v-html` in the Vue adapter.
- The print plugin does not use `window.open`, `srcdoc`, or `document.write`.
- `downloadBlob` correctly revokes its object URL.
- No unused/unlisted production dependencies (`lightningcss` is a build-only false positive from
  `vite.config.ts`).

---

## 2. Modularity

**This is the library's strongest dimension.** The core/plugin split is real, not aspirational:

| Area                    | Non-test LOC | Share |
| ----------------------- | ------------ | ----- |
| `grid/src/lib/core`     | 24 642       | 37 %  |
| `grid/src/lib/plugins`  | 41 593       | 62 %  |
| `grid/src/lib/features` | 1 069        | 2 %   |

62 % of the grid ships as **26 independently-buildable, separately-exported plugins**, none over
5 050 LOC. Core `index.js` is **155.05 kB raw / 45.81 kB gz** against a 170 kB / 50 kB hard budget
— enforced _at build time_ by `tools/vite-bundle-budget.ts`, not by convention. Note this is
**already past the 45 kB gz soft-warning line**, so the remaining headroom before the hard failure
is ~4 kB gz; treat any new core feature as needing a plugin justification. The `forbiddenSymbols`
assertion that proves the shell controller tree-shakes out of core is a genuinely sophisticated
piece of build-time architecture enforcement.

The plugin system itself is mature: manifests with declared dependencies/incompatibilities/query
types, hook priorities, an event bus plus a typed sync query channel, and `AbortSignal`-based
teardown. `HARD RULE #370` (core must not reference any plugin) holds in production code — the
only `plugins/` imports in `core/**` are `import type`, and this is now enforced by ESLint for
**all** plugins rather than just the shell.

### Findings

#### M2 (residual) — Nx `depConstraints` cannot be made to work here (LOW, documented)

The original finding was that `depConstraints: [{ sourceTag: '*', onlyDependOnLibsWithTags: ['*'] }]`
enforces nothing. Projects are now properly tagged (`layer:core`, `layer:adapter`, `layer:styles`,
`type:app`, `type:e2e`), but **real tag constraints turned out to be unusable**: the tsconfig
`paths` for `@toolbox-web/grid[/subpath]` point at `dist/`, so Nx cannot attribute those imports
back to the `grid` project and every legitimate adapter→core import is reported as a violation.
This is the same resolver limitation that already forced `enforceBuildableLibDependency: false`.

The boundary is instead enforced by a graph-independent `no-restricted-imports` rule that bans
adapter↔adapter imports. The tags are retained because they are still useful for `nx affected`
filtering.

**Remaining gap:** nothing mechanically stops a _demo_ from reaching into
`libs/grid/src/lib/core/internal`. If that matters, add a `no-restricted-imports` pattern for
`demos/**` rather than trying to fix it with tags.

#### M3 — `libs/grid-react/node_modules/@toolbox-web/grid` shadowing copy (LOW)

A stale published copy of the grid is installed inside the React adapter's own `node_modules`
(same hazard already documented for `grid-angular`, which has `link-grid-dist.ts` to work around
it). React is described as "immune" because Vite honours tsconfig `paths` — but the copy is real
and will confuse any Node-resolution-based tool (including fallow, ESLint plugins, and IDE
go-to-definition). Consider extending `link-grid-dist.ts` to React/Vue for uniformity.

---

## 3. Code isolation

### Good

- **Zero circular dependencies** across 834 files. This is rare at this size and is the result of
  deliberate work (`tag-registry.ts` as a leaf, `FOCUSABLE_EDITOR_SELECTOR` moved to `constants.ts`,
  `sorting.ts` repainting via `grid._schedulerRenderHeader()` instead of importing `header.ts`).
  Fallow is configured with `circular-dependencies: error`, so this is guarded.
- **p95 fan-in of 6, `coupling_high_pct` 2.5 %** — modules are narrow. Only 0.8 % of functions are
  in the high/very-high "unit interfacing" (parameter count) risk bands.
- **Clean layering seams:** `PluginGridApi` vs `GridHost`, `CORE_CONSUMED_ADAPTER_METHODS` +
  per-adapter conformance specs, and the plugin `query()` channel for cross-plugin contracts that
  belong to neither side (`collectHeaderRows`, `getCellEditableResolver`, `commitCellValue`).

### Findings

#### I1 — React ↔ Vue adapters are ~1 100 lines of near-verbatim duplication (MEDIUM)

Fallow's `mirrored_directories` detector names it directly:

| Mirror                                                | Shared files                                                                                  | Lines |
| ----------------------------------------------------- | --------------------------------------------------------------------------------------------- | ----- |
| `grid-react/src/lib/` ↔ `grid-vue/src/lib/`           | `feature-props.ts`, `feature-prop-keys.ts`, `post-mount-refresh-hooks.ts`, bench              | 707   |
| `grid-react/src/features/` ↔ `grid-vue/src/features/` | `export`, `filtering`, `master-detail`, `pinned-rows`, `responsive`, `selection`, `undo-redo` | 421   |

Largest single clone group: **481 lines** between `grid-react/src/lib/feature-props.ts:194` and
`grid-vue/src/lib/feature-props.ts:187`. Then `filtering.ts` (107 L), `undo-redo.ts` (87 L),
`selection.ts` (68 L), `export.ts` (62 L), `feature-prop-keys.ts` (59 L), and the
adapter cores (`react-grid-adapter.ts` ↔ `vue-grid-adapter.ts`, three groups totalling ~125 L).
`grid-angular` participates in three-way clones for `filtering`, `selection` and `export`.

Some of this is _framework-shaped_ and correctly duplicated (the knowledge base explicitly rules
out "ship-without-caller for API parity"). But `feature-props.ts` at 481 identical lines is not
framework-shaped — it is a type-level catalogue that differs only in the `ReactNode` vs `VNode`
return type. Same for `feature-prop-keys.ts` (a `Set` of string literals) and the
`row-diff.ts` clone shared by Angular and React.

**Options, cheapest first:**

1. **Codegen** `feature-props.ts` / `feature-prop-keys.ts` from a single manifest. The three-way
   `new-adapter-feature` skill already exists precisely because this drifts — codegen retires the
   skill's most error-prone step.
2. Extract a private `libs/grid-adapter-shared/` (unpublished, source-only) for the genuinely
   framework-neutral helpers: `row-diff.ts`, `post-mount-refresh-hooks.ts`, `feature-prop-keys.ts`,
   the `column-shorthand` re-export, and the `bridge`/`HTMLElement` helper clones in the adapter
   cores. Generic over the node type where needed.
3. At minimum, make the duplication _checked_: a spec that asserts the two `feature-props.ts`
   key sets are identical would turn silent drift into a red test.

#### I2 — Duplicate type declarations under the same name (LOW)

- `AggregatorFn` / `AggregatorRef` declared in both `core/internal/aggregators.ts` and
  `plugins/pinned-rows/types.ts`. The knowledge base says the pinned-rows copy is _deliberate_
  (stricter signature, separate entry point) — that rationale should be a code comment at both
  sites, because `AggregatorRef` previously had exactly this problem and had to be de-duplicated.
- `HeaderRenderer` in both `core/plugin/types.ts` and `core/types.ts`.
- `RowDragPayload` in both `plugins/row-drag-drop/types.ts` and `plugins/shared/drag-drop-protocol.ts`.
- `resolveDefaultExpanded` implemented twice (`grouping-rows.ts`, `pivot-engine.ts`).

---

## 4. API surface & DX

### Good

- **`public.ts` exports ~29 named symbols in 455 lines** — an extremely disciplined surface for a
  library this size. `src/index.ts` is 51 lines, `all.ts` 77.
- **Zero `@deprecated` symbols in library source.** The v3 cleanup was completed, not half-done.
  This is unusual and worth protecting.
- **Subpath exports are precise**: `./plugins/*`, `./features/*`, `./features/registry`,
  `./themes/*`, `./umd/*`, with matching `typesVersions` for older resolvers and a correct
  `sideEffects` array for tree-shaking.
- **Type-level drift guards are a standout DX investment.** `satisfies`-based event maps in all
  three adapters, `_AssertFeaturePropsCoverCore`, `_AssertBuiltinCoversCore`,
  `CORE_CONSUMED_ADAPTER_METHODS` conformance specs, and registry-parity specs. The rule
  "NEVER widen `satisfies` to silence a complaint — the complaint IS the feature" is exactly right.
- **Progressive disclosure works**: `field="price:number"` shorthand → `columns` array →
  `gridConfig` → light-DOM `<tbw-grid-column>` → plugins. Four entry paths converge on one
  chokepoint (`resolveFeatures` → `createPluginFromFeature`), which is why config-entry uniformity
  holds.
- **Multi-version coexistence** (`data-tbw-grid` as the stable selector contract, auto-suffixed
  tags) is a micro-frontend feature most competitors don't have.

### Findings

#### D1 — No i18n / `localeText` mechanism (HIGH for adoption)

UI strings are hardcoded English in the plugin panels:
[filter-panel-default.ts](libs/grid/src/lib/plugins/filtering/filter-panel-default.ts#L111)
(`'Select All'`), `'Apply'` ×3, `'Clear Filter'` ×3, plus context-menu, pivot-panel and
visibility-panel labels. The only localisation hook is `A11yConfig.messages`, which covers ARIA
announcements — not visible chrome.

AG Grid's `localeText`, Handsontable's `language`, and TanStack's headless model all solve this.
For a library positioning itself as an "ag-grid-alternative" (per its own `package.json` keywords),
this is the most likely reason an enterprise evaluation stops.

**Fix:** a `GridConfig.locale?: Record<string, string>` merged over a `DEFAULT_LOCALE` constant,
with a `t(key, fallback)` helper on `BaseGridPlugin`. Keys namespaced per plugin
(`filter.apply`, `filter.clear`, `filter.selectAll`). Bundle cost is a few hundred bytes; do it
before v4 so it is not a breaking change later.

#### D2 — Public API methods are invisible to static analysis (LOW, but worth a policy)

Fallow reports 55 "unused class members" in `libs/`, and the large majority are **intentional
public API** — `ShellPlugin.registerToolPanel`, `EditingPlugin.isCellEditing`,
`ColumnVirtualizationPlugin.scrollToColumn`, `GroupingColumnsPlugin.getGroups`, etc. These are
false positives _for a library_, but they cost review attention on every run.

**Correction from the original audit:** a further class of these is invisible for a second reason —
**duck-typed cross-boundary calls**. `MasterDetailPlugin.refreshDetailRenderer`,
`RowDragDropPlugin.emitTransfer` and `ShellPlugin.disposeShellState` were all listed as
"genuinely removable" and are in fact **live**, called through structural-type seams like
`getPluginByName('shell') as { disposeShellState?(): void }`. That seam exists precisely to honour
HARD RULE #370, so this false-positive class is a permanent consequence of the architecture, not a
bug. Never delete a member on fallow's say-so without grepping for its name as a string.

**Fix:** mark the real public API `@public` in JSDoc and extend `.fallowrc.json` so plugin
`index.ts` public classes are roots, so the signal-to-noise ratio of future runs improves.

#### D3 — Untested public entry points (LOW→MEDIUM, reclassified)

`useGridPrint` (react/print.ts), `useGridSelection` (react/selection.ts),
`useGridUndoRedo` (react/undo-redo.ts), `useGridFiltering` (vue/filtering.ts),
`GridElementContext` (react/data-grid.tsx), `getFeatureFactory` (react/feature-registry.ts).

Originally filed as "real unused exports — delete if not published". They **are** published: each
is exported from a `@toolbox-web/grid-{react,vue}/features/*` subpath and carries full TSDoc with
usage examples. Deleting them would be a breaking change. `.fallowrc.json` now declares those
subpaths as entry points so they stop being reported.

That leaves the real problem: these are **user-facing entry points with zero test coverage** — a
worse signal than the dead-code one it was mistaken for. Each needs a spec that mounts a grid and
exercises the hook.

#### D4 — Test coverage is uneven (MEDIUM)

| Package        | Lines  | Branches | Functions |
| -------------- | ------ | -------- | --------- |
| `grid-vue`     | 89.2 % | 73.9 %   | 84.4 %    |
| `grid-react`   | 86.6 % | 72.7 %   | 80.2 %    |
| `grid`         | 83.9 % | 71.0 %   | 83.6 %    |
| `grid-angular` | 73.3 % | 71.9 %   | 76.1 %    |

Branch coverage sits at ~71–74 % everywhere — that is where the bugs live in a config-precedence-
heavy codebase. `grid-angular` at 73 % line / 76 % function coverage is the outlier and is also the
adapter with no `typecheck` target (by design — ngc covers it) and the most bespoke wiring
(`registerFeatureConfigPreprocessor`, `registerTemplateBridge`).

Fallow flags two files as "complex functions with no test coverage path":
`core/internal/inference.ts` (2 functions) and `plugins/tree/tree-detect.ts` (4 functions).
`inference.ts` is `#384`-new and sits directly on the config-precedence path — prioritise it.

---

## 5. Performance

### Verdict: architecturally competitive with AG Grid / SlickGrid, and already measured

The design choices are the right ones and are documented with rationale:

- **Single-RAF phase scheduler** (STYLE → VIRTUALIZATION → HEADER → ROWS → COLUMNS → FULL,
  descending execution, requests merge upward) instead of microtask or sync rendering.
- **Row pooling + variable-height position cache** with binary-search offset lookup, and
  `MAX_ELEMENT_HEIGHT_PX` scroll mapping for >986 k rows (the Chromium 2^25 element-height cap) —
  a detail most grids get wrong.
- **Lazy `_rowIdMap`** — deferring the O(n) rebuild took initial render at 1 M rows from 175 ms to
  35 ms (5×).
- **Schwartzian-transform sorting** in both `sortInPlace` (dotted/accessor columns) and MultiSort
  (`Uint32Array` index permute, module-level cached `Intl.Collator`), with the inline fast path
  preserved for plain fields.
- **Deliberate anti-abstraction in hot paths**: `patchCellContent` keeps 8 flat parameters
  specifically to avoid a per-cell options-object allocation, and this is _documented_ as an
  accepted fallow finding. That is mature engineering judgement.
- **Compiled field readers** (`createFieldReader`) with a dotted-keys-only cache — after
  PivotPlugin's runtime-minted field names grew the cache unbounded.
- **rAF-coalesced horizontal scroll dispatch**, forced-layout avoidance (geometry reads before
  writes), pooled `ScrollEvent`.
- **`aria-rowindex` write guarded by a cache** (~40 wasted mutations/frame at pool sizes).

### Measured (latest local artifact, 187 benchmarks)

| Operation                                          | Time     | rme   |
| -------------------------------------------------- | -------- | ----- |
| `applySorts` — 3 keys, 100 K rows                  | 162.6 ms | 1.3 % |
| `applySorts` — 2 keys, 100 K rows                  | 115.7 ms | 2.6 % |
| `buildCsv` — 50 K × 6                              | 92.3 ms  | 2.5 % |
| `builtInSort` — numeric, 100 K rows                | 76.8 ms  | 2.0 % |
| `applySorts` — 1 key, 100 K rows                   | 25.7 ms  | 1.8 % |
| `buildPivot` — 2-level, 100 K rows                 | 16.9 ms  | 2.8 % |
| `buildGroupedRowModel` — 2-level, 100 K            | 15.0 ms  | 1.8 % |
| `filterRows` — text contains, 100 K rows           | 5.7 ms   | 1.7 % |
| full pipeline: sort → group → virtualization, 10 K | 5.5 ms   | 4.1 % |

These are good numbers. Single-key sort of 100 K rows in 25.7 ms and text-filter of 100 K rows in
5.7 ms are competitive with anything in the category.

### Head-to-head with competitors already exists

`apps/docs/src/components/demos/competitors/` contains a proper harness benchmarking **AG Grid,
SlickGrid and Tabulator** against Toolbox at 5 K / 100 K / 500 K / 1 M rows, with genuinely careful
methodology: trimmed mean of 5 iterations, `measureVisual` (rAF-settled, so it measures
"time until the DOM reflects the change" not "time to schedule work"), Fisher-Yates shuffle before
sorts (so sorting is real O(n log n), not O(n) reverse-of-sorted), a 17 ms noise floor, and DOM
node counting through open shadow roots as a memory proxy. This is better methodology than most
vendor benchmarks.

### Findings

#### P1 — Multi-key sort is the standout hot spot (MEDIUM)

3-key sort of 100 K rows is **162.6 ms** — 6.3× the single-key cost (25.7 ms) for 3× the keys, so
the per-link overhead is super-linear. The Schwartzian transform already extracts keys once, so the
remaining cost is comparator dispatch per link. Worth a profile: a pre-compiled comparator
specialised on `(keyCount, types)` — or packing numeric keys into a typed array and sorting with a
single fused comparison — could plausibly halve it. `buildCsv` at 92 ms / 50 K rows is the second
target (string concatenation; a chunked writer or `Array.join` per row-block would help).

#### P2 — No perf regression gate on the competitor harness (LOW)

The competitor benchmark is a docs _demo_ — it runs in a browser when a reader opens the page. It
produces no artifact and gates nothing. Consider a nightly job that runs it headless and records
the ratios, so "we are 1.4× AG Grid on 1 M-row sort" becomes a _tracked_ claim rather than a
point-in-time screenshot.

#### P3 — Bench regression gating is soft (INFORMATIONAL)

CI computes regressions but omits `--fail-on-regression`, with `BENCH_ITERATIONS=1`. The
methodology (max-of-N on `hz`, tag-anchored baseline, same-runner sequential measurement,
moe-overlap disjointness check) is sound — it just isn't enforcing. Given a 30 % threshold and
overlap checking, turning it hard for `libs/grid` core benches only would be low-noise.

---

## 6. Dead code & duplication

| Signal                    | Count | Assessment                                                     |
| ------------------------- | ----- | -------------------------------------------------------------- |
| Unused files (in `libs/`) | 23    | **All false positives** — now declared as fallow entry points  |
| Unused exports (`libs/`)  | 6     | Published adapter hooks; untested, not dead (D3)               |
| Unused class members      | 55    | Public API (D2) or duck-typed seams; 5 genuinely dead, removed |
| Duplicate exports         | 8     | 3 real (I2), 4 by-design (`_Augmentation` ×25 is the pattern)  |
| Duplication               | 5.7 % | 8 165 / 142 819 lines; concentrated in adapters (I1)           |
| Circular dependencies     | 0     | ✅                                                             |
| Unused production deps    | 0     | ✅                                                             |

**Configured away:** the 23 "unused files" were `grid-{react,vue}/src/features/*.ts` and
`grid-angular/src/lib/{directives,interfaces}/index.ts` — all published subpath entry points
(`./features/*` in the adapter `package.json` `exports`). Fallow isn't reading the adapters'
`vite.config.mts` `build.lib.entry`, so `.fallowrc.json` now declares them explicitly, along with
`libs/themes/**` and `libs/*/node_modules/**` as ignore patterns. The 7.7 % `dead_file_pct`
(a 1.5-point score penalty) should drop to near zero on the next run.

**Still open:**

- `FocusManager.destroy` — the knowledge base states calling it is a bug (constructor runs once;
  reconnect would leave the trap uninstalled). A method that must never be called should not
  exist. Verify no adapter calls it by name before deleting.
- 3 unused devDependencies at the root: `typedoc-plugin-markdown`, `typescript-eslint`,
  `vite-tsconfig-paths`. Verify against the ESLint/TypeDoc config before removing — these are the
  kind that are loaded by name from a config file rather than imported.

---

## 7. Prioritised recommendations

### Now

1. **D3** — add specs for the six untested published adapter entry points. They are user-facing
   API with zero coverage.
2. **D1** — ship an i18n/`localeText` mechanism. Biggest adoption blocker found.

### Next

3. **I1** — codegen or extract the React↔Vue `feature-props.ts` / `feature-prop-keys.ts`
   duplication (481 identical lines in the largest clone group).
4. **D4** — raise branch coverage, starting with `core/internal/inference.ts`, `tree-detect.ts`,
   and `grid-angular`.
5. **S3 residual** — document the Trusted Types policy; optionally adopt the Sanitizer API where
   available.
6. Delete `FocusManager.destroy` and audit the 3 suspect root devDependencies (§6).

### Then

7. **P1** — profile and optimise multi-key sort (3-key/100 K is 162.6 ms, super-linear in key
   count); **P2** — turn the competitor harness into a tracked nightly metric.
8. **I2 residual** — comment or de-duplicate the remaining same-name type declarations.
9. **M3** — extend `link-grid-dist.ts` to React/Vue to remove the shadowing `node_modules` copies.
10. Watch the core bundle: at 45.81 kB gz it is already past the 45 kB soft-warning line, leaving
    ~4 kB gz before the hard failure.

### Explicitly do NOT do

- Do not "fix" the 8-parameter `patchCellContent` or the inlined sort comparators that fallow
  flags. Both are documented, deliberate, measured performance decisions.
- Do not merge `hasMissingExternalView` / `hasMissingExternalViewCell`.
- Do not chase the 55 "unused class members" as dead code — most are public API or duck-typed
  plugin seams. Grep for the member name as a **string** before deleting anything.
- Do not add an opt-out to `sanitizeHTML`.
- Do not re-attempt tag-based Nx `depConstraints` (see M2) without first changing the
  dist-pointing tsconfig `paths`.

---

## Remediation log — 2026-08-07

Fixed and removed from this document:

| ID     | What changed                                                                                                                                                                                                                     |
| ------ | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **S1** | `TreePlugin` renderer output now sanitized. Two further unsanitized sinks found during the fix and also closed: `GroupingRowsPlugin` group-row renderer and the `ResponsivePlugin` card template.                                |
| **S2** | `formatDelimitedValue` neutralises `= + - @ TAB CR` in CSV export and clipboard copy, default on, opt-out via `escapeFormulas`. Also fixed a latent bug where CSV quoted on a hardcoded `,` instead of the configured delimiter. |
| **S3** | `sanitizeToFragment()` + `setSanitizedHTML()` added; 16 call sites migrated to `replaceChildren`, removing the parse→serialise→reparse mXSS vector. `math` added to `DANGEROUS_TAGS`.                                            |
| **S4** | `evalTemplateString` HTML-escapes interpolated values while leaving author template markup intact.                                                                                                                               |
| **S5** | `escapeHtml` de-duplicated — `clipboard-payload.ts` imports the core one.                                                                                                                                                        |
| **M1** | `#370` ESLint guard widened from `plugins/shell` to all `plugins/*`; passes with zero production violations.                                                                                                                     |
| **I2** | `formatCsvValue`/`formatCellValue` merged into one `formatDelimitedValue` (57-line clone removed); both kept as thin wrappers for existing callers.                                                                              |
| —      | New ESLint `no-restricted-syntax` rule makes unsanitized `innerHTML =` a build failure.                                                                                                                                          |
| —      | Dead code removed: `ConfigManager.onChange`/`notifyChange` + `#changeListeners`, `RowManager.resolveRowId`/`getRowEntry`.                                                                                                        |
| —      | `.fallowrc.json`: adapter subpath entry points, `libs/themes/**` + `libs/*/node_modules/**` ignores, `lightningcss` allowed.                                                                                                     |

New regression specs: `core/internal/sanitize-security.spec.ts`,
`plugins/shared/data-collection-security.spec.ts`.

Validation: 0 lint errors; 3 873 grid + 381 react + 343 vue + 529 angular tests pass;
`index.js` 155.05 kB raw / 45.81 kB gz (baseline 155.22 / 45.81 — net neutral, marginally smaller).

**Corrections to the original audit made during remediation:**

- The bundle figure of "145.11 kB raw / 42.46 kB gz" was wrong; the true pre-change baseline was
  **155.22 kB / 45.81 kB gz**, i.e. already past the soft-warning line.
- "Genuinely removable" over-counted: `refreshDetailRenderer`, `emitTransfer` and
  `disposeShellState` are live via duck-typed plugin seams (see D2).
- D3's hooks are published API, not dead exports (see D3).
- M2 as specified is not achievable (see M2).
