# Copilot Instructions for Toolbox Web

## Project Overview

This is an **Nx monorepo** for building a **suite of framework-agnostic component libraries** using **pure TypeScript web components**. The architecture prioritizes cross-framework compatibility - components work natively in vanilla JS, React, Vue, Angular, etc. without wrappers (though framework-specific adapters may be built separately for enhanced DX).

Currently houses `@toolbox-web/grid` as the flagship component (`<tbw-grid>`), with more libraries planned. The repo uses **Bun** as package manager/runtime, **Vitest** for testing, **Vite** for building, and **Storybook** for component development.

## Architecture & Key Components

### Framework-Agnostic Design Philosophy

All libraries in this suite are built as **standard web components** (custom elements) using pure TypeScript:

- **Zero framework lock-in**: Components work in any JavaScript environment (vanilla, React, Vue, Angular, Svelte, etc.)
- **Native browser APIs**: Leverage shadow DOM, custom elements, CSSStyleSheet adoption, and web standards
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

### Monorepo Structure

- **`libs/grid/`** - First library in suite; single `<tbw-grid>` component with extensive internal modules
- **`libs/*/`** - Additional component libraries will follow same pure TypeScript + web standards pattern
- **`apps/storybook-app/`** - Unified Storybook for all components with live HMR via Vite
- **`libs/themes/`** - Shared CSS theme system (currently Grid themes; will expand for suite-wide theming)
- **`libs/storybook/`** - Shared Storybook utilities for all component libraries (`_utils.ts` for code view helpers)

### Grid Component Architecture

The `<tbw-grid>` component ([libs/grid/src/lib/core/grid.ts](libs/grid/src/lib/core/grid.ts)) is a shadow DOM web component with:

- **Single Source of Truth**: `#effectiveConfig` holds the merged canonical configuration
- **Public API surface** defined in `src/public.ts` - only export types/functions meant for external consumption
- **Internal modules** in `core/internal/` directory that power core features:
  - `columns.ts` - Column config resolution, header rendering, auto-sizing
  - `rows.ts` - Row rendering, virtualization, inline editing
  - `row-group.ts` - Hierarchical row grouping with expand/collapse
  - `keyboard.ts` - Keyboard navigation (arrows, Enter, Escape)
  - `resize.ts` - Column resizing controller
  - `aggregators.ts` - Footer aggregation functions (sum, avg, etc.)
  - `sanitize.ts` - Template string evaluation with safety guards
  - `sticky.ts` - Sticky column offset calculations
  - `inference.ts` - Column type inference from data

### Configuration Precedence System (Single Source of Truth)

The Grid follows a **single source of truth** pattern where all configuration inputs converge into `#effectiveConfig`:

**Input Sources → `#mergeEffectiveConfig()` → `#effectiveConfig` (canonical)**

Users can configure via:

- `gridConfig` property - full config object
- `columns` property - shorthand for `gridConfig.columns`
- `fitMode` / `editOn` properties - shortcuts for those settings
- Light DOM elements (`<tbw-grid-column>`, `<tbw-grid-header>`)

**Precedence (low → high):**

1. `gridConfig` prop (base)
2. Light DOM elements (declarative)
3. `columns` prop (direct array)
4. Inferred columns (auto-detected from first row)
5. Individual props (`fitMode`, `editOn`) - highest

**Internal State Categories:**

- **Input Properties** (`#rows`, `#columns`, `#gridConfig`, `#fitMode`, `#editOn`) - raw user input
- **Effective Config** (`#effectiveConfig`) - **THE single source of truth**
- **Derived State** (`_columns`, `_rows`) - result of plugin processing hooks
- **Runtime State** (`#hiddenColumns`, `sortState`) - user-driven changes at runtime

**Key rule**: All rendering logic reads from `effectiveConfig` or derived state, never from input properties.

See `ARCHITECTURE.md` for detailed diagrams and `config-precedence.spec.ts` for test examples.

### Testing Pattern

- **Unit tests**: Co-located with source files (e.g., `columns.ts` → `columns.spec.ts` in same folder)
- **Integration tests**: `src/__tests__/integration/*.spec.ts` for tests requiring full component lifecycle
  - `waitUpgrade(grid)` - Wait for component upgrade + `ready()` promise
  - `nextFrame()` - Wait for RAF to complete rendering
