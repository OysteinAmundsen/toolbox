# Copilot Instructions for Toolbox Web

## Project Overview

This is an **Nx monorepo** for building a **suite of framework-agnostic component libraries** using **pure TypeScript web components**. The architecture prioritizes cross-framework compatibility - components work natively in vanilla JS, React, Vue, Angular, etc. without wrappers (though framework-specific adapters may be built separately for enhanced DX).

Currently houses `@toolbox-web/grid` as the flagship component (`<tbw-grid>`), with more libraries planned. The repo uses **Bun** as package manager/runtime, **Vitest** for testing, **Vite** for building, and **Storybook** for component development.

## Skills Reference

Task-specific workflows are documented in dedicated skill files (loaded on demand). Reference these when performing specialized tasks:

| Skill                 | Description                                    | When to use                                           |
| --------------------- | ---------------------------------------------- | ----------------------------------------------------- |
| `new-plugin`          | Create a new grid plugin                       | Adding a plugin with hooks, styles, tests, stories    |
| `bundle-check`        | Verify bundle size budget                      | After code changes that may affect bundle size        |
| `test-coverage`       | Analyze and improve test coverage              | Writing tests, improving coverage for a file          |
| `new-adapter-feature` | Add features across Angular/React/Vue adapters | Ensuring feature parity across framework adapters     |
| `release-prep`        | Pre-release checklist                          | Preparing a library version for release               |
| `storybook-story`     | Create Storybook stories and MDX docs          | Adding demos or documentation for features            |
| `debug-perf`          | Performance investigation                      | Profiling, hot path analysis, render scheduler issues |
| `debug-browser`       | Live browser debugging via Chrome DevTools MCP | DOM inspection, screenshots, console, script eval     |
| `docs-update`         | Documentation update checklist                 | After any feature, fix, or refactor                   |

## Core Development Principles

**Every change must consider these three pillars:**

### 1. Maintainability

- **File size limit**: Keep files under ~2000 lines of code (excluding JSDoc/comments)
- **Single responsibility**: Each module/file should have one clear purpose
- **Extract pure functions**: Move logic to `internal/` modules when it doesn't require `this` access
- **Region organization**: Use `// #region` markers for navigation in large files
- **Clear naming**: Function names should describe what they do, not how

### 2. Bundle Size

- **Core budget**: `index.js` must stay ≤170 kB (≤45 kB gzipped)
- **Tree-shakeable**: Plugins are separate entry points, not bundled in core
- **No dead code**: Remove unused functions, imports, and types immediately
- **Minimize abstraction overhead**: Prefer inline code over creating classes/wrappers for simple operations
- **Audit before adding**: New features must justify their byte cost

### 3. Performance

- **Hot path awareness**: Scroll handlers, cell rendering, and virtualization are hot paths - optimize aggressively
- **Avoid allocations**: Reuse objects in loops (e.g., `#pooledScrollEvent`)
- **Batch DOM operations**: Use `requestAnimationFrame` via the scheduler, never direct RAF calls
- **Minimize DOM queries**: Cache element references, avoid `querySelector` in hot paths
- **Lazy initialization**: Defer work that isn't needed for first paint

**When in doubt:**

- Smaller is better
- Simpler is better
- Faster is better

**Before every PR, verify:**

```bash
bun nx build grid
# Check: index.js ≤170 kB, gzip ≤45 kB
```

## Architecture & Key Components

### Framework-Agnostic Design Philosophy

All libraries in this suite are built as **standard web components** (custom elements) using pure TypeScript:

- **Zero framework lock-in**: Components work in any JavaScript environment (vanilla, React, Vue, Angular, Svelte, etc.)
- **Native browser APIs**: Leverage custom elements, CSS nesting, CSSStyleSheet adoption, and web standards
- **Optional framework adapters**: Future work may include React/Vue/Angular wrappers for improved TypeScript types and framework-specific ergonomics, but core components remain framework-free
- **Shared conventions**: All libraries follow consistent patterns for configuration, theming, testing, and Storybook integration
- **Component prefix**: All web components use `tbw-` prefix (toolbox-web), e.g., `<tbw-grid>`

