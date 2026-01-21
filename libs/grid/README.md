# @toolbox-web/grid

[![npm](https://img.shields.io/npm/v/@toolbox-web/grid)](https://www.npmjs.com/package/@toolbox-web/grid)
[![License: MIT](https://img.shields.io/badge/License-MIT-blue.svg)](../../LICENSE)
[![GitHub Sponsors](https://img.shields.io/badge/Sponsor-❤-ea4aaa?logo=github)](https://github.com/sponsors/OysteinAmundsen)

A high-performance, framework-agnostic data grid built with pure TypeScript and native Web Components. Zero runtime dependencies.

## Installation

```bash
npm install @toolbox-web/grid
```

## Quick Start

```typescript
import '@toolbox-web/grid';

const grid = document.createElement('tbw-grid');
grid.columns = [
  { field: 'name', header: 'Name' },
  { field: 'email', header: 'Email' },
];
grid.rows = data;
document.body.appendChild(grid);
```

> [!TIP]
> For complete examples, see the [Storybook documentation](https://toolboxjs.com/).

---

## Configuration

The grid supports multiple configuration methods, all converging into a **single source of truth** (`effectiveConfig`).

### Configuration Methods

**1. Via `gridConfig` (recommended for complex setups):**

```typescript
grid.gridConfig = {
  columns: [{ field: 'name' }, { field: 'age', type: 'number' }],
  fitMode: 'stretch',
  editOn: 'dblClick',
  plugins: [new SelectionPlugin({ mode: 'row' })],
  shell: { header: { title: 'My Data Grid' } },
};
```

**2. Via individual properties (convenience for simple cases):**

```typescript
grid.columns = [{ field: 'name' }, { field: 'age' }];
grid.fitMode = 'stretch';
grid.editOn = 'dblClick';
```

**3. Via Light DOM (declarative HTML):**

```html
<tbw-grid>
  <tbw-grid-column field="name" header="Name" sortable></tbw-grid-column>
  <tbw-grid-column field="age" header="Age" type="number"></tbw-grid-column>
  <tbw-grid-header title="My Data Grid">
    <tbw-grid-header-content>
      <span>Custom content</span>
    </tbw-grid-header-content>
  </tbw-grid-header>
</tbw-grid>
```

### Precedence

When the same property is set via multiple methods, higher precedence wins:

1. Individual props (`fitMode`, `editOn`) - highest
2. `columns` prop
3. Light DOM elements
4. `gridConfig` property - lowest

---

## Features

<table>
<tr><th colspan="2">Core Capabilities</th></tr>
<tr><td>Virtualization</td><td>Row and column virtualization for datasets with 100k+ rows</td></tr>
<tr><td>Keyboard Navigation</td><td>Full keyboard support including arrow keys, Tab, Enter, Home/End, PageUp/PageDown</td></tr>
<tr><td>Accessibility</td><td>ARIA attributes and screen reader support</td></tr>
<tr><td>Theming</td><td>CSS custom properties with 6 built-in themes</td></tr>
<tr><td>Column Inference</td><td>Automatic column type detection from data</td></tr>
<tr><th colspan="2">Editing</th></tr>
<tr><td>Inline Editing</td><td>Cell and row editing modes with configurable triggers</td></tr>
<tr><td>Undo/Redo</td><td>Edit history with Ctrl+Z / Ctrl+Y</td></tr>
<tr><td>Clipboard</td><td>Copy/paste with configurable delimiters</td></tr>
<tr><td>Change Tracking</td><td>Track modified rows with commit/reset lifecycle</td></tr>
<tr><th colspan="2">Data Operations</th></tr>
<tr><td>Sorting</td><td>Single and multi-column sorting</td></tr>
<tr><td>Filtering</td><td>Text, number, date, set, and boolean filters</td></tr>
<tr><td>Aggregations</td><td>Built-in aggregators (sum, avg, count, min, max) plus custom functions</td></tr>
<tr><td>Row Grouping</td><td>Hierarchical grouping with nested aggregations</td></tr>
<tr><td>Tree Data</td><td>Nested data structures with expand/collapse</td></tr>
<tr><td>Pivot Tables</td><td>Data transformation with row/column groups</td></tr>
<tr><td>Server-Side Data</td><td>Lazy loading with block caching</td></tr>
<tr><th colspan="2">Column Features</th></tr>
<tr><td>Pinning</td><td>Sticky columns on left or right edges</td></tr>
<tr><td>Resizing</td><td>Drag-to-resize with auto-sizing</td></tr>
<tr><td>Reordering</td><td>Drag-and-drop repositioning</td></tr>
<tr><td>Visibility</td><td>Show/hide columns programmatically or via UI</td></tr>
<tr><td>Header Groups</td><td>Multi-level column headers</td></tr>
<tr><th colspan="2">Selection & Export</th></tr>
<tr><td>Selection Modes</td><td>Cell, row, or range selection</td></tr>
<tr><td>Context Menus</td><td>Configurable right-click menus</td></tr>
<tr><td>Master/Detail</td><td>Expandable detail rows</td></tr>
<tr><td>Export</td><td>CSV, Excel (XML), and JSON formats</td></tr>
</table>

---

## API Reference

### Element

```html
<tbw-grid></tbw-grid>
```

### HTML Attributes

The grid supports configuration via HTML attributes with JSON-serialized values:

| Attribute     | Type   | Description                                 |
| ------------- | ------ | ------------------------------------------- |
| `rows`        | JSON   | Data array (JSON-serialized)                |
| `columns`     | JSON   | Column definitions (JSON-serialized)        |
| `grid-config` | JSON   | Full configuration object (JSON-serialized) |
| `fit-mode`    | string | Column sizing: `'stretch'` or `'fixed'`     |
| `edit-on`     | string | Edit trigger: `'click'` or `'dblClick'`     |

**Example with HTML attributes:**

```html
<tbw-grid
  rows='[{"id":1,"name":"Alice"},{"id":2,"name":"Bob"}]'
  columns='[{"field":"id","header":"ID"},{"field":"name","header":"Name"}]'
  fit-mode="stretch"
  edit-on="dblClick"
>
</tbw-grid>
```

### Properties

| Property     | Type                             | Description                                                              |
| ------------ | -------------------------------- | ------------------------------------------------------------------------ |
| `rows`       | `T[]`                            | Data array                                                               |
| `sourceRows` | `T[]` (readonly)                 | Original unfiltered/unprocessed rows                                     |
| `columns`    | `ColumnConfig[]`                 | Column definitions (→ `gridConfig.columns`)                              |
| `gridConfig` | `GridConfig`                     | Full configuration object (single source of truth)                       |
| `fitMode`    | `'stretch' \| 'fixed'`           | Column sizing behavior (→ `gridConfig.fitMode`)                          |
| `editOn`     | `'click' \| 'dblClick' \| false` | Edit trigger (→ `gridConfig.editOn`). Set to `false` to disable editing. |

### Methods

| Method                             | Returns               | Description                            |
| ---------------------------------- | --------------------- | -------------------------------------- |
| `ready()`                          | `Promise<void>`       | Resolves when fully initialized        |
| `forceLayout()`                    | `Promise<void>`       | Force re-layout                        |
| `getConfig()`                      | `Promise<GridConfig>` | Get effective configuration            |
| `getRowId(row)`                    | `string`              | Get unique identifier for a row        |
| `getRow(id)`                       | `T \| undefined`      | Get row by its ID                      |
| `updateRow(id, changes, source?)`  | `void`                | Update a single row by ID              |
| `updateRows(updates, source?)`     | `void`                | Batch update multiple rows             |
| `resetChangedRows(silent?)`        | `Promise<void>`       | Clear change tracking                  |
| `beginBulkEdit(rowIndex)`          | `Promise<void>`       | Start row editing                      |
| `commitActiveRowEdit()`            | `Promise<void>`       | Commit current edit                    |
| `setColumnVisible(field, visible)` | `boolean`             | Set column visibility                  |
| `setColumnOrder(order)`            | `void`                | Reorder columns by field array         |
| `getAllColumns()`                  | `ColumnInfo[]`        | Get all columns with visibility status |
| `getPlugin(PluginClass)`           | `P \| undefined`      | Get plugin instance by class           |
| `getPluginByName(name)`            | `Plugin \| undefined` | Get plugin instance by name            |

### Events

| Event                   | Detail                      | Description                        |
| ----------------------- | --------------------------- | ---------------------------------- |
| `cell-commit`           | `CellCommitDetail`          | Cell value committed (inline edit) |
| `cell-change`           | `CellChangeDetail`          | Row updated via Row Update API     |
| `row-commit`            | `RowCommitDetail`           | Row edit committed                 |
| `changed-rows-reset`    | `ChangedRowsResetDetail`    | Change tracking cleared            |
| `sort-change`           | `SortChangeDetail`          | Sort state changed                 |
| `column-resize`         | `ColumnResizeDetail`        | Column resized                     |
| `column-state-change`   | `ColumnState`               | Column state changed               |
| `activate-cell`         | `ActivateCellDetail`        | Cell activated                     |
| `group-toggle`          | `GroupToggleDetail`         | Row group expanded/collapsed       |
| `mount-external-view`   | `ExternalMountViewDetail`   | External view mount request        |
| `mount-external-editor` | `ExternalMountEditorDetail` | External editor mount request      |

Import event names from the `DGEvents` constant:

```typescript
import { DGEvents } from '@toolbox-web/grid';
grid.addEventListener(DGEvents.CELL_COMMIT, handler);
```

---

## Column Configuration

```typescript
interface ColumnConfig {
  field: string; // Required: property key in row data
  header?: string; // Display label (defaults to field name)
  type?: 'string' | 'number' | 'date' | 'boolean' | 'select';
  width?: number | string; // Pixels, '1fr', or percentage
  sortable?: boolean; // Enable sorting (default: true)
  resizable?: boolean; // Enable resize (default: true)
  editable?: boolean; // Enable editing
  hidden?: boolean; // Initially hidden
  lockVisible?: boolean; // Prevent hiding
  format?: (value: any, row: T) => string;
}
```

### Plugin-Provided Column Properties

Some column properties are added via [TypeScript module augmentation](#typescript-module-augmentation) when you import a plugin:

| Property      | Plugin            | Description              |
| ------------- | ----------------- | ------------------------ |
| `sticky`      | `pinnedColumns`   | Pin column left or right |
| `group`       | `groupingColumns` | Column header group      |
| `filterable`  | `filtering`       | Enable column filter     |
| `filterType`  | `filtering`       | Filter type              |
| `reorderable` | `reorder`         | Enable column reordering |

See [Storybook](https://oysteinamundsen.github.io/toolbox/) for complete configuration examples.

---

## Grid Configuration

```typescript
interface GridConfig {
  columns?: ColumnConfig[];
  fitMode?: 'stretch' | 'fixed';
  editOn?: 'click' | 'dblClick' | false;
  plugins?: BaseGridPlugin[]; // Array of plugin class instances
  icons?: GridIcons; // Centralized icon configuration
  shell?: ShellConfig; // Optional header bar and tool panels
  getRowId?: (row: T) => string; // Custom row ID resolver
}
```

### Row Identification

The grid uses row IDs for the [Row Update API](#methods). By default, it looks for `id` or `rowId` properties on row objects. For custom ID fields, provide a `getRowId` function:

```typescript
grid.gridConfig = {
  columns: [...],
  getRowId: (row) => row.employeeNumber, // Use custom field as ID
};
```

### Icons Configuration

The grid provides a centralized icon system via `gridConfig.icons`. All plugins (tree, grouping, sorting, context menus, etc.) automatically use these icons, ensuring visual consistency across the entire grid.

```typescript
import { DEFAULT_GRID_ICONS } from '@toolbox-web/grid';

grid.gridConfig = {
  icons: {
    expand: '▶', // Collapsed tree/group/detail icon
    collapse: '▼', // Expanded tree/group/detail icon
    sortAsc: '▲', // Sort ascending indicator
    sortDesc: '▼', // Sort descending indicator
    sortNone: '⇅', // Unsorted column indicator
    submenuArrow: '▶', // Context menu submenu arrow
    dragHandle: '⋮⋮', // Column reorder drag handle
  },
};
```

Icons can be strings (text or HTML) or `HTMLElement` instances. Plugins use grid-level icons by default but can override with their own config when needed.

### Plugin Configuration Example

Plugins are class instances that you import and instantiate with their configuration:

```typescript
import { GroupingRowsPlugin } from '@toolbox-web/grid/plugins/grouping-rows';
import { SelectionPlugin } from '@toolbox-web/grid/plugins/selection';

grid.gridConfig = {
  plugins: [
    new GroupingRowsPlugin({
      groupOn: (row) => row.category,
      fullWidth: false,
      aggregators: { total: 'sum' },
    }),
    new SelectionPlugin({
      mode: 'row',
      multiple: true,
    }),
  ],
};
```

---

## Theming

Apply a built-in theme:

```css
@import '@toolbox-web/grid/themes/dg-theme-standard.css';
```

Available themes: `standard`, `contrast`, `vibrant`, `large`, `bootstrap`, `material`

### Custom Theming

Override CSS custom properties on `tbw-grid` or a parent element:

```css
tbw-grid {
  --tbw-color-bg: #ffffff;
  --tbw-color-fg: #1a1a1a;
  --tbw-color-border: #e5e5e5;
  --tbw-color-header-bg: #f5f5f5;
  --tbw-row-height: 32px;
}
```

For a complete list of available CSS variables, see [grid.css](./src/lib/core/grid.css).

### Core CSS Variables

| Variable                | Description                  |
| ----------------------- | ---------------------------- |
| `--tbw-color-bg`        | Grid background              |
| `--tbw-color-fg`        | Text color                   |
| `--tbw-color-fg-muted`  | Secondary text color         |
| `--tbw-color-accent`    | Accent/primary color         |
| `--tbw-color-border`    | Border color                 |
| `--tbw-color-header-bg` | Header background            |
| `--tbw-color-header-fg` | Header text color            |
| `--tbw-color-selection` | Selected cell/row background |
| `--tbw-color-row-hover` | Row hover background         |
| `--tbw-row-height`      | Data row height              |
| `--tbw-header-height`   | Header row height            |
| `--tbw-font-family`     | Font family                  |
| `--tbw-font-size`       | Base font size               |
| `--tbw-border-radius`   | Corner radius                |
| `--tbw-focus-outline`   | Focus ring style             |

### Plugin CSS Variables

Plugins define their own CSS variables following a **layered fallback pattern**:

```
var(--tbw-{plugin}-{property}, var(--tbw-{global-property}))
```

This allows you to:

1. Override a specific plugin's style: `--tbw-selection-bg`
2. Or let it inherit from the global variable: `--tbw-color-selection`

**Example: Customizing the selection plugin**

```css
tbw-grid {
  /* Override just the selection plugin's background */
  --tbw-selection-bg: #e0f2fe;

  /* Or change the global selection color (affects all plugins) */
  --tbw-color-selection: #e0f2fe;
}
```

**Common plugin variables:**

| Plugin        | Variables                                                  |
| ------------- | ---------------------------------------------------------- |
| `selection`   | `--tbw-selection-bg`, `--tbw-selection-border`             |
| `filtering`   | `--tbw-filtering-panel-bg`, `--tbw-filtering-input-border` |
| `contextMenu` | `--tbw-context-menu-bg`, `--tbw-context-menu-hover`        |
| `pinnedRows`  | `--tbw-pinned-rows-bg`, `--tbw-pinned-rows-border`         |
| `tree`        | `--tbw-tree-indent`, `--tbw-tree-toggle-color`             |

Check each plugin's `styles` property for the full list of customizable variables.

---

## Plugins

The grid uses a plugin architecture for optional features. Each plugin has its own documentation:

| Plugin                | Description                    | Documentation                                               |
| --------------------- | ------------------------------ | ----------------------------------------------------------- |
| Selection             | Cell, row, and range selection | [README](./src/lib/plugins/selection/README.md)             |
| Multi-Sort            | Multi-column sorting           | [README](./src/lib/plugins/multi-sort/README.md)            |
| Filtering             | Column filters                 | [README](./src/lib/plugins/filtering/README.md)             |
| Row Grouping          | Row grouping with aggregation  | [README](./src/lib/plugins/grouping-rows/README.md)         |
| Column Grouping       | Column header groups           | [README](./src/lib/plugins/grouping-columns/README.md)      |
| Tree                  | Tree/hierarchical data         | [README](./src/lib/plugins/tree/README.md)                  |
| Pivot                 | Pivot table transformation     | [README](./src/lib/plugins/pivot/README.md)                 |
| Master-Detail         | Expandable detail rows         | [README](./src/lib/plugins/master-detail/README.md)         |
| Pinned Columns        | Sticky columns                 | [README](./src/lib/plugins/pinned-columns/README.md)        |
| Reorder               | Column drag reordering         | [README](./src/lib/plugins/reorder/README.md)               |
| Visibility            | Column visibility UI           | [README](./src/lib/plugins/visibility/README.md)            |
| Clipboard             | Copy/paste                     | [README](./src/lib/plugins/clipboard/README.md)             |
| Context Menu          | Right-click menus              | [README](./src/lib/plugins/context-menu/README.md)          |
| Export                | CSV/Excel/JSON export          | [README](./src/lib/plugins/export/README.md)                |
| Undo/Redo             | Edit history                   | [README](./src/lib/plugins/undo-redo/README.md)             |
| Server-Side           | Lazy data loading              | [README](./src/lib/plugins/server-side/README.md)           |
| Pinned Rows           | Footer aggregations            | [README](./src/lib/plugins/pinned-rows/README.md)           |
| Column Virtualization | Horizontal virtualization      | [README](./src/lib/plugins/column-virtualization/README.md) |

### Creating Custom Plugins

Plugins extend the `BaseGridPlugin` class:

```typescript
import { BaseGridPlugin } from '@toolbox-web/grid';
import styles from './my-plugin.css?inline';

interface MyPluginConfig {
  myOption?: boolean;
}

export class MyPlugin extends BaseGridPlugin<MyPluginConfig> {
  readonly name = 'myPlugin';
  override readonly styles = styles; // CSS imported via Vite

  // Default config (override in constructor)
  protected override get defaultConfig(): Partial<MyPluginConfig> {
    return { myOption: true };
  }

  // Called when plugin is attached to grid
  override attach(grid: GridElement): void {
    super.attach(grid);
    // Setup event listeners using this.disconnectSignal for auto-cleanup
  }

  // Called when plugin is detached
  override detach(): void {
    // Cleanup (listeners with disconnectSignal auto-cleanup)
  }

  // Hook: Called after grid renders
  override afterRender(): void {
    // Access DOM via this.gridElement
  }
}
```

### Inter-Plugin Communication

Plugins can communicate with each other using the generic query system. This allows plugins to expose capabilities or constraints without the core knowing about specific plugin concepts.

**Responding to queries (in your plugin):**

```typescript
import { BaseGridPlugin, PLUGIN_QUERIES, PluginQuery } from '@toolbox-web/grid';

export class MyPlugin extends BaseGridPlugin<MyConfig> {
  override onPluginQuery(query: PluginQuery): unknown {
    switch (query.type) {
      case PLUGIN_QUERIES.CAN_MOVE_COLUMN:
        // Veto column movement for locked columns
        const column = query.context as ColumnConfig;
        if (this.isLocked(column)) return false;
        return undefined; // Let other plugins decide
      default:
        return undefined;
    }
  }
}
```

**Querying other plugins:**

```typescript
import { PLUGIN_QUERIES } from '@toolbox-web/grid';

// In your plugin or application code
const responses = grid.queryPlugins<boolean>({
  type: PLUGIN_QUERIES.CAN_MOVE_COLUMN,
  context: column,
});
const canMove = !responses.includes(false);
```

**Built-in query types:**

| Query Type               | Context             | Response            | Description                     |
| ------------------------ | ------------------- | ------------------- | ------------------------------- |
| `CAN_MOVE_COLUMN`        | `ColumnConfig`      | `boolean`           | Can the column be reordered?    |
| `GET_CONTEXT_MENU_ITEMS` | `ContextMenuParams` | `ContextMenuItem[]` | Get menu items for context menu |

Plugins can also define custom query types for their own inter-plugin communication.

### Accessing Plugin Instances

Use `grid.getPlugin()` to get a plugin instance for inter-plugin communication or API access:

```typescript
import { SelectionPlugin } from '@toolbox-web/grid/plugins/selection';

const selection = grid.getPlugin(SelectionPlugin);
if (selection) {
  selection.selectAll();
}
```

---

## TypeScript

All types are exported from the package:

```typescript
import type { GridConfig, ColumnConfig, CellCommitDetail, BaseGridPlugin } from '@toolbox-web/grid';
```

### Plugin Type Exports

Each plugin exports its class and configuration types from its own entry point:

```typescript
import { SelectionPlugin, SelectionConfig } from '@toolbox-web/grid/plugins/selection';
import { FilteringPlugin, FilterConfig, FilterModel } from '@toolbox-web/grid/plugins/filtering';
import { TreePlugin, TreeConfig, TreeState } from '@toolbox-web/grid/plugins/tree';
```

### All-in-One Bundle

For convenience, you can import everything from the all-in-one bundle:

```typescript
import {
  SelectionPlugin,
  FilteringPlugin,
  TreePlugin,
  // ... all other plugins
} from '@toolbox-web/grid/all';
```

Note: This includes all plugins in your bundle. For smaller bundles, import plugins individually.

---

## Browser Support

Modern browsers with Web Components support (Chrome, Firefox, Safari, Edge).

---

## Development

```bash
bun run build
bun run test
bun run coverage
bun run start
```

For architecture details, rendering pipeline, and plugin development, see [ARCHITECTURE.md](./ARCHITECTURE.md).

---

## Support This Project

This grid is built and maintained by a single developer in spare time. If it saves you time or money, consider sponsoring to keep development going:

[![GitHub Sponsors](https://img.shields.io/badge/Sponsor_on_GitHub-ea4aaa?style=for-the-badge&logo=github)](https://github.com/sponsors/OysteinAmundsen)
[![Patreon](https://img.shields.io/badge/Support_on_Patreon-f96854?style=for-the-badge&logo=patreon)](https://www.patreon.com/c/OysteinAmundsen)

**What sponsorship enables:**

- 🚀 Faster feature development (see [ROADMAP](./ROADMAP.md))
- 🐛 Priority bug fixes and support
- 📚 Better documentation and examples
- 💼 Corporate sponsors get logo placement and priority support

---

## License

MIT
