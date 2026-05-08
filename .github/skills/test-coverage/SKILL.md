---
name: test-coverage
description: Analyze test coverage for a specific file or project in the toolbox-web monorepo and generate tests to improve coverage. Follows project test patterns (co-located specs, Vitest, happy-dom).
argument-hint: <file-or-project-path>
---

# Improve Test Coverage

Analyze test coverage for the specified file or project and write **Vitest tests** to improve it.

**Scope:** Both unit tests and integration tests are in scope, with **unit tests as the primary focus**. Prefer writing a focused unit test against the smallest testable surface (a function, method, or class in isolation with mocked collaborators). Add an integration test only when the behaviour under test crosses module boundaries (e.g. full grid lifecycle, plugin + render scheduler interaction) and a unit test cannot meaningfully exercise it. End-to-end (Playwright) tests are out of scope — see the note below.

## Critical Rules at a Glance

Follow these in priority order. Later rules never override earlier ones.

| Priority | Rule                                                                                                                                              | Why it matters                                          |
| -------- | ------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------- |
| **P1**   | Use **Vitest** with the **happy-dom** environment. Never introduce Jest, Mocha, or jsdom.                                                         | Toolchain consistency; CI runs Vitest only.             |
| **P2**   | Tests are **co-located** with the source file (`foo.ts` → `foo.spec.ts`, same directory).                                                         | Discoverability; matches `vitest.workspace.ts` globs.   |
| **P3**   | Run via Nx (`bun nx test <project>`), never Vitest directly. Add `--coverage` to measure.                                                         | Honours project config, caching, and CI parity.         |
| **P4**   | Prefer **unit tests** with mocked collaborators. Add an integration test only when crossing module boundaries.                                    | Fast, focused failures; lower maintenance burden.       |
| **P5**   | Project coverage thresholds (statements, branches, functions, lines) **must still pass** after your changes.                                      | CI fails the build otherwise.                           |
| **P6**   | Follow the per-library patterns in **Step 3** (mock grid for plugins, `waitUpgrade` for integration, `Object.create` for Angular services, etc.). | Consistency with existing tests; avoids known footguns. |

> **E2E tests** are covered separately by the `e2e-testing` instruction file (auto-applied when editing `e2e/` or `apps/docs-e2e/` files). This skill focuses on Vitest-based unit and integration tests only.

> **Coverage thresholds** are enforced per project (statements, branches, functions, lines) in each project's vite/vitest config. CI runs `--coverage` and fails if thresholds are not met. When adding tests, ensure thresholds still pass. To ratchet thresholds upward after improving coverage, update the `thresholds` block in the project's config.

## Step 1: Run Coverage Analysis

Use the VS Code test runner with coverage mode, or run via terminal:

```bash
# For the grid library
bun nx test grid --coverage

# For a specific project
bun nx test grid-angular --coverage
bun nx test grid-react --coverage
bun nx test grid-vue --coverage
```

## Step 2: Identify Gaps

Review the coverage report to identify uncovered:

- **Branches** (if/else, switch, ternary)
- **Functions** (methods, callbacks, handlers)
- **Lines** (especially error handling, edge cases)

## Step 3: Write Tests

### Test File Location

Tests are **co-located** with source files:

- `feature.ts` → `feature.spec.ts` (same directory)
- Integration tests: `libs/grid/src/__tests__/integration/`

### Test Patterns by Library

#### Grid Core (`libs/grid/`)

```typescript
import { describe, expect, it, vi, beforeEach, afterEach } from 'vitest';

// Unit test (pure functions)
describe('myFunction', () => {
  it('should handle normal input', () => {
    expect(myFunction(input)).toBe(expected);
  });
});

// Integration test (full component lifecycle)
import { waitUpgrade, nextFrame } from '../../test/utils';

describe('Grid feature', () => {
  afterEach(() => {
    document.body.innerHTML = '';
  });

  it('should work end-to-end', async () => {
    const grid = document.createElement('tbw-grid') as any;
    document.body.appendChild(grid);
    await waitUpgrade(grid);
    grid.rows = [{ id: 1, name: 'Alice' }];
    await nextFrame();
    // Assert DOM state
  });
});
```

#### Grid Plugins

Use mock grid objects to test plugins in isolation:

```typescript
function createMockGrid(overrides = {}) {
  return {
    rows: [],
    sourceRows: [],
    columns: [],
    _visibleColumns: [],
    effectiveConfig: {},
    gridConfig: {},
    getPlugin: () => undefined,
    query: () => [],
    addEventListener: vi.fn(),
    removeEventListener: vi.fn(),
    dispatchEvent: vi.fn(() => true),
    requestRender: vi.fn(),
    children: [document.createElement('div')],
    querySelectorAll: () => [],
    querySelector: () => null,
    clientWidth: 800,
    classList: { add: vi.fn(), remove: vi.fn() },
    ...overrides,
  };
}
```

#### Angular Adapter (`libs/grid-angular/`)

- Use `Object.create(Class.prototype)` pattern to test class methods directly for service classes
- Test Angular directives with mock ElementRef and template context

#### React Adapter (`libs/grid-react/`)

- Use `@testing-library/react` with `render()` for component tests
- Mock grid element with `vi.fn()` for hooks and adapter tests

#### Vue Adapter (`libs/grid-vue/`)

- Use `@vue/test-utils` with `mount()` for component tests
- Test composables by checking function types (avoid calling methods that need `gridElement.value` outside component context)
- Use `defineComponent` wrapper for composable tests

### Key Testing Rules

1. **Always `afterEach(() => { document.body.innerHTML = '' })`** for DOM cleanup
2. **Always `await waitUpgrade(grid)`** after creating grid elements
3. **Use `await nextFrame()`** after data changes to wait for rendering
4. **Mock `document.execCommand`** when testing clipboard (not in happy-dom)
5. **Run tests through Nx**: `bun nx test grid --testFile=path/to/spec.ts`
6. **Never use `npx vitest`** directly — always use `bun nx test <project>`

## Step 4: Verify

Run the tests to ensure they pass:

```bash
bun nx test <project>
```

Then re-run coverage to confirm improvement.
