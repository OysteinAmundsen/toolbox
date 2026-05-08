---
name: new-plugin
description: Create a new grid plugin for @toolbox-web/grid following the canonical plugin structure. Use when adding a new plugin with hooks, styles, tests, and documentation.
argument-hint: <plugin-name> [description]
---

# Create a New Grid Plugin

Follow this step-by-step workflow to create a new plugin for `@toolbox-web/grid`.

## 1. Scaffold the File Structure

Create the plugin directory under `libs/grid/src/lib/plugins/<plugin-name>/` with these files:

```
libs/grid/src/lib/plugins/<plugin-name>/
├── index.ts                    # Barrel exports
├── <PluginName>Plugin.ts       # Main plugin class
├── <plugin-name>.css            # Styles (imported via Vite ?inline)
├── types.ts                    # Config and exported types
├── <plugin-name>.ts            # Pure helper functions (optional)
├── <plugin-name>.spec.ts       # Unit tests
└── README.md                   # Package-level docs (optional)
```

## 2. Define Types (`types.ts`)

```typescript
/**
 * Configuration for the <PluginName> plugin.
 */
export interface <PluginName>Config {
  // Add config options here
}
```

## 3. Implement the Plugin Class (`<PluginName>Plugin.ts`)

```typescript
import { BaseGridPlugin, type GridElementRef, type PluginManifest } from '@toolbox-web/grid';
import type { <PluginName>Config } from './types';
import styles from './<plugin-name>.css?inline';

export class <PluginName>Plugin extends BaseGridPlugin<<PluginName>Config> {
  readonly name = '<pluginName>';   // camelCase
  readonly version = '1.0.0';
  override readonly styles = styles;

  // Declare manifest for validation and metadata
  static override readonly manifest: PluginManifest<<PluginName>Config> = {
    ownedProperties: [
      // { property: 'myProp', level: 'column' },
    ],
    configRules: [],
  };

  // Optional: declare dependencies
  // static override readonly dependencies: PluginDependency[] = [
  //   { name: 'selection', required: false, reason: 'Enhances selection behavior' },
  // ];

  override attach(grid: GridElementRef): void {
    super.attach(grid);
    // Initialize plugin state, add event listeners using this.disconnectSignal
  }

  override detach(): void {
    // Cleanup (listeners auto-removed via disconnectSignal)
    super.detach();
  }

  // Override hooks as needed:
  // processColumns?(columns): ColumnConfig[]
  // processRows?(rows): unknown[]
  // afterRender?(): void
  // onScroll?(event): void
  // onCellClick?(event): void
  // onKeyDown?(event): boolean
  // renderRow?(row, rowEl, rowIndex): boolean
  // handleQuery?(query): unknown
}
```

## 4. Create Barrel Export (`index.ts`)

```typescript
export { <PluginName>Plugin } from './<PluginName>Plugin';
export type { <PluginName>Config } from './types';
```

## 5. Register the Plugin Entry Point

Make the plugin discoverable as both an individual entry point and via the all-plugins barrel:

1. **`libs/grid/vite.config.ts`** — Add a new key to the `entry` map of the form `'plugins/<plugin-name>': resolve(__dirname, 'src/lib/plugins/<plugin-name>/index.ts')`. This produces a tree-shakeable subpath import (`@toolbox-web/grid/plugins/<plugin-name>`).
2. **`libs/grid/src/all.ts`** — Add `export * from './lib/plugins/<plugin-name>';` so consumers who import from `@toolbox-web/grid/all` receive the new plugin alongside every other built-in plugin.

## 6. Register the Feature Module (mandatory)

A plugin is **not complete without a corresponding feature module**. Features are the high-level, declarative API surface (`gridConfig.features.<name>`) that lets consumers enable a plugin with a single config line and a side-effect import, instead of constructing the plugin class manually.

### 6.1 Core feature module

Create `libs/grid/src/lib/features/<plugin-name>.ts`:

````typescript
/**
 * <PluginName> feature for @toolbox-web/grid
 *
 * @example
 * ```typescript
 * import '@toolbox-web/grid/features/<plugin-name>';
 *
 * grid.gridConfig = { features: { <pluginName>: true } };
 * ```
 */

import { <PluginName>Plugin, type <PluginName>Config } from '../plugins/<plugin-name>';
import { registerFeature } from './registry';