### API Stability & Breaking Changes

**`@toolbox-web/grid` is now a released library.** Avoid breaking changes to the public API.

**What constitutes a breaking change:**

- Removing or renaming exported types, interfaces, classes, or functions from `public.ts`
- Changing method signatures (adding required parameters, changing return types)
- Removing or renaming public properties/methods on `<tbw-grid>` element
- Removing or renaming CSS custom properties (theming variables)
- Changing event names or payload structures
- Removing or renaming plugin hook methods in `BaseGridPlugin`
- Changing the `disconnectSignal` contract (plugins depend on it for cleanup)

**What is NOT a breaking change:**

- Adding new optional properties, methods, or events
- Internal refactoring that doesn't affect public API
- Bug fixes (even if they change incorrect behavior)
- Adding new exports to `public.ts`
- Performance improvements
- New plugins or plugin features

**When breaking changes are unavoidable:**

1. Document clearly in PR description
2. Update CHANGELOG with migration guide
3. Consider deprecation period with console warnings before removal
4. Bump major version

### Commit Hygiene

Prompt the user to commit at logical stopping points during work sessions. Small, focused commits are preferred over large omnibus commits.

**Before suggesting a commit, review documentation** — use the `docs-update` skill for the full checklist of what to update (READMEs, MDX, llms.txt, copilot-instructions, etc.).

**When to suggest a commit:**

- After each discrete bug fix
- After adding or modifying a single feature
- After updating tests for a specific change
- After documentation updates
- After refactoring a single module or function
- After fixing build/config issues

**Commit message format (Conventional Commits):**

```
type(scope): short description

[optional body with more detail]
```

**Types:** `feat`, `fix`, `refactor`, `test`, `docs`, `build`, `chore`, `perf`

**Scopes:** `grid`, `grid-angular`, `grid-react`, `themes`, `docs`, `demo`

**Examples:**

- `feat(grid): make cell-commit event cancelable`
- `fix(grid): filter utility columns from visibility panel`
- `test(grid): add tests for cancelable events`
- `docs(grid): document cancelable events in API.mdx`
- `refactor(grid): remove unused internal/editing.ts`
- `build(grid): fail on TypeScript errors in vite config`

**Prompt format:** After completing a logical unit of work, suggest:

> 📦 **Good commit point:** `type(scope): description`

### Monorepo Structure

- **`libs/grid/`** - First library in suite; single `<tbw-grid>` component with extensive internal modules
- **`libs/grid-angular/`** - Angular adapter library (`@toolbox-web/grid-angular`) with directives for template-driven column renderers/editors
- **`libs/grid-react/`** - React adapter library (`@toolbox-web/grid-react`) with DataGrid component, hooks, and JSX renderer/editor support
- **`libs/grid-vue/`** - Vue adapter library (`@toolbox-web/grid-vue`) with DataGrid component, composables, and slot-based renderers
- **`libs/*/`** - Additional component libraries will follow same pure TypeScript + web standards pattern
- **`apps/docs/`** - Storybook documentation site with live HMR via Vite
- **`libs/themes/`** - Shared CSS theme system (currently Grid themes; will expand for suite-wide theming)
- **`demos/employee-management/`** - Full-featured demo applications showcasing the grid:
  - `vanilla/` - Pure TypeScript/Vite demo (`demo-vanilla` project)
  - `angular/` - Angular demo using grid-angular adapter (`demo-angular` project)
  - `react/` - React demo using grid-react adapter (`demo-react` project)
  - `vue/` - Vue demo using grid-vue adapter (`demo-vue` project)
  - `shared/` - Shared types and mock data used by all demos

### Grid Component Architecture

The `<tbw-grid>` component ([libs/grid/src/lib/core/grid.ts](libs/grid/src/lib/core/grid.ts)) is a light DOM web component with:

- **Single Source of Truth**: `#effectiveConfig` holds the merged canonical configuration
- **Public API surface** defined in `src/public.ts` - only export types/functions meant for external consumption
- **Internal modules** in `core/internal/` directory that power core features:
  - `columns.ts` - Column config resolution, header rendering, auto-sizing
  - `rows.ts` - Row rendering, virtualization, inline editing
  - `row-group.ts` - Hierarchical row grouping with expand/collapse
  - `keyboard.ts` - Keyboard navigation (arrows, Enter, Escape)
  - `resize.ts` - Column resizing controller
  - `header.ts` - Header row rendering with custom header renderers
  - `aggregators.ts` - Footer aggregation functions (sum, avg, etc.)
  - `sanitize.ts` - Template string evaluation with safety guards
  - `sticky.ts` - Sticky column offset calculations
  - `inference.ts` - Column type inference from data

### Framework Adapters (Angular, React, Vue)

Each adapter auto-registers a framework-specific `GridAdapter` on `<tbw-grid>` elements. See the `new-adapter-feature` skill for full API details, usage examples, and key files for each adapter.

- **Angular** (`@toolbox-web/grid-angular`) — Directives: `Grid`, `TbwRenderer`, `TbwEditor`; Base classes: `BaseGridEditor`, `BaseGridEditorCVA`, `BaseOverlayEditor`, `BaseFilterPanel`
- **React** (`@toolbox-web/grid-react`) — Components: `DataGrid`, `GridColumn`; Hooks: `useGrid`, `useGridEvent`
- **Vue** (`@toolbox-web/grid-vue`) — Components: `DataGrid`, `GridColumn`; Composables: `useGrid`, `useGridEvent`

### Configuration Precedence System (Single Source of Truth)

The Grid follows a **single source of truth** pattern where all configuration inputs converge into `#effectiveConfig`:

**Input Sources → `#mergeEffectiveConfig()` → `#effectiveConfig` (canonical)**

Users can configure via:

- `gridConfig` property - full config object
- `columns` property - shorthand for `gridConfig.columns`
- `fitMode` property - shortcut for `gridConfig.fitMode`
- Light DOM elements (`<tbw-grid-column>`, `<tbw-grid-header>`)

**Precedence (low → high):**

1. `gridConfig` prop (base)
2. Light DOM elements (declarative)
3. `columns` prop (direct array)
4. Inferred columns (auto-detected from first row)
5. Individual props (`fitMode`) - highest

**Internal State Categories:**

- **Input Properties** (`#rows`, `#columns`, `#gridConfig`, `#fitMode`) - raw user input
- **Effective Config** (`#effectiveConfig`) - **THE single source of truth**
- **Derived State** (`_columns`, `_rows`) - result of plugin processing hooks
- **Runtime State** (`#hiddenColumns`, `sortState`) - user-driven changes at runtime

**Key rule**: All rendering logic reads from `effectiveConfig` or derived state, never from input properties.

See `ARCHITECTURE.md` for detailed diagrams and `config-precedence.spec.ts` for test examples.

### Testing Pattern

Tests are co-located with source files (`feature.ts` → `feature.spec.ts`). Integration tests live in `src/__tests__/integration/`. Use `waitUpgrade(grid)` and `nextFrame()` helpers. Run via `bun nx test grid`. See the `test-coverage` skill for detailed patterns, mock grid templates, and library-specific guidance.

### Storybook & Documentation

Stories are co-located with plugins and core features. MDX docs live alongside stories and in `libs/grid/docs/`. Run Storybook: `bun nx serve docs` (port 4400). See the `storybook-story` skill for templates and the `docs-update` skill for the full documentation inventory.

## Critical Workflows

### Development Commands

> **Important**: Always run tasks through **Nx**, never invoke Vitest, Vite, or ESLint directly. Direct invocations (e.g. `npx vitest run …`) will fail or behave unexpectedly because the workspace relies on Nx-configured project paths, environment variables, and plugin resolution.

```bash
# Start Storybook with live reload
bun nx serve docs

# Build Storybook (documentation site)
bun nx build docs

# Build grid library (Vite compilation)
bun nx build grid

# Run all tests
bun run test

# Run tests for specific project
bun nx test grid

# Run a single test file (via Nx, not vitest directly)
bun nx test grid --testFile=src/lib/plugins/visibility/group-drag.spec.ts

# Lint all projects
bun run lint

# Lint + test + build (CI flow)
bun run lint && bun run test && bun run build

# Run single target across affected projects
bun nx affected -t test

# Serve a demo app
bun nx serve demo-vanilla
bun nx serve demo-angular
```

