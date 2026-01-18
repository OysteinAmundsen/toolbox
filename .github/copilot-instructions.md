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

### Commit Hygiene

Prompt the user to commit at logical stopping points during work sessions. Small, focused commits are preferred over large omnibus commits.

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
- **`libs/*/`** - Additional component libraries will follow same pure TypeScript + web standards pattern
- **`apps/docs/`** - Storybook documentation site with live HMR via Vite
- **`libs/themes/`** - Shared CSS theme system (currently Grid themes; will expand for suite-wide theming)
- **`demos/employee-management/`** - Full-featured demo applications showcasing the grid:
  - `vanilla/` - Pure TypeScript/Vite demo (`demo-vanilla` project)
  - `angular/` - Angular demo using grid-angular adapter (`demo-angular` project)
  - `react/` - React demo using grid-react adapter (`demo-react` project)
  - `shared/` - Shared types and mock data used by both demos

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

### Angular Adapter (`@toolbox-web/grid-angular`)

The Angular adapter library provides directives for seamless Angular integration with `<tbw-grid>`:

**Exported Directives:**

- **`Grid`** - Auto-registers `AngularGridAdapter` on `<tbw-grid>` elements, enabling Angular template rendering
- **`TbwRenderer`** - Structural directive (`*tbwRenderer`) for clean cell renderer syntax
- **`TbwEditor`** - Structural directive (`*tbwEditor`) for clean cell editor syntax with auto-wired commit/cancel
- **`GridColumnView`** / **`GridColumnEditor`** - Alternative nested element syntax with explicit `<ng-template>`

**Usage Example:**

```typescript
import { Component, CUSTOM_ELEMENTS_SCHEMA } from '@angular/core';
import { Grid, TbwRenderer, TbwEditor } from '@toolbox-web/grid-angular';

@Component({
  imports: [Grid, TbwRenderer, TbwEditor],
  schemas: [CUSTOM_ELEMENTS_SCHEMA],
  template: `
    <tbw-grid [rows]="data" [gridConfig]="config">
      <tbw-grid-column field="status">
        <!-- Clean structural directive syntax -->
        <app-status-badge *tbwRenderer="let value; row as row" [value]="value" [row]="row" />
        <!-- Editor with auto-wired commit/cancel outputs -->
        <app-status-select *tbwEditor="let value" [value]="value" />
      </tbw-grid-column>
    </tbw-grid>
  `
})
export class GridComponent { ... }
```

**Key Features:**

- Auto-adapter registration via `Grid` directive (no manual setup)
- Template context provides `value`, `row`, `column`, and for editors: `commit`/`cancel` emitters
- Works with Angular 17+ (standalone components)

### React Adapter (`@toolbox-web/grid-react`)

The React adapter library provides a complete React integration for `<tbw-grid>`:

**Exported Components:**

- **`DataGrid`** - Main component wrapper with React props and event handlers
- **`GridColumn`** - Declarative column definition with render props
- **`GridDetailPanel`** - Master-detail panels with React content
- **`GridToolPanel`** - Custom sidebar panels
- **`GridToolButtons`** - Toolbar button container

**Exported Hooks:**

- **`useGrid`** - Programmatic grid access (forceLayout, getConfig, etc.)
- **`useGridEvent`** - Type-safe event subscription with auto-cleanup

**Exported Types:**

- **`ReactGridConfig`** - Extends `GridConfig` with `renderer` and `editor` accepting React components
- **`ReactColumnConfig`** - Column config with React renderer/editor support

**Usage Example:**

```tsx
import { DataGrid, type ReactGridConfig } from '@toolbox-web/grid-react';
import { SelectionPlugin } from '@toolbox-web/grid/all';

const config: ReactGridConfig<Employee> = {
  columns: [
    { field: 'name', header: 'Name' },
    {
      field: 'status',
      header: 'Status',
      renderer: (ctx) => <StatusBadge value={ctx.value} />,
      editor: (ctx) => <StatusSelect value={ctx.value} onCommit={ctx.commit} />,
    },
  ],
  plugins: [new SelectionPlugin({ mode: 'row' })],
};

function App() {
  return <DataGrid rows={employees} gridConfig={config} />;
}
```