declare module '../core/types' {
  interface FeatureConfig<TRow> {
    /** One-line description of what enabling this feature does. */
    <pluginName>?: boolean | <PluginName>Config;
  }
}

registerFeature('<pluginName>', (config) => {
  if (config === true) return new <PluginName>Plugin();
  return new <PluginName>Plugin(typeof config === 'object' ? config : undefined);
});

/** @internal Type anchor — forces bundlers to preserve this module's FeatureConfig augmentation when re-exported. */
export type _Augmentation = true;
````

Then wire it up:

1. **`libs/grid/vite.config.ts`** — Add `'features/<plugin-name>': resolve(__dirname, 'src/lib/features/<plugin-name>.ts')` to the `entry` map.
2. **`libs/grid/src/lib/features/index.ts`** (if a barrel exists) — Re-export the new feature module so `@toolbox-web/grid/features` pulls it in alongside the others.
3. **`libs/grid/src/lib/features/registry.spec.ts`** — Add a test confirming the feature factory returns a `<PluginName>Plugin` instance for both the boolean and object config shapes.

### 6.2 Adapter feature modules (Angular / React / Vue)

For each adapter, create a thin re-export module so consumers get the same declarative surface from the framework package:

- `libs/grid-react/src/features/<plugin-name>.ts`
- `libs/grid-vue/src/features/<plugin-name>.ts`
- `libs/grid-angular/src/features/<plugin-name>.ts`

Each file should:

1. Import the core feature module for its side effect: `import '@toolbox-web/grid/features/<plugin-name>';`
2. Optionally export a framework-idiomatic helper (React hook `use<PluginName>()`, Vue composable `use<PluginName>()`, Angular service/directive) if the plugin exposes a programmatic API worth surfacing.
3. Be added to the adapter's `vite.config.mts` `entry` map at `'features/<plugin-name>'`, the adapter's `package.json` `exports` map (already covered by the wildcard `./features/*` entry in existing adapters), and the `features/index.ts` barrel.

Use `libs/grid-react/src/features/selection.ts` (and the matching Vue / Angular files) as the reference shape.

## 7. Framework Adapter Integration for DOM Template Inputs (conditional)

**This step is mandatory if** the plugin accepts any kind of user-supplied DOM template, renderer function, HTML string, or element factory — e.g. a custom cell/header/filter renderer, a custom editor, a tool-panel body, a master-detail panel, a tooltip body, a context-menu item template, an empty-state template, etc. Skip this step only if the plugin is purely behavioral (no template inputs).

Why this is required: vanilla `<tbw-grid>` consumers pass DOM strings or callbacks that produce raw `HTMLElement`s. Angular / React / Vue users expect to pass `TemplateRef`, JSX, or `<template #slot>` instead. Each adapter must translate the framework idiom into a plain DOM callback before forwarding to the plugin.

For each adapter (`libs/grid-{angular,react,vue}/`):

1. **Extend the adapter's column / config types** so the new template input accepts the framework primitive (e.g. add `<pluginName>Template?: TemplateRef<...>` to `AngularColumnConfig`, `<pluginName>Renderer?: (ctx) => ReactNode` to `ReactColumnConfig`, or a slot name to `VueColumnConfig`).
2. **Update the adapter implementation** (`{framework}-grid-adapter.ts`) so its `createRenderer` / `createEditor` / `createToolPanelRenderer` / equivalent factory recognizes the new template input and mounts/unmounts the framework component into the DOM element the plugin hands it.
3. **Update the wrapper component / declarative children** (`DataGrid.{tsx,vue}`, `Grid` directive, `<GridColumn>` etc.) so users can declare the template inline using framework-native syntax (JSX, `<template #slotname>`, `*tbwXxx` structural directive).
4. **Add adapter tests** mirroring the core plugin's behavior tests but using framework components as the template input.
5. **Update the adapter MDX docs and adapter README** with a usage example for the new template input.

See the `new-adapter-feature` skill for the full per-framework pattern, including which files to touch and the canonical examples to copy.

## 8. Write Unit Tests (`<plugin-name>.spec.ts`)

Follow the mock grid pattern used by other plugins:

```typescript
import { describe, expect, it, vi } from 'vitest';
import { <PluginName>Plugin } from './<PluginName>Plugin';

function createGridMock(/* options */) {
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
  };
}

describe('<PluginName>Plugin', () => {
  it('should have correct name', () => {
    const plugin = new <PluginName>Plugin();
    expect(plugin.name).toBe('<pluginName>');
  });

  it('should attach and detach cleanly', () => {
    const plugin = new <PluginName>Plugin();
    const grid = createGridMock();
    plugin.attach(grid as any);
    plugin.detach();
  });
});
```

