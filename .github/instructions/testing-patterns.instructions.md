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
