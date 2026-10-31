---
applyTo: '**/*.spec.ts'
---

# Testing Patterns

> **happy-dom bubbling re-enters ancestor `dispatchEvent`.** A mock grid element that stubs `grid.dispatchEvent = vi.fn()` swallows every event bubbling up from its children, so listeners bound on the host never fire — use `vi.spyOn(grid, 'dispatchEvent')` instead, or `delete mockGrid.dispatchEvent` when the test does not need to observe emissions at all. For the same reason a host listener is invoked once per ancestor hop, so assert on the _delta_ between two dispatches rather than an absolute call count.

Tests are co-located with source files (`feature.ts` → `feature.spec.ts`). Integration tests live in `src/__tests__/integration/`. Run via `bun nx test grid`. See the `test-coverage` skill for detailed patterns, mock grid templates, and library-specific guidance.

## Key Conventions

- **Wait for component upgrade**: Always call `await waitUpgrade(grid)` after creating a grid element in tests
- **Test isolation**: Clean up DOM with `afterEach(() => { document.body.innerHTML = '' })`
- **Use `nextFrame()`**: For assertions that depend on a render cycle completing
- **Sync→async refactoring breaks assertions**: When a method is changed from synchronous to async (e.g., `refresh()` delegating to `setDataSource()`), tests that assert immediately after calling it will fail. Wrap in `await vi.waitFor(() => ...)` to poll until the async operation completes.
- **Never use `setTimeout(0)` to wait for React 19 commits under happy-dom**: React's concurrent renderer can defer the commit across multiple microtask/macrotask cycles, especially when `react`/`react-dom` are loaded via dynamic `import()` in `beforeEach`. A single fixed tick is flaky. Poll with `vi.waitFor(() => container.querySelector(sel))` or a small `waitForEl(container, selector)` helper that retries every ~5 ms for up to 2 seconds (or 1 second — match `vi.waitFor`'s default timeout). The first DOM read failing cascades into all dependent assertions appearing broken.
- **Wait for the new data, not for time, before asserting a refetch kept an order** — when the expected order equals the pre-refetch order (e.g. "the server's order is preserved"), a fixed sleep or a wait on the request being _sent_ can pass against the old rows that are still on screen. Snapshot the shown row objects (`new Set(grid.rows)`), trigger, then `vi.waitFor` until none of them remain (the data source builds new objects per call), and only then assert. Reference helper: `refetch()` in `integration/tree-server-side-sorting.spec.ts`.
- **Mock grid DOM must mirror real hierarchy** — When a plugin spec creates a fake grid element to test DOM-mutation logic, replicate the real nesting (`.tbw-scroll-area > .rows-body-wrapper > .rows-body > .header`) rather than flattening it. A flat mock will let `querySelector('.header')` succeed but mask `insertBefore`/`appendChild` bugs that depend on the parent-of-reference-node relationship. Verified the PinnedRowsPlugin top-position regression — the bug shipped because the spec placed `.header` directly inside `.tbw-scroll-area`.
- **Type mock stubs so the partial-mock cast stays single** — `as unknown as` is banned in specs too (see `typescript-conventions`). Two habits make it avoidable: (1) declare the mock's parameters — `vi.fn((_event: Event) => true)` instead of `vi.fn(() => true)` — so `mock.calls` is `[Event][]` and a call arg needs only one direct `as CustomEvent<Detail>`; a parameterless `vi.fn()` yields `[][]`, which cannot be indexed at all. (2) Type a stubbed DOM method as the plain callable the code actually invokes (`scrollTo: (options: ScrollToOptions) => void`), never `ReturnType<typeof vi.fn>` — a `Mock` is not comparable to the real overloaded method, so it forces the whole partial mock through `as unknown as T` instead of a single `as T`. Missing properties never block an `as T` cast; incompatible present ones do.
- **Don't cast to reach `_`-prefixed grid state — it is already typed** — `DataGridElement implements InternalGrid`, so plugin-accessible members (`_virtualization: VirtualState`, `_bodyEl`, `_rows`, `_visibleColumns`, …) are public on the element type. A spec holding a `DataGridElement<TRow>` reads `grid._virtualization.positionCache` directly; a local `as unknown as { _virtualization: { … } }` helper only re-declares a shape TS already knows and survives a rename of the real field.
- **Stub `clientHeight` with `Object.defineProperty` on a real element** — happy-dom has no layout engine and reports `0`. Prefer `const el = document.createElement('div'); Object.defineProperty(el, 'clientHeight', { value: 300 })` over a `{ clientHeight: 300 } as unknown as HTMLElement` object literal.
- **happy-dom's `composedPath()` is rebuilt from the target's CURRENT ancestry on every call** (and stays non-empty after dispatch) — browsers snapshot the path when dispatch begins and return `[]` afterwards. A test where a listener detaches the target mid-bubble therefore sees a one-node path in happy-dom and passes/fails for the wrong reason. Wrap the event in `withDispatchPath(event, target)` from `test/helpers.ts` to get the browser semantics (#585 `/qa-pr`). Corollary for production code: never store an event to read its path later — capture what you need while it dispatches.
- **Run via Nx**: `bun nx test grid` or `bun nx test grid file.spec.ts` (positional substring filter, no `--`; Vitest 4 rejects `--testFile`) — never invoke Vitest directly. The editor's built-in test runner skips the project's happy-dom environment, so every grid spec fails with `document is not defined`; that is not a real failure. When redirecting output to a file, add `--output-style=static` — otherwise Nx writes only its summary and the Vitest counts/failures are lost. Never combine a spec filter with other targets (`run-many -t lint test -- file.spec.ts`): the args after `--` reach every target, so ESLint fails with `No files matching the pattern`. Run the filtered `test` alone and lint separately.
- **Wall-clock perf asserts flake under `run-many` load** — `filtering.spec.ts > Performance` (e.g. `should filter 10K rows in under 10ms`) fails intermittently when `test` runs alongside `build`. Before treating it as a regression, re-run `bun nx test grid` alone; Nx then reports "flaky task".
- **Prove a regression test against the old source byte-exactly** — cheapest: `git stash push -q -- <source paths>` (NOT the spec), run the spec, `git stash pop -q` (#585 — 7/7 new tests red, then green). To revive one file instead, back it up, then `cmd /c "git show HEAD:<posix-path> > <win-path>"`, run the spec, restore from the backup. PowerShell `>` / `Set-Content` re-encodes the UTF-8 stream, so the old file fails to parse (`PARSE_ERROR … Expected '}' but found EOF`) instead of reproducing the bug. When the fix is a one-line behaviour swap, `$c.Replace(new, old)` on the `Get-Content -Raw` string + `Set-Content -NoNewline` and restoring the original string is enough. Never preset the state you assert (e.g. `grid._focusRow = 0` then `expect(_focusRow).toBe(0)`) — the test passes vacuously; assert a value only the fix can produce (#526 focus test). A **negative-only assertion** (`not.toHaveBeenCalled()`, `toBeNull()`) is vacuous too — it also passes when the feature is broken outright; pair it in the same test with a positive control that fires the identical event on an own target and asserts the effect (#585 `/qa`).
- **DOM environment**: Tests use `happy-dom` (configured in vitest workspace)
- **Bun runtime**: This repo uses Bun; some Node-specific patterns may not work

## Test Helpers (`test/helpers.ts`)

**Import these — never redefine them inline in a spec** (no code duplication, tests included; #542 migrated the last 36 specs that carried inline copies, some under other names like `settle`/`waitForReady` — `bunx fallow dupes` flags new ones). The helpers' own spec, `test/helpers.spec.ts`, runs because the grid vitest `include` covers `test/**/*.spec.ts` — in `grid`, a spec outside `src/**` or `test/**` is silently never run (each project's `include` in its own `vite.config.ts` decides).

- **`createGrid()`** — Creates a `<tbw-grid>` element, appends it to `document.body`, and returns it. Use for setting up test fixtures.
- **`waitUpgrade(grid)`** — `whenDefined('tbw-grid')` → `grid.ready()` → two `nextFrame()`s. The spec must still import `core/grid` (e.g. `import '../../core/grid'`) so the element is defined. Never poll `data-upgraded` instead: it is set synchronously in `#afterConnect()`, before the scheduler's first flush resolves `ready()`, so `ready()` already implies it (the old polling copies just added a 3 s worst-case stall). Calling `forceLayout()` on top is likewise unnecessary straight after upgrade.
- **`nextFrame(frames = 1)`** — Resolves after `frames` consecutive animation frames. Use `nextFrame(2)` where a spec needs a double-rAF settle — never a local `requestAnimationFrame(() => requestAnimationFrame(r))` wrapper.
- **`rafDebounce(fn)`** — RAF-based debounce wrapper with `.cancel()` support. Ensures callback runs at most once per animation frame.
- **Nested-grid isolation specs → `test/nested-grid.ts`** (#581): `useParentGrid()` (registers the body-reset `beforeEach`/`afterEach`, exposes `.parent`), `mountNestedGrid(parent, { parentPlugins, childPlugins })` (child `<tbw-grid>` in row 0's MasterDetail panel), and the ownership-filtered `ownCell(grid, row, col)` / `ownRows(grid)`. Never query a parent's cells with a `:scope > .tbw-grid-root .rows …` selector — `.rows` is a descendant match and picks the child's cell for any `(row, col)` both grids render.

## DOM Testing Guidelines

All DOM-, CSS-, and happy-dom-environment quirks are grouped here. Check this section first when an assertion against the DOM fails unexpectedly.

### CSS & inline-import quirks

- **`?inline` CSS imports return empty strings** in Vitest/happy-dom. Test that `plugin.styles` is a defined string (`typeof plugin.styles === 'string'`), not its content.
- **New CSS properties** (e.g. `anchor-name`) are not in TypeScript's `CSSStyleDeclaration`. Use `style.setProperty('anchor-name', value)` / `style.removeProperty('anchor-name')` in source, and `style.getPropertyValue('anchor-name')` in assertions.

### Missing browser APIs in happy-dom

- **Per-test `matchMedia` stubs don't reach `getPrimaryPointer()`** — `core/internal/pointer-modality.ts` caches ONE shared `MediaQueryList` module-level on first use, so a later `vi.stubGlobal('matchMedia', …)` is ignored. Drive coarse/fine behaviour through the event's `pointerType` instead (`Object.defineProperty(event, 'pointerType', { value: 'touch' })`).
- **Popover API** (`showPopover`/`hidePopover`) is not available in happy-dom. Use `supportsPopover()` guards in the plugin and test `popover.textContent` rather than popover visibility state.
- **`KeyboardEvent` works in happy-dom** — construct it for real (`new KeyboardEvent('keydown', { key: 'F10', shiftKey: true, bubbles: true })`) and dispatch it on the grid host to exercise the full key pipeline. An object literal cast (`{ key: 'Enter' } as KeyboardEvent`) is only for calling a hook such as `plugin.onKeyDown(...)` directly — it cannot be dispatched.
- **`select.selectedOptions` is stale in happy-dom** — once read, the cached collection misses later programmatic `option.selected` writes. Assert selection via `Array.from(select.options).map((o) => o.selected)`, and never read `selectedOptions` in source code.

### Event-dispatch quirks

- **`dispatchEvent` fires extra events**: Spying on `dispatchEvent` may show more calls than expected (e.g., 3 instead of 1) because happy-dom dispatches additional internal events. Use `addEventListener` on the specific event type instead of spying on `dispatchEvent`.

## Adapter Test Gotchas

- **React lowercases custom element attributes**: React renders camelCase props as lowercase DOM attributes (e.g., `cardRowHeight` → `cardrowheight`). Use `getAttribute('cardrowheight')` in assertions.
- **No `@testing-library/react`**: The grid-react project uses `react-dom/client` `createRoot` directly for component rendering tests. See the `test-coverage` skill for patterns.

## Angular Directive Real-Class Spec Pattern

Directives that depend on Angular DI primitives (`inject`, `effect`, `input`, `input.required`, `output`, `afterNextRender`) are unit-tested by mocking those primitives via `vi.mock('@angular/core', …)` and instantiating the class with `new` — **no TestBed**. Reference implementations: `directives/grid-form-array.directive.spec.ts`, `directives/grid-lazy-form.directive.spec.ts`.

Recipe:

- Mock `inject` with a per-test `mockInjectResolver` swap.
- Mock `input` / `input.required` with a `(initial?) => () => value` factory exposing `__setValue`.
- Mock `output` with `() => ({ emit, emissions: [] })` so tests can assert emissions.
- Mock `afterNextRender` with `(cb) => { pending = cb; }` and trigger `pending()` manually.
- Mock `effect` with a no-op when the directive uses effects only for side-effect plumbing.
- ALWAYS spread `await vi.importActual('@angular/core')` first and override only the primitives the directive uses. Without actuals, `@angular/forms` (used by spec helpers) breaks because `EventEmitter`, `InjectionToken`, etc. are missing.
- ALWAYS `import '@angular/compiler';` at the top of the spec, before any other Angular import. Without it, vitest fails with "JIT compilation failed" on first directive instantiation.
- For `getOrCreate*` lazy patterns: call a public method that materialises (`ctx.getRowFormGroup(0)`), then assert cache via `directive.getAllFormGroups().size` or re-call to verify the factory ran once.
- DO NOT use `coverage.exclude` to prop up the 70% threshold. Write real specs instead — a refactor that expands V8's measurement scope is exposing a real coverage gap, not a config problem.
- **Thin feature directives (claims + output wiring only):** skip the ~80-line `@angular/core` + `@angular/forms` mock block. Replace the barrel with the real registry, `vi.mock('@toolbox-web/grid-angular', () => import('../../../src/lib/internal/feature-claims'))`, so `@angular/forms` never loads; then `@angular/core` needs only `Directive`, `ElementRef`, `inject`, `input`, `output`. Reference: `features/undo-redo/src/grid-undo-redo.directive.spec.ts`.

## Vitest Benchmarks

Co-located benchmark files (`feature.ts` → `feature.bench.ts`) measure pure computational hot paths using `vitest bench` (tinybench). Run via `bun nx bench grid`.

- **Co-located**: Place `.bench.ts` next to the source file being benchmarked
- **Pure functions only**: Benchmark sorting, filtering, virtualization, grouping — not DOM rendering (use e2e for that)
- **Use `describe` + `bench`**: Group related benchmarks in `describe` blocks, use `bench()` for each case
- **Scale testing**: Test at multiple dataset sizes (1K, 10K, 100K rows) to verify algorithmic complexity
- **No DOM**: happy-dom has no layout engine — DOM timing is meaningless in Vitest

Existing benchmark files:

| File                             | Hot paths benchmarked                                                                                                                                            |
| -------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `sorting.bench.ts`               | `defaultComparator`, `builtInSort` (string/numeric/custom comparator)                                                                                            |
| `filter-model.bench.ts`          | `filterRows` (text/numeric/set/multi-AND), `matchesFilter`                                                                                                       |
| `virtualization.bench.ts`        | `rebuildPositionCache`, `getRowIndexAtOffset`, `updateRowHeight`, `computeVirtualWindow`                                                                         |
| `aggregators.bench.ts`           | `aggregatorRegistry.run`, `runValueAggregator` (sum/avg/min/max/count)                                                                                           |
| `grouping-rows.bench.ts`         | `buildGroupedRowModel` (single/multi-level, expanded, high cardinality)                                                                                          |
| `config.bench.ts`                | `inferColumns`, `mergeColumns`                                                                                                                                   |
| `pivot-engine.bench.ts`          | `buildPivot`, `flattenPivotRows`, `sortPivotMulti` (single/multi-level, multiple value fields)                                                                   |
| `tree-data.bench.ts`             | `flattenTree`, `expandAll` (balanced/wide trees, varying depth/expansion)                                                                                        |
| `column-virtualization.bench.ts` | `computeColumnOffsets`, `getVisibleColumnRange`, `getColumnWidths` (50–500 columns)                                                                              |
| `pinned-columns.bench.ts`        | `reorderColumnsForPinning`, `hasStickyColumns`, `getLeftStickyColumns`                                                                                           |
| `grouping-columns.bench.ts`      | `computeColumnGroups`, `resolveColumnGroupDefs`, `mergeGroups`                                                                                                   |
| `master-detail.bench.ts`         | `isDetailExpanded`, `expandDetailRow`, `collapseDetailRow`                                                                                                       |
| `datasource.bench.ts`            | `getBlockNumber`, `getRequiredBlocks`, `getRowFromCache`, `isBlockLoaded`                                                                                        |
| `render-pipeline.bench.ts`       | Combined pipeline benchmarks: sort→filter→virtualization, sort→grouping, tree→virtualization, pivot→flatten→virtualization, column pinning→column-virtualization |