## 9. Create Styles (`<plugin-name>.css`)

Use `.dg-` prefixed class names for grid internals, or plugin-specific class names.

## 10. Add Accessibility Announcements

If the plugin changes user-visible state (sorting, filtering, selection, editing, expanding/collapsing), announce it via the aria live region:

```typescript
import { announce, getA11yMessage } from '../../core/internal/aria';

// In the relevant handler:
announce(this.gridElement, getA11yMessage(this.gridElement, 'messageKey', ...args));
```

- Add a corresponding message function to `A11yMessages` in `types.ts` with an English default in `DEFAULT_A11Y_MESSAGES`
- `getA11yMessage()` resolves user-provided i18n overrides from `gridConfig.a11y.messages`, falling back to the default
- `announce()` respects `gridConfig.a11y.announcements === false` (opt-out)
- For high-frequency events (e.g., selection changes), debounce the announcement with `setTimeout` (~150ms)
- Guard for `this.gridElement` being `undefined` in tests — `announce()` handles this with a null guard

## 11. Create Demo Component (`<PluginName>DefaultDemo.astro`)

Create an interactive Astro demo in `apps/docs/src/components/demos/<plugin-name>/`. See the `astro-demo` skill for full templates.

## 12. Create Documentation (`<plugin-name>.mdx`)

Create a plugin MDX page at `apps/docs/src/content/docs/grid/plugins/<plugin-name>.mdx`. Import the demo component and wrap it in `<ShowSource>`. See the `docs-update` skill for templates.

## 13. Verify Documentation Build

Build the docs site to verify the new plugin page renders correctly:

```bash
bun nx build docs
```

Navigate to `http://localhost:4401/grid/plugins/<plugin-name>/` after running `bun nx serve docs`.

---

## Plugin API Reference

> **Use this section as a lookup, not a checklist.** The 13 numbered steps above are the actual workflow for creating a plugin. The subsections below catalogue every helper, hook, event-bus method, query-system primitive, dependency rule, manifest field, and styling convention. Jump to the subsection that matches the question you have right now (e.g. "which `emit*` method should I use?" → **Event Bus & Communication Channels**); do not try to memorize the whole reference before writing code.
>
> Subsection map:
>
> - **Built-in Plugin Helpers** \u2014 Properties and helper methods exposed by `BaseGridPlugin`.
> - **Plugin Hooks (Class Methods)** \u2014 Lifecycle and event hooks you can override.
> - **Event Bus & Communication Channels** \u2014 `emit` vs `emitPluginEvent` vs `broadcast` and the subscription API.
> - **Query System (Synchronous State Retrieval)** \u2014 Declaring and handling `query` requests between plugins.
> - **Plugin Dependencies** \u2014 Required vs optional dependencies and how to handle missing ones.
> - **Plugin Incompatibilities** \u2014 Declaring `incompatibleWith` in the manifest.
> - **Plugin Manifest System** \u2014 The full `manifest` schema (events, queries, options, conflicts).

### Built-in Plugin Helpers

BaseGridPlugin provides these protected helpers — use them instead of type casting:

| Helper                               | Description                                        |
| ------------------------------------ | -------------------------------------------------- |
| `this.grid`                          | Typed `GridElementRef` with all plugin APIs        |
| `this.gridElement`                   | Grid as `HTMLElement` for DOM queries (preferred)  |
| `this.columns`                       | Current column configurations                      |
| `this.visibleColumns`                | Only visible columns (for rendering)               |
| `this.rows`                          | Processed rows (after filtering, grouping)         |
| `this.sourceRows`                    | Original unfiltered rows                           |
| `this.disconnectSignal`              | AbortSignal for auto-cleanup of event listeners    |
| `this.isAnimationEnabled`            | Whether grid animations are enabled                |
| `this.animationDuration`             | Animation duration in ms (default: 200)            |
| `this.gridIcons`                     | Merged icon configuration                          |
| `this.getPluginByName(name)`         | Get another plugin instance by name (preferred)    |
| `this.getPlugin(PluginClass)`        | Get another plugin instance by class (alternative) |
| `this.emit(eventName, detail)`       | Dispatch custom event from grid (DOM consumers)    |
| `this.emitPluginEvent(type, detail)` | Dispatch to plugin event bus (other plugins)       |
| `this.broadcast(type, detail)`       | Dispatch to BOTH plugin bus AND DOM consumers      |
| `this.requestRender()`               | Request full re-render                             |
| `this.requestAfterRender()`          | Request lightweight style update                   |
| `this.resolveIcon(name)`             | Get icon value by name                             |
| `this.setIcon(el, icon)`             | Set icon on element (string or SVG)                |