- **Plugin tests**: Each plugin has its own `*.spec.ts` files co-located with plugin source
- Run tests: `bun nx test grid` or `bun nx run-many -t test`

### Storybook Development

- **Core stories**: `libs/grid/stories/*.stories.ts` for general grid features
- **Plugin stories**: Co-located with each plugin (e.g., `plugins/selection/selection.stories.ts`)
- **Live source imports**: `import '../src/index'` enables HMR without rebuilds
- **Code view helper**: `buildExclusiveGridCodeView(gridEl, htmlSnippet, jsSnippet)` from `@toolbox/storybook/_utils` shows togglable markup/code
- **`extractCode(fn, args)`**: Extracts function body with placeholder substitution (`__$varName$`)
- Run Storybook: `bun nx storybook` (port 4400)

## Critical Workflows

### Development Commands

```bash
# Start Storybook with live reload
bun nx storybook

# Build grid library (Vite compilation)
bun nx build grid

# Run all tests
bun nx run-many -t test

# Run tests for specific project
bun nx test grid

# Lint + test + build (CI flow)
bun nx run-many -t lint test build

# Run single target across affected projects
bun nx affected -t test
```

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
- **Shadow DOM**: Use `attachShadow({ mode: 'open' })` with `CSSStyleSheet` adoption for styles

### Path Mappings

TypeScript paths defined in `tsconfig.base.json` for all libraries:

```json
"@toolbox-web/grid": ["libs/grid/src/"],
"@toolbox-web/grid/*": ["libs/grid/src/lib/*"],
"@toolbox/themes/*": ["libs/themes/*"],
"@toolbox/storybook/*": ["libs/storybook/*"]
```

**When adding new libraries**, follow this pattern: `@toolbox/[lib-name]` -> `libs/[lib-name]/src/`. Use workspace paths, not relative paths across libs.

## Project-Specific Conventions

### Code Style

- **Strict TypeScript**: `strict: true`, no implicit any, prefer explicit types
- **ESLint config**: Flat config in `eslint.config.mjs` using `@nx/eslint-plugin`
- **Formatting**: Prettier v2.6.2 (no explicit config file; uses defaults)
- **Naming**:
  - Private/internal fields prefixed with `#` (ES private fields) or `__` (legacy)
  - Public API uses camelCase, no prefixes
  - Internal state/cache uses `_` prefix (e.g., `_rows`, `_columns`)

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

### Virtualization & Performance

The Grid uses **row virtualization**:

- Configurable via `virtualization` internal state object
- Default `rowHeight: 28px`, `overscan: 8` rows
- Rows rendered only for visible viewport window
- Row pooling via `rowPool: HTMLElement[]` for efficient DOM reuse
- Update via `refreshVirtualWindow(full: boolean)`

## Plugin Development Pattern

All grid plugins must follow this **canonical structure** for consistency:

### File Organization

```
libs/grid/src/lib/plugins/[plugin-name]/
├── index.ts              # Barrel exports (plugin class + types)
├── [PluginName]Plugin.ts # Plugin class extending BaseGridPlugin
├── types.ts              # Config and exported types
├── [plugin-name].ts      # Pure helper functions (optional)
├── [plugin-name].spec.ts # Unit tests
└── [plugin-name].stories.ts # Storybook demo (optional)
```

### Accessing the Grid's Shadow DOM

In class-based plugins, access the grid via `this.grid`:

```typescript
class MyPlugin extends BaseGridPlugin<MyConfig> {
  afterRender(): void {
    const gridEl = this.grid as unknown as Element;
    const shadowRoot = gridEl.shadowRoot;
    if (!shadowRoot) return;
    // ... work with shadow DOM
  }
}
```

To access the root container element inside the shadow DOM:

```typescript
const container = shadowRoot.children[0]; // NOT querySelector('.some-class')
```

### Injecting Styles

Plugins should use the `styles` property to inject CSS into the grid's shadow DOM:

```typescript
export class MyPlugin extends BaseGridPlugin<MyConfig> {
  readonly name = 'myPlugin';
  readonly version = '1.0.0';

  readonly styles = `
    .my-plugin-element {
      /* styles here */
    }
  `;

  // ... hooks
}
```

**Do NOT** create `<style>` elements manually or use inline styles for structural styling.

### Plugin Hooks (Class Methods)

Override these methods in your plugin class (implement only what's needed):

- `attach(grid)` - Called when plugin is attached to grid; call `super.attach(grid)` first
- `detach()` - Called when plugin is removed; cleanup listeners, timers, etc.
- `processColumns(columns)` - Transform column definitions; return modified array
- `processRows(rows)` - Transform row data; return modified array
- `afterRender()` - DOM manipulation after grid renders
- `onScroll(event)` - Handle scroll events
- `onCellClick(event)` - Handle cell click events
- `onCellMouseDown(event)` - Handle cell mousedown; return `true` to prevent default
- `onKeyDown(event)` - Handle keyboard events; return `true` to prevent default
- `renderRow(row, rowEl, rowIndex)` - Custom row rendering; return `true` to skip default

### Type Exports

The `index.ts` barrel file exports the plugin class and types:

```typescript
// index.ts
export { MyPlugin } from './MyPlugin';
export type { MyPluginConfig } from './types';
```

### Using Plugins

Plugins are class instances passed in the `gridConfig.plugins` array:

```typescript
import { SelectionPlugin } from '@toolbox-web/grid/plugins/selection';
import { FilteringPlugin } from '@toolbox-web/grid/plugins/filtering';

grid.gridConfig = {
  plugins: [new SelectionPlugin({ mode: 'row' }), new FilteringPlugin({ debounceMs: 200 })],
};
```

Access plugin instances via `grid.getPlugin()`:

```typescript
const selection = grid.getPlugin(SelectionPlugin);
if (selection) {
  selection.selectAll();
}
```

## Common Pitfalls

1. **Don't import from `internal/` in public API** - Keep `src/public.ts` as the only external export; internal modules are implementation details
2. **Wait for component upgrade in tests** - Always call `await waitUpgrade(grid)` after creating element
3. **Bun vs Node** - This repo uses Bun; some Node-specific patterns may not work
4. **Test isolation** - Clean up DOM with `afterEach(() => { document.body.innerHTML = '' })`
5. **TypeScript paths** - Use workspace paths (`@toolbox/*`) not relative paths between libs
6. **Nx target names** - Use inferred targets from plugins (e.g., `test`, `build`, `lint`); check `project.json` for custom targets
7. **Plugin shadowRoot access** - Always use `ctx.grid as Element` then `gridEl.shadowRoot`, never `(ctx.grid as any).shadowRoot`
8. **Plugin container access** - Use `shadowRoot.children[0]`, not hardcoded selectors like `.data-grid-container`

## External Dependencies

- **Nx**: v21.6.4 - Monorepo task orchestration
- **Vite**: v7.x - Build tool and dev server
- **Vitest**: v3.x - Fast unit test runner
- **Bun**: Package manager + test runtime (faster than npm/yarn)
- **Storybook**: v9.1.10 - Component development environment
- **Lit**: Used for story rendering (web components framework)
- **happy-dom**: DOM environment for testing

## Key Files Reference

- **`libs/grid/src/public.ts`** - Public API surface; only import from here externally
- **`libs/grid/src/lib/core/types.ts`** - Type definitions for grid configuration
- **`libs/grid/src/lib/core/grid.ts`** - Main component implementation
- **`libs/grid/src/lib/core/grid.css`** - Component styles (CSS variables for theming)
- **`libs/grid/src/lib/core/plugin/`** - Plugin system (registry, hooks, state management)
- **`libs/grid/src/lib/plugins/`** - Individual plugin implementations
- **`libs/grid/vite.config.ts`** - Vite build configuration with plugin bundling
- **`tsconfig.base.json`** - Workspace-wide TypeScript paths
- **`nx.json`** - Nx workspace config with plugins and target defaults
- **`.github/workflows/ci.yml`** - CI pipeline (Bun-based)