**Common mistakes to avoid:**

- ❌ `npx vitest run path/to/spec.ts` — bypasses Nx config; will fail
- ❌ `bunx vitest …` — same issue
- ❌ `npx eslint …` — use `bun nx lint <project>` instead
- ❌ `npx vite build` — use `bun nx build <project>` instead
- ✅ Always use `bun nx <target> <project>` or `bun run <script>`

### Adding a New Library to the Suite

1. **Create library**: `bun nx g @nx/js:lib libs/[library-name]`
2. **Add Vite config**: Copy pattern from `libs/grid/vite.config.ts`
3. **Structure**: Follow Grid's pattern with `src/public.ts` barrel export, `components/` dir, and `internal/` modules
4. **Update path mappings**: Add to `tsconfig.base.json` paths (e.g., `@toolbox/[library-name]`)
5. **Storybook integration**: Add stories to `libs/[library-name]/stories/`; Storybook auto-discovers via glob
6. **Testing**: Set up Vitest config following `libs/grid/project.json` test target pattern
7. **Theming**: Extend `libs/themes/` with component-specific theme files using suite-wide CSS variables

### Adding a New Feature to Grid (or any library)

1. **Define types** in `types.ts` (public) or as inline types (internal)
2. **Implement logic** in appropriate `internal/*.ts` module (keep pure functions testable)
3. **Add unit tests** co-located with source file (e.g., `feature.ts` → `feature.spec.ts`)
4. **Add integration test** in `src/__tests__/integration/` if it requires full component lifecycle
5. **Create story** in `stories/*.stories.ts` demonstrating the feature
6. **Export public API** in `src/public.ts` if exposing new types/functions

### Web Component Patterns

- **Properties**: Use getters/setters for reactive properties that trigger re-renders
- **State**: Use private fields with `#` prefix for internal state
- **Events**: Use `CustomEvent` with `dispatchEvent()` - consumers listen via `addEventListener('event-name', ...)`
- **Methods**: Public methods callable from JS, use `async` for operations that need component ready
- **Element ref**: Access via `this` (extends HTMLElement)
- **Lifecycle**: `connectedCallback()`, `disconnectedCallback()`, `attributeChangedCallback()`
- **Light DOM**: Render directly to element with CSS nesting (`tbw-grid { }`) for style scoping

### Path Mappings

TypeScript paths defined in `tsconfig.base.json` for all libraries:

```json
"@toolbox-web/grid": ["dist/libs/grid/index.d.ts"],
"@toolbox-web/grid/all": ["dist/libs/grid/all.d.ts"],
"@toolbox-web/grid/*": ["dist/libs/grid/*"],
"@toolbox-web/grid-angular": ["dist/libs/grid-angular/index.d.ts"],
"@toolbox/themes/*": ["libs/themes/*"]
```

**Note**: Grid paths point to `dist/` for type resolution after build. Use workspace paths, not relative paths across libs.

## Project-Specific Conventions

### Code Style

- **Strict TypeScript**: `strict: true`, no implicit any, prefer explicit types
- **ESLint config**: Flat config in `eslint.config.mjs` using `@nx/eslint-plugin`
- **Formatting**: Prettier v3.7.4 (no explicit config file; uses defaults)

#### Code Organization with Region Markers

Use `// #region Name` and `// #endregion` markers to organize code into collapsible sections in VS Code. This improves navigation and maintainability in large files.

**When to add regions:**

- Files over ~200 lines should have logical sections marked with regions
- Group related functionality: imports, types, constants, state, lifecycle, methods, etc.
- Plugin files: separate hooks, state, event handlers, utilities
- Type files: separate interfaces, types, enums, constants

**Region naming conventions:**

```typescript
// #region Imports
import { ... } from '...';
// #endregion

// #region Types & Interfaces
interface MyConfig { ... }
// #endregion

// #region Private State
#state = {};
// #endregion

// #region Lifecycle Methods
connectedCallback() { ... }
// #endregion

// #region Public API
getData() { ... }
// #endregion
```