**Key Features:**

- Inline React renderers/editors via `ReactGridConfig`
- Auto-adapter registration (no manual setup)
- Type-safe event handling via props or hooks
- Full TypeScript generics support

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

- **Core stories**: `libs/grid/src/lib/core/*.stories.ts` for general grid features
- **Plugin stories**: Co-located with each plugin (e.g., `libs/grid/src/lib/plugins/selection/selection.stories.ts`)
- **MDX documentation**: `libs/grid/docs/*.mdx` for high-level docs, plugin-specific MDX in `libs/grid/src/lib/plugins/*/`
- **Demo stories**: `demos/employee-management/employee-management.stories.ts` for full-featured demo
- **Live source imports**: `import '../src/index'` enables HMR without rebuilds
- **Autodocs**: All stories auto-generate documentation pages from JSDoc comments
- Run Storybook: `bun nx serve docs` (port 4400)
- Build Storybook: `bun nx build docs` (outputs to `dist/docs/`)

### MDX Documentation

MDX files combine Markdown with live component examples:

```mdx
import { Meta, Canvas } from '@storybook/addon-docs/blocks';
import * as GridStories from '../src/lib/core/grid.stories';

<Meta title="Grid/Introduction" />

# Grid Introduction

<Canvas of={GridStories.Playground} />
```

Key Doc Blocks:

- `<Canvas of={Story} />` - Renders story with source code panel
- `<Controls of={Story} />` - Interactive prop controls
- `<ArgTypes of={Stories} />` - Auto-generated prop table from JSDoc
- `<Source code={...} />` - Syntax-highlighted code block

## Critical Workflows

### Development Commands

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

### Centralized Render Scheduler

All grid rendering is orchestrated through a **single RenderScheduler** (`internal/render-scheduler.ts`):

**Key Principles:**

- **Single RAF per frame**: All render requests batch into one `requestAnimationFrame` callback
- **Phase-based execution**: Work organized into phases (STYLE → VIRTUALIZATION → HEADER → ROWS → COLUMNS → FULL)
- **Highest phase wins**: Multiple requests merge - only the highest phase executes
- **Deterministic order**: `mergeConfig → processRows → processColumns → renderHeader → virtualWindow → afterRender`

**Render Phases:**
| Phase | Value | Work Performed |
|-------|-------|----------------|
| `STYLE` | 1 | Plugin `afterRender()` hooks only |
| `VIRTUALIZATION` | 2 | Recalculate virtual window |
| `HEADER` | 3 | Re-render header row |
| `ROWS` | 4 | Rebuild row model |
| `COLUMNS` | 5 | Process columns, update CSS template |
| `FULL` | 6 | Merge effective config + all lower phases |

**When contributing:**

- Use `this.#scheduler.requestPhase(RenderPhase.X, 'source')` to request renders
- Never call `requestAnimationFrame` directly for rendering (exception: scroll hot path)
- The scheduler handles `ready()` promise resolution after render completes

### Custom Styles API (adoptedStyleSheets)

Custom styles use browser's `adoptedStyleSheets` for efficiency:

```typescript
// Efficient - survives shadow DOM rebuilds
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

## Plugin Development Pattern

All grid plugins must follow this **canonical structure** for consistency:

### File Organization

```
libs/grid/src/lib/plugins/[plugin-name]/
├── index.ts                # Barrel exports (plugin class + types)
├── [PluginName]Plugin.ts   # Plugin class extending BaseGridPlugin
├── [plugin-name].css       # External CSS styles (imported via Vite)
├── types.ts                # Config and exported types
├── [plugin-name].ts        # Pure helper functions (optional)
├── [plugin-name].spec.ts   # Unit tests
├── [plugin-name].stories.ts# Storybook demo (optional)
├── [plugin-name].mdx       # Documentation (required - appears in Storybook docs)
└── README.md               # Package-level documentation (optional)
```

### Accessing the Grid's Shadow DOM

In class-based plugins, use the built-in helpers:

```typescript
class MyPlugin extends BaseGridPlugin<MyConfig> {
  afterRender(): void {
    // Use this.shadowRoot (typed getter)
    const shadowRoot = this.shadowRoot;
    if (!shadowRoot) return;
    // ... work with shadow DOM
  }
}
```

For HTMLElement access (e.g., clientWidth, classList):

```typescript
const width = this.gridElement.clientWidth;
this.gridElement.classList.add('my-plugin-active');
```

To access the root container element inside the shadow DOM:

```typescript
const container = shadowRoot.children[0]; // NOT querySelector('.some-class')
```

### Injecting Styles

Plugins should use **external CSS files** imported via Vite's `?inline` query:

```typescript
// Import CSS as inline string (Vite handles this)
import styles from './my-plugin.css?inline';

export class MyPlugin extends BaseGridPlugin<MyConfig> {
  readonly name = 'myPlugin';
  override readonly styles = styles;

  // ... hooks
}
```

The CSS file (`my-plugin.css`) contains the styles:

```css
.my-plugin-element {
  /* styles here */
}
```

**Do NOT** use inline template literal styles or create `<style>` elements manually.

### Built-in Plugin Helpers

BaseGridPlugin provides these protected helpers - use them instead of type casting:

| Helper                         | Description                                     |
| ------------------------------ | ----------------------------------------------- |
| `this.grid`                    | Typed `GridElementRef` with all plugin APIs     |
| `this.gridElement`             | Grid as `HTMLElement` for DOM operations        |
| `this.shadowRoot`              | Grid's shadow root for DOM queries              |
| `this.columns`                 | Current column configurations                   |
| `this.visibleColumns`          | Only visible columns (for rendering)            |
| `this.rows`                    | Processed rows (after filtering, grouping)      |
| `this.sourceRows`              | Original unfiltered rows                        |
| `this.disconnectSignal`        | AbortSignal for auto-cleanup of event listeners |
| `this.isAnimationEnabled`      | Whether grid animations are enabled             |
| `this.animationDuration`       | Animation duration in ms (default: 200)         |
| `this.gridIcons`               | Merged icon configuration                       |
| `this.getPlugin(PluginClass)`  | Get another plugin instance                     |
| `this.emit(eventName, detail)` | Dispatch custom event from grid                 |
| `this.requestRender()`         | Request full re-render                          |
| `this.requestAfterRender()`    | Request lightweight style update                |
| `this.resolveIcon(name)`       | Get icon value by name                          |
| `this.setIcon(el, icon)`       | Set icon on element (string or SVG)             |

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

### Plugin Dependencies

Plugins can declare dependencies on other plugins using a static `dependencies` property. This enables runtime validation with helpful error messages when dependencies are missing.

**Declaring Dependencies:**

```typescript
import { BaseGridPlugin, type PluginDependency } from '@toolbox-web/grid';

export class MyPlugin extends BaseGridPlugin<MyConfig> {
  /**
   * Declare dependencies on other plugins.
   * Use `override` since it overrides the base class property.
   */
  static override readonly dependencies: PluginDependency[] = [
    // Required dependency - throws error if missing
    { name: 'editing', required: true, reason: 'MyPlugin tracks edit history' },
    // Optional dependency - logs info if missing, continues working
    { name: 'selection', required: false, reason: 'Enables advanced selection features' },
  ];

