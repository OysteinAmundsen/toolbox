---
applyTo: '**/*.spec.ts'
---

# Testing Patterns

Tests are co-located with source files (`feature.ts` → `feature.spec.ts`). Integration tests live in `src/__tests__/integration/`. Run via `bun nx test grid`. See the `test-coverage` skill for detailed patterns, mock grid templates, and library-specific guidance.

## Key Conventions

- **Wait for component upgrade**: Always call `await waitUpgrade(grid)` after creating a grid element in tests
- **Test isolation**: Clean up DOM with `afterEach(() => { document.body.innerHTML = '' })`
- **Use `nextFrame()`**: For assertions that depend on a render cycle completing
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
| `virtualization.bench.ts` | `rebuildPositionCache`, `getRowIndexAtOffset`, `updateRowHeight` |
| `aggregators.bench.ts` | `aggregatorRegistry.run`, `runValueAggregator` (sum/avg/min/max/count) |
| `grouping-rows.bench.ts` | `buildGroupedRowModel` (single/multi-level, expanded, high cardinality) |
| `config.bench.ts` | `inferColumns`, `mergeColumns` |