**Existing files with regions** (use as reference):

- `grid.ts` - 20 regions (lifecycle, plugin system, rendering, etc.)
- `config-manager.ts` - 13 regions
- `plugin-manager.ts` - 11 regions
- `types.ts` - 25 regions (interfaces, types, events, etc.)
- All internal helpers in `core/internal/` have regions

#### Dead Code Removal

See the `bundle-check` skill for the full dead code removal checklist, tools, and process.

#### CSS Color Guidelines

When adding colors to CSS, follow these rules:

1. **Check existing color registries first:**
   - **Grid component code** (`libs/grid/src/lib/core/grid.css`): Check if a suitable `--tbw-*` variable exists (e.g., `--tbw-color-accent`, `--tbw-color-border`, `--tbw-color-fg-muted`)
   - **Storybook/docs** (`apps/docs/.storybook/storybook-styles.css`): Check for `--sb-*`, `--sbdocs-*`, `--prism-*`, `--demo-*` variables

2. **Reuse existing variables** when the semantic meaning matches. Don't create duplicates.

3. **If no suitable variable exists**, consider whether the color should be added to a registry:
   - Grid theming colors → add to `grid.css` with `--tbw-` prefix
   - Storybook/documentation colors → add to `storybook-styles.css` with appropriate prefix

4. **Always use `light-dark()` function** for new color definitions to support both light and dark modes:

   ```css
   --my-new-color: light-dark(#lightValue, #darkValue);
   ```

- **Naming & Visibility**:
  | Prefix/Tag | Meaning | In API Docs? |
  |------------|---------|--------------|
  | `#` | ES private field (truly private) | ❌ No |
  | `__` | Deeply internal (implementation detail) | ❌ No |
  | `_` | Protected/plugin-accessible state | ✅ Yes |
  | `@internal Plugin API` | Plugin hook/method | ✅ Yes |
  | `@internal` (alone) | Internal, not for plugins | ❌ No |
  | (no prefix) | Public API | ✅ Yes |

### Vite Build Outputs

Configured in `vite.config.ts`:

- **ESM** format for modern bundlers (no CJS - web components require browser context)
- **UMD** bundles for CDN/script tag usage
- **vite-plugin-dts** with `rollupTypes: true` for bundled TypeScript declarations
- **esbuild** minification for optimal bundle size
- **Sourcemaps** enabled for debugging
- **Plugin builds** run in parallel with size summary output

### Nx Caching & CI

- **Nx Cloud**: Connected (ID in `nx.json`); distributed task execution available
- **CI**: GitHub Actions `.github/workflows/ci.yml` runs `bun nx run-many -t lint test build`
- **Affected commands**: Use `nx affected` to run tasks only on changed projects
- **Sync TypeScript refs**: `nx sync` updates project references based on dependency graph

### Centralized Render Scheduler

All grid rendering is orchestrated through a **single RenderScheduler** (`internal/render-scheduler.ts`). See the `debug-perf` skill for the full phase table and pipeline details.

**Key rules:**

- Use `this.#scheduler.requestPhase(RenderPhase.X, 'source')` to request renders
- Never call `requestAnimationFrame` directly for rendering (exception: scroll hot path)
- Phases: STYLE(1) → VIRTUALIZATION(2) → HEADER(3) → ROWS(4) → COLUMNS(5) → FULL(6); highest wins

### Custom Styles API (adoptedStyleSheets)

Custom styles use browser's `adoptedStyleSheets` for efficiency:

```typescript
// Efficient - survives DOM rebuilds
grid.registerStyles('my-id', '.my-class { color: blue; }');
grid.unregisterStyles('my-id');
```

**Do NOT** create `<style>` elements manually - they get wiped by `replaceChildren()`.

### Virtualization & Performance

The Grid uses **row virtualization**:

- Configurable via `virtualization` internal state object
- Default `rowHeight: 28px`, `overscan: 8` rows
- Rows rendered only for visible viewport window
- Row pooling via `rowPool: HTMLElement[]` for efficient DOM reuse
- Update via `refreshVirtualWindow(full: boolean)` - called via scheduler or directly for scroll

### Row Data Access Convention

