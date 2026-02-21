---
name: new-plugin
description: Create a new grid plugin for @toolbox-web/grid following the canonical plugin structure. Use when adding a new plugin with hooks, styles, tests, stories, and documentation.
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
├── <plugin-name>.stories.ts    # Storybook demo
├── <plugin-name>.mdx           # Documentation (required)
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

Add to `libs/grid/vite.config.ts` in the `entry` map and to `libs/grid/src/all.ts`.

## 6. Write Unit Tests (`<plugin-name>.spec.ts`)

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

## 7. Create Styles (`<plugin-name>.css`)

Use `.dg-` prefixed class names for grid internals, or plugin-specific class names.

## 8. Create Storybook Story (`<plugin-name>.stories.ts`)

Follow existing story patterns with Lit html templates. See the `storybook-story` skill for full templates.

## 9. Create Documentation (`<plugin-name>.mdx`)

Required for Storybook sidebar. Use Canvas and Controls blocks. See the `docs-update` skill for templates.

---

## Plugin API Reference

### Built-in Plugin Helpers

BaseGridPlugin provides these protected helpers — use them instead of type casting:

| Helper                         | Description                                       |
| ------------------------------ | ------------------------------------------------- |
| `this.grid`                    | Typed `GridElementRef` with all plugin APIs       |
| `this.gridElement`             | Grid as `HTMLElement` for DOM queries (preferred) |
| `this.columns`                 | Current column configurations                     |
| `this.visibleColumns`          | Only visible columns (for rendering)              |
| `this.rows`                    | Processed rows (after filtering, grouping)        |
| `this.sourceRows`              | Original unfiltered rows                          |
| `this.disconnectSignal`        | AbortSignal for auto-cleanup of event listeners   |
| `this.isAnimationEnabled`      | Whether grid animations are enabled               |
| `this.animationDuration`       | Animation duration in ms (default: 200)           |
| `this.gridIcons`               | Merged icon configuration                         |
| `this.getPlugin(PluginClass)`  | Get another plugin instance                       |
| `this.emit(eventName, detail)` | Dispatch custom event from grid                   |
| `this.requestRender()`         | Request full re-render                            |
| `this.requestAfterRender()`    | Request lightweight style update                  |
| `this.resolveIcon(name)`       | Get icon value by name                            |
| `this.setIcon(el, icon)`       | Set icon on element (string or SVG)               |

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

### Event Bus (Plugin-to-Plugin Communication)

Distinct from DOM events — for inter-plugin communication only:

```typescript
// Subscribing (in attach)
this.on('filter-change', (detail) => { /* handle */ });

// Emitting
this.emitPluginEvent('filter-change', { field: 'name', value: 'Alice' });

// Declare in manifest
static override readonly manifest: PluginManifest = {
  events: [{ type: 'filter-change', description: 'Emitted when filter criteria change' }],
};
```

| Method                                    | Description                        |
| ----------------------------------------- | ---------------------------------- |
| `this.on(eventType, callback)`            | Subscribe (auto-cleaned on detach) |
| `this.off(eventType)`                     | Unsubscribe                        |
| `this.emitPluginEvent(eventType, detail)` | Emit to subscribed plugins         |

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

// Access at runtime
const sel = grid.getPlugin(SelectionPlugin);
```

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