> **Note**: The grid uses light DOM. Use `this.gridElement` for all DOM queries.

### Plugin Hooks (Class Methods)

Override these methods (implement only what's needed):

- `attach(grid)` — Called when attached; call `super.attach(grid)` first
- `detach()` — Called when removed; cleanup listeners, timers, etc.
- `processColumns(columns)` — Transform column definitions; return modified array
- `processRows(rows)` — Transform row data; return modified array
- `afterRender()` — DOM manipulation after grid renders
- `onScroll(event)` — Handle scroll events
- `onCellClick(event)` — Handle cell click events
- `onCellMouseDown(event)` — Handle cell mousedown; return `true` to prevent default
- `onKeyDown(event)` — Handle keyboard events; return `true` to prevent default
- `renderRow(row, rowEl, rowIndex)` — Custom row rendering; return `true` to skip default
- `handleQuery(query)` — Handle incoming queries from other plugins

### Event Bus & Communication Channels

Plugins have **three emission methods**. Choosing the wrong one causes silent bugs (other plugins or consumers don't hear events).

| Method                                    | Audience              | Use when                                                          |
| ----------------------------------------- | --------------------- | ----------------------------------------------------------------- |
| `this.emit(eventType, detail)`            | External consumers    | Consumer-facing events with no plugin subscribers (rare)          |
| `this.emitPluginEvent(eventType, detail)` | Other plugins only    | Plugin-internal notifications (e.g., `filter-change` state sync)  |
| `this.broadcast(eventType, detail)`       | Consumers AND plugins | Events that both plugins AND consumers need (e.g., `sort-change`) |

**Decision tree:**

1. Do other plugins need to react? (e.g., Selection clearing on sort) → Yes: use `broadcast()` or `emitPluginEvent()`
2. Do external `addEventListener` consumers need this event? → Yes: use `broadcast()` or `emit()`
3. Both audiences → **`broadcast()`** (most state-change events fall here)

```typescript
// Subscribing (in attach)
this.on('filter-change', (detail) => { /* handle */ });

// Plugin-only notification
this.emitPluginEvent('filter-change', { field: 'name', value: 'Alice' });

// Both plugin bus AND DOM (most common for state changes)
this.broadcast('sort-change', { sortModel: [...this.sortModel] });

// Declare in manifest
static override readonly manifest: PluginManifest = {
  events: [{ type: 'filter-change', description: 'Emitted when filter criteria change' }],
};
```

| Method                                    | Description                               |
| ----------------------------------------- | ----------------------------------------- |
| `this.on(eventType, callback)`            | Subscribe (auto-cleaned on detach)        |
| `this.off(eventType)`                     | Unsubscribe                               |
| `this.emitPluginEvent(eventType, detail)` | Emit to subscribed plugins only           |
| `this.broadcast(eventType, detail)`       | Emit to BOTH plugin bus AND DOM consumers |

### Query System (Synchronous State Retrieval)

Plugins expose queryable state. PluginManager uses **manifest-based routing**.

```typescript
// Declare in manifest
static override readonly manifest: PluginManifest = {
  queries: [{ type: 'canMoveColumn', description: 'Check if column can be moved' }],
};

// Handle
override handleQuery(query: PluginQuery): unknown {
  if (query.type === 'canMoveColumn') {
    return !(query.context as ColumnConfig).pinned;
  }
  return undefined;
}

// Query from another plugin
const responses = this.grid.query<boolean>('canMoveColumn', column);
```

### Plugin Dependencies

```typescript
static override readonly dependencies: PluginDependency[] = [
  { name: 'editing', required: true, reason: 'Tracks edit history' },
  { name: 'selection', required: false, reason: 'Enables advanced selection' },
];
```

Dependencies must be loaded **before** the dependent plugin in the `plugins` array.

**Handling missing or failed dependencies:**

- A `required: true` dependency that is absent at attach time is a **hard failure**: throw an `Error` from `attach()` (after `super.attach(grid)`) with a message naming both the dependent plugin and the missing dependency, e.g. `throw new Error('UndoRedoPlugin requires EditingPlugin to be registered before it.');`. Do not register hooks or event listeners before the throw — the plugin must abort cleanly so PluginManager can surface the error.
- A `required: false` dependency that is absent is a **soft degradation**: skip the optional integration code path, log a single `console.warn` from `attach()` describing which capability is disabled, and continue attaching normally. Never throw for an optional dependency.
- Use `this.getPluginByName(name)` (preferred) or `this.getPlugin(PluginClass)` to look up a dependency. Both return `undefined` when the dependency is not present — always null-check the result before calling methods on it.
- Do **not** attempt to lazy-load or re-attach a missing dependency; PluginManager owns the lifecycle and ordering.

**Built-in dependencies:**

| Plugin             | Depends On        | Required |
| ------------------ | ----------------- | -------- |
| `UndoRedoPlugin`   | `EditingPlugin`   | Yes      |
| `ClipboardPlugin`  | `SelectionPlugin` | Yes      |
| `VisibilityPlugin` | `ReorderPlugin`   | No       |

### Plugin Incompatibilities

```typescript
static override readonly manifest: PluginManifest = {
  incompatibleWith: [
    { name: 'groupingRows', reason: 'Card layout does not support row grouping' },
  ],
};
```

### Plugin Manifest System

The manifest provides declarative validation and metadata:

```typescript
static override readonly manifest: PluginManifest<MyConfig> = {
  ownedProperties: [
    { property: 'myProp', level: 'column' },
    { property: 'globalSetting', level: 'config' },
  ],
  configRules: [{
    id: 'myPlugin/invalid-combo',
    severity: 'warn',  // 'warn' logs, 'error' throws
    message: 'optionA and optionB cannot both be true',
    check: (config) => config.optionA && config.optionB,
  }],
};
```

**Adding plugin-owned properties:**

1. **Always**: Add to `manifest.ownedProperties`
2. **Optionally**: Add to `KNOWN_COLUMN_PROPERTIES` / `KNOWN_CONFIG_PROPERTIES` in `validate-config.ts` for "forgot to add plugin" detection

### Runtime Configuration Validation

The grid validates plugin-owned properties and throws helpful errors if plugins are missing:

| Property       | Required Plugin         | Level  |
| -------------- | ----------------------- | ------ |
| `editable`     | `EditingPlugin`         | Column |
| `editor`       | `EditingPlugin`         | Column |
| `editorParams` | `EditingPlugin`         | Column |
| `group`        | `GroupingColumnsPlugin` | Column |
| `pinned`       | `PinnedColumnsPlugin`   | Column |
| `sticky`       | `PinnedColumnsPlugin`   | Column |
| `columnGroups` | `GroupingColumnsPlugin` | Config |

### Using Plugins

```typescript
// Individual imports (smaller bundles)
import { SelectionPlugin } from '@toolbox-web/grid/plugins/selection';

// All-in-one bundle
import { SelectionPlugin, FilteringPlugin } from '@toolbox-web/grid/all';

// Configuration
grid.gridConfig = {
  plugins: [new SelectionPlugin({ mode: 'row' })],
};

// Access at runtime — preferred (type-safe, no import needed)
const sel = grid.getPluginByName('selection');
sel?.selectAll();

// Alternative — access by class (requires import)
const sel2 = grid.getPlugin(SelectionPlugin);
```

**Always prefer `getPluginByName()` over `getPlugin()`.** It avoids importing the plugin class and returns the actual instance registered in the grid.

## Key Rules

- **Use `this.gridElement`** for DOM queries (light DOM, no Shadow DOM)
- **Use `this.gridElement.children[0]`** for root container (not hardcoded selectors)
- **Use `this.disconnectSignal`** for event listener cleanup
- **Use `registerStyles()`** not `<style>` elements (they get wiped by `replaceChildren()`)
- **Use `this.#scheduler.requestPhase()`** not `requestAnimationFrame` for rendering
- **Import CSS with `?inline`** query for Vite
- **Keep files under ~2000 lines**
- **Export public types from `src/public.ts`**
- **Add plugin-owned properties to manifest `ownedProperties`**
- **Dev-only warnings**: Config rule warnings (severity `'warn'`) only show in dev environments