When plugins or APIs expose row references to consumers, **prefer returning row data objects** over raw indices:

- **Row objects are stable identifiers** — indices shift when the grid sorts, filters, or groups data. A row index from `selection-change` refers to the grid's _processed_ `rows` array, not the user's original input array.
- **Always offer a row-object alternative** — e.g., `getSelectedRows()` alongside `getSelectedRowIndices()`. Framework adapters should expose the object-based accessor as the primary API.
- **Indices are fine as positional coordinates** — `CellRange`, `rowIndex`/`colIndex` in events, and similar positional references are naturally index-based. But when the consumer's goal is _data access_, provide the resolved object.
- **Use `this.rows`** (or `this.grid?.rows`) in plugins to resolve indices — this returns the grid's current post-processing row array, which is what indices correspond to.

```typescript
// ✅ Preferred: return actual row objects
const employees = selection.getSelectedRows<Employee>();

// ⚠️ Fragile: forces consumer to maintain index mapping
const indices = selection.getSelectedRowIndices();
const employees = indices.map((i) => myLocalData[i]); // May be wrong after sort/filter!
```

## Plugin Development Pattern

See the `new-plugin` skill for the complete plugin development guide including:

- File structure scaffold and templates
- Plugin hooks, helpers, and lifecycle
- Event bus (plugin-to-plugin communication)
- Query system (synchronous state retrieval)
- Manifest system (validation, owned properties, config rules)
- Dependencies and incompatibilities
- Runtime configuration validation

### Quick Plugin Reference

```typescript
// Import individual plugins (smaller bundles)
import { SelectionPlugin } from '@toolbox-web/grid/plugins/selection';

// All-in-one bundle
import { SelectionPlugin, FilteringPlugin } from '@toolbox-web/grid/all';

// Configuration
grid.gridConfig = {
  plugins: [new SelectionPlugin({ mode: 'row' }), new FilteringPlugin({ debounceMs: 200 })],
};

// Access at runtime — preferred (type-safe, no import needed)
const sel = grid.getPluginByName('selection');
sel?.selectAll();

// Alternative — access by class (requires import)
const sel2 = grid.getPlugin(SelectionPlugin);
```

## Common Pitfalls

1. **Don't import from `internal/` in public API** - Keep `src/public.ts` as the only external export; internal modules are implementation details
2. **Wait for component upgrade in tests** - Always call `await waitUpgrade(grid)` after creating element
3. **Bun vs Node** - This repo uses Bun; some Node-specific patterns may not work
4. **Test isolation** - Clean up DOM with `afterEach(() => { document.body.innerHTML = '' })`
5. **TypeScript paths** - Use workspace paths (`@toolbox/*`) not relative paths between libs
6. **Nx target names** - Use inferred targets from plugins (e.g., `test`, `build`, `lint`); check `project.json` for custom targets
7. **Plugin DOM access** - Use `this.gridElement` for DOM queries; the grid uses light DOM (no Shadow DOM)
8. **Plugin container access** - Use `this.gridElement.children[0]`, not hardcoded selectors like `.data-grid-container`
9. **Don't call RAF directly for rendering** - Use `this.#scheduler.requestPhase()` to batch work; exception: scroll hot path
10. **Don't create `<style>` elements** - Use `registerStyles()` which uses `adoptedStyleSheets` (survives DOM rebuilds)
11. **Editing is opt-in** - Using `editable: true` or `editor` requires `EditingPlugin`; the grid validates and throws helpful errors
12. **Prefer row objects over indices** - When exposing selection or row references to consumers, provide actual row data objects (e.g., `getSelectedRows()`) rather than forcing users to resolve indices manually. Row indices refer to positions in the grid's _current_ (sorted/filtered/grouped) row array, which may differ from the user's original data source. Indices are still useful as positional coordinates (e.g., `CellRange`), but always offer a row-object alternative for data access.
13. **Use `insertRow()`/`removeRow()` for manual row mutations** - When inserting or deleting rows by hand, use `grid.insertRow(index, row)` or `grid.removeRow(index)` instead of splicing an array and reassigning `grid.rows`. These methods operate directly on the current sorted/filtered view without re-running the pipeline, and auto-animate by default (pass `false` as the last argument to skip animation). Both return `Promise`s — `await grid.removeRow(idx)` ensures the fade-out animation completes before removal. The source data is updated automatically, so the next full `grid.rows = freshData` assignment re-sorts/re-filters normally. Do **not** use them for data refreshes (API responses, WebSocket updates) — let sort/filter re-apply by assigning `grid.rows` directly.
14. **Register external focus containers for overlays** - Custom editors that append elements to `<body>` (datepickers, dropdowns, color pickers) must call `grid.registerExternalFocusContainer(panel)` so the grid treats focus inside those elements as "still in the grid." Without registration, the grid will close the editor when focus moves to the overlay. Call `grid.unregisterExternalFocusContainer(panel)` when the overlay is destroyed. Angular's `BaseOverlayEditor` does this automatically.