  readonly name = 'myPlugin';
  readonly version = '1.0.0';
  // ... rest of plugin
}
```

**Dependency Types:**

| Property   | Type      | Default | Description                                    |
| ---------- | --------- | ------- | ---------------------------------------------- |
| `name`     | `string`  | -       | Plugin name (matches `plugin.name` property)   |
| `required` | `boolean` | `true`  | Hard dependency throws, soft logs info message |
| `reason`   | `string`  | -       | Human-readable explanation shown in errors     |

**Built-in Plugin Dependencies:**

| Plugin             | Depends On        | Required | Reason                                      |
| ------------------ | ----------------- | -------- | ------------------------------------------- |
| `UndoRedoPlugin`   | `EditingPlugin`   | Yes      | Tracks cell edit history                    |
| `ClipboardPlugin`  | `SelectionPlugin` | Yes      | Needs selection to know what cells to copy  |
| `VisibilityPlugin` | `ReorderPlugin`   | No       | Enables drag-to-reorder in visibility panel |

**Plugin Order Matters:**

Dependencies must be loaded **before** the dependent plugin:

```typescript
// ✅ Correct - EditingPlugin loaded before UndoRedoPlugin
plugins: [new EditingPlugin(), new UndoRedoPlugin()];

// ❌ Wrong - UndoRedoPlugin loaded before its dependency
plugins: [new UndoRedoPlugin(), new EditingPlugin()];
// Throws: "[tbw-grid] Plugin dependency error: UndoRedoPlugin tracks cell edit history..."
```

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

For convenience, import all plugins from the all-in-one bundle (`src/all.ts`):

```typescript
import { SelectionPlugin, FilteringPlugin, TreePlugin } from '@toolbox-web/grid/all';
```

Note: This includes all plugins in the bundle. For smaller bundles, import plugins individually.

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
9. **Don't call RAF directly for rendering** - Use `this.#scheduler.requestPhase()` to batch work; exception: scroll hot path
10. **Don't create `<style>` elements** - Use `registerStyles()` which uses `adoptedStyleSheets` (survives DOM rebuilds)
11. **Editing is opt-in** - Using `editable: true` or `editor` requires `EditingPlugin`; the grid validates and throws helpful errors

## Runtime Configuration Validation

The grid validates plugin-owned properties at runtime and throws helpful errors if required plugins are missing:

**Plugin-owned properties that require their respective plugins:**

| Property       | Required Plugin         | Level  |
| -------------- | ----------------------- | ------ |
| `editable`     | `EditingPlugin`         | Column |
| `editor`       | `EditingPlugin`         | Column |
| `group`        | `GroupingColumnsPlugin` | Column |
| `sticky`       | `PinnedColumnsPlugin`   | Column |
| `columnGroups` | `GroupingColumnsPlugin` | Config |

**Example error message:**

```
[tbw-grid] Configuration error:

Column(s) [name, email] use the "editable" column property, but the required plugin is not loaded.
  → Add the plugin to your gridConfig.plugins array:
    import { EditingPlugin } from '@toolbox-web/grid/plugins/editing';
    plugins: [new EditingPlugin(), ...]
```

This validation is implemented in `libs/grid/src/lib/core/internal/validate-config.ts` and runs after plugins are initialized.

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
- **`libs/grid/src/lib/core/plugin/`** - Plugin system (registry, hooks, state management)
- **`libs/grid/src/lib/plugins/`** - Individual plugin implementations
- **`libs/grid/src/lib/plugins/editing/`** - EditingPlugin (opt-in inline editing)
- **`libs/grid/vite.config.ts`** - Vite build configuration with plugin bundling
- **`libs/grid/docs/RFC-RENDER-SCHEDULER.md`** - RFC document explaining the scheduler design
- **`libs/grid-angular/src/index.ts`** - Angular adapter exports (Grid, TbwRenderer, TbwEditor directives)
- **`libs/grid-react/src/index.ts`** - React adapter exports (DataGrid, GridColumn, hooks)
- **`demos/employee-management/shared/`** - Shared demo types, data, and utilities
- **`demos/employee-management/vanilla/`** - Vanilla TypeScript demo application
- **`demos/employee-management/angular/`** - Angular demo application
- **`demos/employee-management/react/`** - React demo application
- **`tsconfig.base.json`** - Workspace-wide TypeScript paths
- **`nx.json`** - Nx workspace config with plugins and target defaults
- **`.github/workflows/ci.yml`** - CI pipeline (Bun-based)
