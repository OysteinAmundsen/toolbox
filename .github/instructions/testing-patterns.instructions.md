---
applyTo: '**/*.spec.ts'
---

# Testing Patterns

Tests are co-located with source files (`feature.ts` → `feature.spec.ts`). Integration tests live in `src/__tests__/integration/`. Run via `bun nx test grid`. See the `test-coverage` skill for detailed patterns, mock grid templates, and library-specific guidance.

## Key Conventions

- **Wait for component upgrade**: Always call `await waitUpgrade(grid)` after creating a grid element in tests
- **Test isolation**: Clean up DOM with `afterEach(() => { document.body.innerHTML = '' })`
- **Use `nextFrame()`**: For assertions that depend on a render cycle completing
- **Sync→async refactoring breaks assertions**: When a method is changed from synchronous to async (e.g., `refresh()` delegating to `setDataSource()`), tests that assert immediately after calling it will fail. Wrap in `await vi.waitFor(() => ...)` to poll until the async operation completes.
- **Never use `setTimeout(0)` to wait for React 19 commits under happy-dom**: React's concurrent renderer can defer the commit across multiple microtask/macrotask cycles, especially when `react`/`react-dom` are loaded via dynamic `import()` in `beforeEach`. A single fixed tick is flaky. Poll with `vi.waitFor(() => container.querySelector(sel))` or a small `waitForEl(container, selector)` helper that retries every ~5 ms with a deadline. The first DOM read failing cascades into all dependent assertions appearing broken.
- **Mock grid DOM must mirror real hierarchy** — When a plugin spec creates a fake grid element to test DOM-mutation logic, replicate the real nesting (`.tbw-scroll-area > .rows-body-wrapper > .rows-body > .header`) rather than flattening it. A flat mock will let `querySelector('.header')` succeed but mask `insertBefore`/`appendChild` bugs that depend on the parent-of-reference-node relationship. Verified the PinnedRowsPlugin top-position regression — the bug shipped because the spec placed `.header` directly inside `.tbw-scroll-area`.
- **Run via Nx**: `bun nx test grid` or `bun nx test grid --testFile=src/lib/.../file.spec.ts` — never invoke Vitest directly
- **DOM environment**: Tests use `happy-dom` (configured in vitest workspace)
- **Bun runtime**: This repo uses Bun; some Node-specific patterns may not work

## Test Helpers (`test/helpers.ts`)

- **`createGrid(config?)`** — Creates a `<tbw-grid>` element, appends it to `document.body`, and returns it. Use for setting up test fixtures.
- **`rafDebounce(fn)`** — RAF-based debounce wrapper with `.cancel()` support. Ensures callback runs at most once per animation frame.

## CSS & Style Testing

- **`?inline` CSS imports return empty strings** in Vitest/happy-dom. Test that `plugin.styles` is a defined string (`typeof plugin.styles === 'string'`), not its content.
- **New CSS properties** (e.g. `anchor-name`) are not in TypeScript's `CSSStyleDeclaration`. Use `style.setProperty('anchor-name', value)` / `style.removeProperty('anchor-name')` in source, and `style.getPropertyValue('anchor-name')` in assertions.
- **Popover API** (`showPopover`/`hidePopover`) is not available in happy-dom. Use `supportsPopover()` guards in the plugin and test `popover.textContent` rather than popover visibility state.
- **`KeyboardEvent` constructor** is not available in happy-dom. Use object literals cast to `KeyboardEvent` instead: `{ key: 'Enter' } as KeyboardEvent`.

## happy-dom Quirks

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

## Vitest Benchmarks

Co-located benchmark files (`feature.ts` → `feature.bench.ts`) measure pure computational hot paths using `vitest bench` (tinybench). Run via `bun nx bench grid`.

- **Co-located**: Place `.bench.ts` next to the source file being benchmarked
- **Pure functions only**: Benchmark sorting, filtering, virtualization, grouping — not DOM rendering (use e2e for that)
- **Use `describe` + `bench`**: Group related benchmarks in `describe` blocks, use `bench()` for each case
- **Scale testing**: Test at multiple dataset sizes (1K, 10K, 100K rows) to verify algorithmic complexity
- **No DOM**: happy-dom has no layout engine — DOM timing is meaningless in Vitest

Existing benchmark files:
| File | Hot paths benchmarked |
|------|----------------------|
| `sorting.bench.ts` | `defaultComparator`, `builtInSort` (string/numeric/custom comparator) |
| `filter-model.bench.ts` | `filterRows` (text/numeric/set/multi-AND), `matchesFilter` |
| `virtualization.bench.ts` | `rebuildPositionCache`, `getRowIndexAtOffset`, `updateRowHeight`, `computeVirtualWindow` |
| `aggregators.bench.ts` | `aggregatorRegistry.run`, `runValueAggregator` (sum/avg/min/max/count) |
| `grouping-rows.bench.ts` | `buildGroupedRowModel` (single/multi-level, expanded, high cardinality) |
| `config.bench.ts` | `inferColumns`, `mergeColumns` |
| `pivot-engine.bench.ts` | `buildPivot`, `flattenPivotRows`, `sortPivotMulti` (single/multi-level, multiple value fields) |
| `tree-data.bench.ts` | `flattenTree`, `expandAll` (balanced/wide trees, varying depth/expansion) |
| `column-virtualization.bench.ts` | `computeColumnOffsets`, `getVisibleColumnRange`, `getColumnWidths` (50–500 columns) |
| `pinned-columns.bench.ts` | `reorderColumnsForPinning`, `hasStickyColumns`, `getLeftStickyColumns` |
| `grouping-columns.bench.ts` | `computeColumnGroups`, `resolveColumnGroupDefs`, `mergeGroups` |
| `master-detail.bench.ts` | `toggleDetailRow`, `isDetailExpanded`, `expandDetailRow`, `collapseDetailRow` |
| `datasource.bench.ts` | `getBlockNumber`, `getRequiredBlocks`, `getRowFromCache`, `isBlockLoaded` |
| `render-pipeline.bench.ts` | Combined pipeline benchmarks: sort→filter→virtualization, sort→grouping, tree→virtualization, pivot→flatten→virtualization, column pinning→column-virtualization |