## Runtime Configuration Validation

The grid validates plugin-owned properties at runtime. See the `new-plugin` skill for the full validation table, manifest system, and config rules.

## External Dependencies

- **Nx**: v22.3.3 - Monorepo task orchestration
- **Vite**: v7.3.x - Build tool and dev server
- **Vitest**: v4.x - Fast unit test runner
- **Bun**: Package manager + test runtime (faster than npm/yarn)
- **Storybook**: v10.1.11 - Component development environment
- **Lit**: Used for story rendering (web components framework)
- **happy-dom**: DOM environment for testing
- **Prettier**: v3.7.4 - Code formatting (uses defaults)

## Key Files Reference

- **`libs/grid/src/public.ts`** - Public API surface; only import from here externally
- **`libs/grid/src/lib/core/types.ts`** - Type definitions for grid configuration
- **`libs/grid/src/lib/core/grid.ts`** - Main component implementation
- **`libs/grid/src/lib/core/grid.css`** - Component styles (CSS variables for theming)
- **`libs/grid/src/lib/core/internal/render-scheduler.ts`** - Centralized render orchestration
- **`libs/grid/src/lib/core/internal/config-manager.ts`** - Centralized configuration management (single source of truth)
- **`libs/grid/src/lib/core/internal/validate-config.ts`** - Runtime validation for plugin-owned properties
- **`libs/grid/src/lib/core/internal/header.ts`** - Header row rendering with custom header renderers
- **`libs/grid/src/lib/core/plugin/`** - Plugin system (registry, hooks, state management)
- **`libs/grid/src/lib/plugins/`** - Individual plugin implementations
- **`libs/grid/src/lib/plugins/editing/`** - EditingPlugin (opt-in inline editing)
- **`libs/grid/vite.config.ts`** - Vite build configuration with plugin bundling
- **`libs/grid/docs/RFC-RENDER-SCHEDULER.md`** - RFC document explaining the scheduler design
- **`libs/grid-angular/src/index.ts`** - Angular adapter exports (Grid, TbwRenderer, TbwEditor directives, base classes)
- **`libs/grid-angular/src/lib/base-overlay-editor.ts`** - BaseOverlayEditor (floating overlay panel for custom editors)
- **`libs/grid-angular/src/lib/base-grid-editor-cva.ts`** - BaseGridEditorCVA (dual grid/form ControlValueAccessor)
- **`libs/grid-angular/src/lib/base-filter-panel.ts`** - BaseFilterPanel (custom filter panel base class)
- **`libs/grid-react/src/index.ts`** - React adapter exports (DataGrid, GridColumn, hooks)
- **`libs/grid-vue/src/index.ts`** - Vue adapter exports (DataGrid, GridColumn, composables)
- **`demos/employee-management/shared/`** - Shared demo types, data, and utilities
- **`demos/employee-management/vanilla/`** - Vanilla TypeScript demo application
- **`demos/employee-management/angular/`** - Angular demo application
- **`demos/employee-management/react/`** - React demo application
- **`demos/employee-management/vue/`** - Vue demo application
- **`tsconfig.base.json`** - Workspace-wide TypeScript paths
- **`nx.json`** - Nx workspace config with plugins and target defaults
- **`.github/workflows/ci.yml`** - CI pipeline (Bun-based)
