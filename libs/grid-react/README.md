# @toolbox-web/grid-react

[![npm](https://img.shields.io/npm/v/@toolbox-web/grid-react.svg)](https://www.npmjs.com/package/@toolbox-web/grid-react)
[![License: MIT](https://img.shields.io/badge/License-MIT-blue.svg)](../../LICENSE)
[![GitHub Sponsors](https://img.shields.io/badge/Sponsor-❤-ea4aaa?logo=github)](https://github.com/sponsors/OysteinAmundsen)

React adapter for `@toolbox-web/grid` data grid component. Provides components and hooks for declarative React integration with custom cell renderers and editors.

## Features

- ✅ **Full React integration** - Use JSX for cell renderers and editors
- ✅ **Declarative feature props** - Enable plugins with simple props like `selection="range"`
- ✅ **Tree-shakeable features** - Only import the features you use
- ✅ **Declarative columns** - Define columns via props or `GridColumn` components
- ✅ **Render props** - Clean `children` syntax for custom cells
- ✅ **Type-level defaults** - App-wide renderers/editors via `GridTypeProvider`
- ✅ **Icon configuration** - App-wide icon overrides via `GridProvider` or `GridIconProvider`
- ✅ **Hooks API** - `useGrid` and `useGridEvent` for programmatic access
- ✅ **Ref forwarding** - Access grid instance via `DataGridRef`
- ✅ **Master-detail** - `GridDetailPanel` for expandable rows
- ✅ **Tool panels** - `GridToolPanel` for custom sidebar content
- ✅ **Full type safety** - TypeScript generics support
- ✅ **React 18+** - Concurrent features and Suspense compatible

## Installation

```bash
# npm
npm install @toolbox-web/grid @toolbox-web/grid-react

# yarn
yarn add @toolbox-web/grid @toolbox-web/grid-react

# pnpm
pnpm add @toolbox-web/grid @toolbox-web/grid-react

# bun
bun add @toolbox-web/grid @toolbox-web/grid-react
```

## Quick Start

### 1. Register the Grid Component

In your application entry point, import the grid registration:

```typescript
// main.tsx or index.tsx
import '@toolbox-web/grid';
```

### 2. Use in Components

```tsx
import { DataGrid } from '@toolbox-web/grid-react';

interface Employee {
  id: number;
  name: string;
  department: string;
  salary: number;
}

function EmployeeGrid() {
  const [employees, setEmployees] = useState<Employee[]>([
    { id: 1, name: 'Alice', department: 'Engineering', salary: 95000 },
    { id: 2, name: 'Bob', department: 'Marketing', salary: 75000 },
    { id: 3, name: 'Charlie', department: 'Sales', salary: 85000 },
  ]);

  return (
    <DataGrid
      rows={employees}
      columns={[
        { field: 'id', header: 'ID', width: 60 },
        { field: 'name', header: 'Name', sortable: true },
        { field: 'department', header: 'Department', sortable: true },
        { field: 'salary', header: 'Salary', type: 'number' },
      ]}
      onRowsChange={setEmployees}
    />
  );
}
```

## Enabling Features

Features are enabled using **declarative props** with **side-effect imports**. This gives you the best of both worlds: clean, intuitive JSX and tree-shakeable bundles.

### How It Works

1. **Import the feature** - A side-effect import registers the feature factory
2. **Use the prop** - DataGrid detects the prop and creates the plugin instance

```tsx
// 1. Import features you need (once, typically in main.tsx or the component file)
import '@toolbox-web/grid-react/features/selection';
import '@toolbox-web/grid-react/features/sorting';
import '@toolbox-web/grid-react/features/filtering';

// 2. Use declarative props - no manual plugin instantiation!
<DataGrid
  rows={employees}
  columns={columns}
  selection="range" // SelectionPlugin with mode: 'range'
  sorting="multi" // MultiSortPlugin
  filtering // FilteringPlugin with defaults
/>;
```

### Why Side-Effect Imports?

- **Tree-shakeable** - Only the features you import are bundled
- **Synchronous** - No loading states, no HTTP requests, no spinners
- **Type-safe** - Full TypeScript support for feature props
- **Clean JSX** - No `plugins: [new SelectionPlugin({ mode: 'range' })]` boilerplate

### Available Features

Import from `@toolbox-web/grid-react/features/<name>`:

| Feature                 | Prop                   | Example                                                              |
| ----------------------- | ---------------------- | -------------------------------------------------------------------- |
| `selection`             | `selection`            | `selection="range"` or `selection={{ mode: 'row', checkbox: true }}` |
| `sorting`               | `sorting`              | `sorting="multi"` or `sorting={{ maxSortLevels: 3 }}`                |
| `filtering`             | `filtering`            | `filtering` or `filtering={{ debounceMs: 200 }}`                     |
| `editing`               | `editing`              | `editing="dblclick"` or `editing="click"`                            |
| `clipboard`             | `clipboard`            | `clipboard` (requires selection)                                     |
| `undo-redo`             | `undoRedo`             | `undoRedo` (requires editing)                                        |
| `context-menu`          | `contextMenu`          | `contextMenu`                                                        |
| `reorder`               | `reorder`              | `reorder` (column drag-to-reorder)                                   |
| `row-reorder`           | `rowReorder`           | `rowReorder` (row drag-to-reorder)                                   |
| `visibility`            | `visibility`           | `visibility` (column visibility panel)                               |
| `pinned-columns`        | `pinnedColumns`        | `pinnedColumns`                                                      |
| `pinned-rows`           | `pinnedRows`           | `pinnedRows`                                                         |
| `grouping-columns`      | `groupingColumns`      | `groupingColumns`                                                    |
| `grouping-rows`         | `groupingRows`         | `groupingRows={{ groupBy: 'department' }}`                           |
| `tree`                  | `tree`                 | `tree={{ childrenField: 'children' }}`                               |
| `column-virtualization` | `columnVirtualization` | `columnVirtualization`                                               |
| `export`                | `export`               | `export`                                                             |
| `print`                 | `print`                | `print`                                                              |
| `responsive`            | `responsive`           | `responsive` (card layout on mobile)                                 |
| `master-detail`         | `masterDetail`         | `masterDetail` (use with `<GridDetailPanel>`)                        |
| `pivot`                 | `pivot`                | `pivot={{ rowFields: [...], columnFields: [...] }}`                  |
| `server-side`           | `serverSide`           | `serverSide={{ ... }}` (server-side data)                            |

### Import All Features

For prototyping or when bundle size isn't critical, import all features at once:

```tsx
// Import all features (larger bundle)
import '@toolbox-web/grid-react/features';

// Now all feature props work
<DataGrid
  selection="range"
  sorting
  filtering
  editing="dblclick"
  clipboard
  undoRedo
  contextMenu
  // ... any feature prop
/>;
```

### Full Example

```tsx
import '@toolbox-web/grid-react/features/selection';
import '@toolbox-web/grid-react/features/sorting';
import '@toolbox-web/grid-react/features/editing';
import '@toolbox-web/grid-react/features/filtering';
import '@toolbox-web/grid-react/features/clipboard';

import { DataGrid, type ReactGridConfig } from '@toolbox-web/grid-react';

interface Employee {
  id: number;
  name: string;
  department: string;
  salary: number;
}

function EmployeeGrid({ employees }: { employees: Employee[] }) {
  return (
    <DataGrid
      rows={employees}
      columns={[
        { field: 'id', header: 'ID', width: 60 },
        { field: 'name', header: 'Name', editable: true },
        { field: 'department', header: 'Department', editable: true },
        { field: 'salary', header: 'Salary', type: 'number' },
      ]}
      selection="range"
      sorting="multi"
      editing="dblclick"
      filtering
      clipboard
    />
  );
}
```

## Custom Cell Renderers

There are two ways to define custom renderers: inline in the configuration, or via `GridColumn` components.

### Inline Configuration (Recommended)

Define renderers directly in your `ReactGridConfig`:

```tsx
import { DataGrid, type ReactGridConfig } from '@toolbox-web/grid-react';

const config: ReactGridConfig<Employee> = {
  columns: [
    { field: 'name', header: 'Name' },
    {
      field: 'status',
      header: 'Status',
      // Custom React renderer - same property name as vanilla!
      renderer: (ctx) => <span className={`badge badge-${ctx.value.toLowerCase()}`}>{ctx.value}</span>,
    },
  ],
};

function EmployeeGrid() {
  return <DataGrid rows={employees} gridConfig={config} />;
}
```

**Renderer Context:**

| Property | Type      | Description              |
| -------- | --------- | ------------------------ |
| `value`  | `TValue`  | The cell value           |
| `row`    | `TRow`    | The full row data object |
| `column` | `unknown` | The column configuration |

### Using GridColumn Components

Use the `GridColumn` component with a render prop:

```tsx
import { DataGrid, GridColumn } from '@toolbox-web/grid-react';

function StatusBadge({ status }: { status: string }) {
  return <span className={`badge badge-${status.toLowerCase()}`}>{status}</span>;
}

function EmployeeGrid() {
  return (
    <DataGrid rows={employees}>
      <GridColumn field="name" header="Name" />
      <GridColumn field="status">{(ctx) => <StatusBadge status={ctx.value} />}</GridColumn>
    </DataGrid>
  );
}
```

## Custom Cell Editors

Define editors inline in your configuration or via `GridColumn`:

### Inline Configuration

```tsx
const config: ReactGridConfig<Employee> = {
  columns: [
    {
      field: 'status',
      header: 'Status',
      editable: true,
      renderer: (ctx) => <StatusBadge status={ctx.value} />,
      editor: (ctx) => (
        <select
          defaultValue={ctx.value}
          autoFocus
          onChange={(e) => ctx.commit(e.target.value)}
          onKeyDown={(e) => e.key === 'Escape' && ctx.cancel()}
        >
          <option value="active">Active</option>
          <option value="inactive">Inactive</option>
        </select>
      ),
    },
  ],
};
```

**Editor Context:**

| Property | Type          | Description                  |
| -------- | ------------- | ---------------------------- |
| `value`  | `TValue`      | The current cell value       |
| `row`    | `TRow`        | The full row data object     |
| `column` | `unknown`     | The column configuration     |
| `commit` | `(v) => void` | Callback to commit new value |
| `cancel` | `() => void`  | Callback to cancel editing   |

### Using GridColumn

```tsx
<DataGrid rows={employees}>
  <GridColumn
    field="name"
    editable
    editor={(ctx) => (
      <input
        autoFocus
        defaultValue={ctx.value}
        onBlur={(e) => ctx.commit(e.target.value)}
        onKeyDown={(e) => {
          if (e.key === 'Enter') ctx.commit(e.currentTarget.value);
          if (e.key === 'Escape') ctx.cancel();
        }}
      />
    )}
  />
</DataGrid>
```

## Master-Detail with GridDetailPanel

Create expandable row details using the `GridDetailPanel` component:

```tsx
import { DataGrid, GridDetailPanel } from '@toolbox-web/grid-react';
import { MasterDetailPlugin } from '@toolbox-web/grid/all';

function EmployeeGrid() {
  const config: ReactGridConfig<Employee> = {
    columns: [...],
    plugins: [new MasterDetailPlugin()],
  };

  return (
    <DataGrid rows={employees} gridConfig={config}>
      <GridDetailPanel showExpandColumn animation="slide">
        {({ row, rowIndex }) => (
          <div className="detail-panel">
            <h4>{row.name}'s Details</h4>
            <p>Email: {row.email}</p>
            <EmployeeHistory employeeId={row.id} />
          </div>
        )}
      </GridDetailPanel>
    </DataGrid>
  );
}
```

**GridDetailPanel Props:**

| Prop               | Type                                     | Default   | Description                         |
| ------------------ | ---------------------------------------- | --------- | ----------------------------------- |
| `children`         | `(ctx: DetailPanelContext) => ReactNode` | Required  | Render function for panel content   |
| `showExpandColumn` | `boolean`                                | `true`    | Show expand/collapse chevron column |
| `animation`        | `'slide' \| 'fade' \| false`             | `'slide'` | Animation style for expand/collapse |

## Custom Tool Panels with GridToolPanel

Add custom sidebar panels to the grid shell:

```tsx
import { DataGrid, GridToolPanel, GridToolButtons } from '@toolbox-web/grid-react';
import { ShellPlugin } from '@toolbox-web/grid/all';

function EmployeeGrid() {
  const config: ReactGridConfig<Employee> = {
    columns: [...],
    plugins: [new ShellPlugin()],
  };

  return (
    <DataGrid rows={employees} gridConfig={config}>
      {/* Toolbar buttons */}
      <GridToolButtons>
        <button onClick={handleExport}>Export CSV</button>
        <button onClick={handlePrint}>Print</button>
      </GridToolButtons>

      {/* Custom sidebar panel */}
      <GridToolPanel id="quick-filters" title="Quick Filters" icon="🔍" order={10}>
        {({ grid }) => (
          <div className="filter-panel">
            <label>
              Department:
              <select onChange={(e) => applyFilter(grid, 'department', e.target.value)}>
                <option value="">All</option>
                <option value="Engineering">Engineering</option>
                <option value="Marketing">Marketing</option>
              </select>
            </label>
          </div>
        )}
      </GridToolPanel>
    </DataGrid>
  );
}
```

**GridToolPanel Props:**

| Prop       | Type                                   | Default  | Description                       |
| ---------- | -------------------------------------- | -------- | --------------------------------- |
| `id`       | `string`                               | Required | Unique panel identifier           |
| `title`    | `string`                               | Required | Panel title in accordion header   |
| `children` | `(ctx: ToolPanelContext) => ReactNode` | Required | Render function for panel content |
| `icon`     | `string`                               | -        | Icon for the accordion header     |
| `tooltip`  | `string`                               | -        | Tooltip text for header           |
| `order`    | `number`                               | `100`    | Panel sort order (lower = higher) |

## Hooks

### useGrid

Access the grid instance for programmatic control:

```tsx
import { DataGrid, useGrid } from '@toolbox-web/grid-react';

function MyComponent() {
  const { ref, isReady, forceLayout, getConfig } = useGrid<Employee>();

  const handleExport = async () => {
    const config = await getConfig();
    console.log('Columns:', config?.columns);
  };

  return (
    <>
      <button onClick={handleExport}>Export</button>
      <button onClick={() => forceLayout()}>Refresh Layout</button>
      <DataGrid ref={ref} rows={employees} />
    </>
  );
}
```

### useGridEvent

Type-safe event subscription with automatic cleanup:

```tsx
import { DataGrid, useGridEvent, DataGridRef } from '@toolbox-web/grid-react';
import { useRef } from 'react';

function MyComponent() {
  const gridRef = useRef<DataGridRef>(null);

  useGridEvent(gridRef, 'selection-change', (event) => {
    console.log('Selected:', event.detail.selectedRows);
  });

  return <DataGrid ref={gridRef} rows={employees} />;
}
```

## Event Handling

### Via Props

```tsx
<DataGrid
  rows={employees}
  onCellEdit={(e) => console.log('Edited:', e.detail)}
  onRowClick={(e) => console.log('Clicked:', e.detail.row)}
  onSortChange={(e) => console.log('Sort:', e.detail)}
/>
```

### Via useGridEvent Hook

See [useGridEvent](#usegridevent) above.

## Type-Level Defaults

Define app-wide renderers and editors for custom column types using `GridTypeProvider`:

```tsx
import { GridTypeProvider, DataGrid, type TypeDefaultsMap } from '@toolbox-web/grid-react';
import { EditingPlugin } from '@toolbox-web/grid/plugins/editing';

// Define type defaults at app level
const typeDefaults: TypeDefaultsMap = {
  country: {
    renderer: (ctx) => <span>🌍 {ctx.value}</span>,
    editor: (ctx) => (
      <select defaultValue={ctx.value} onChange={(e) => ctx.commit(e.target.value)}>
        <option value="USA">USA</option>
        <option value="UK">UK</option>
        <option value="Germany">Germany</option>
      </select>
    ),
  },
  currency: {
    renderer: (ctx) => <span>${ctx.value.toFixed(2)}</span>,
  },
};

// Wrap your app with the provider
function App() {
  return (
    <GridTypeProvider defaults={typeDefaults}>
      <Dashboard />
    </GridTypeProvider>
  );
}

// All grids with type: 'country' columns use these components
function Dashboard() {
  return (
    <DataGrid
      rows={employees}
      gridConfig={{
        columns: [
          { field: 'name', header: 'Name' },
          { field: 'country', type: 'country', editable: true },
          { field: 'salary', type: 'currency' },
        ],
        plugins: [new EditingPlugin()],
      }}
    />
  );
}
```

**Hooks:**

| Hook                    | Description                        |
| ----------------------- | ---------------------------------- |
| `useGridTypeDefaults()` | Get all type defaults from context |
| `useTypeDefault(type)`  | Get defaults for a specific type   |

## App-Wide Icon Configuration

Customize grid icons at the application level using `GridIconProvider` or the combined `GridProvider`:

### Using GridProvider (Recommended)

```tsx
import { GridProvider, DataGrid } from '@toolbox-web/grid-react';

// Define icon overrides and type defaults together
const icons = {
  expand: '➕',
  collapse: '➖',
  sortAsc: '↑',
  sortDesc: '↓',
};

const typeDefaults = {
  country: { renderer: (ctx) => <span>🌍 {ctx.value}</span> },
};

function App() {
  return (
    <GridProvider icons={icons} defaults={typeDefaults}>
      <Dashboard />
    </GridProvider>
  );
}
```

### Using GridIconProvider (Icons Only)

```tsx
import { GridIconProvider, DataGrid } from '@toolbox-web/grid-react';

const customIcons = {
  expand: '▶',
  collapse: '▼',
  sortAsc: '△',
  sortDesc: '▽',
  filter: '<svg>...</svg>', // SVG markup supported
};

function App() {
  return (
    <GridIconProvider icons={customIcons}>
      <DataGrid rows={data} columns={columns} />
    </GridIconProvider>
  );
}
```

**Available Icons:**

| Icon           | Default | Description                          |
| -------------- | ------- | ------------------------------------ |
| `expand`       | `▶`     | Expand icon for trees/groups/details |
| `collapse`     | `▼`     | Collapse icon                        |
| `sortAsc`      | `▲`     | Sort ascending indicator             |
| `sortDesc`     | `▼`     | Sort descending indicator            |
| `sortNone`     | `⇅`     | Unsorted indicator                   |
| `filter`       | SVG     | Filter icon in headers               |
| `filterActive` | SVG     | Filter icon when active              |
| `submenuArrow` | `▶`     | Context menu submenu arrow           |
| `dragHandle`   | `⋮⋮`    | Drag handle for reordering           |
| `toolPanel`    | `☰`    | Tool panel toggle icon               |
| `print`        | `🖨️`    | Print button icon                    |

**Precedence (highest wins):**

1. `gridConfig.icons` - Per-grid overrides
2. `GridProvider`/`GridIconProvider` - App-level defaults
3. Built-in defaults

## Using Plugins (Advanced)

> **Note:** For most use cases, prefer the [declarative feature props](#enabling-features) approach above.
> The manual plugin approach is useful for advanced scenarios like custom plugin configuration or custom plugins.

Import plugins directly when you need full control over plugin configuration:

```tsx
import { DataGrid } from '@toolbox-web/grid-react';
import { SelectionPlugin } from '@toolbox-web/grid/plugins/selection';
import { FilteringPlugin } from '@toolbox-web/grid/plugins/filtering';

function MyComponent() {
  return (
    <DataGrid
      rows={employees}
      gridConfig={{
        columns: [...],
        plugins: [
          new SelectionPlugin({ mode: 'row' }),
          new FilteringPlugin({ debounceMs: 200 }),
        ],
      }}
    />
  );
}
```

Or import all plugins at once (larger bundle, but convenient):

```tsx
import { SelectionPlugin, FilteringPlugin } from '@toolbox-web/grid/all';
```

## Custom Styles

Inject custom CSS into the grid:

```tsx
<DataGrid
  rows={employees}
  customStyles={`
    .my-custom-cell { 
      background: #f0f0f0; 
      padding: 8px;
    }
  `}
/>
```

## API Reference

### Exported Components

| Component          | Description                                 |
| ------------------ | ------------------------------------------- |
| `DataGrid`         | Main grid component wrapper                 |
| `GridColumn`       | Declarative column with render props        |
| `GridDetailPanel`  | Master-detail expandable panel              |
| `GridToolPanel`    | Custom sidebar panel                        |
| `GridToolButtons`  | Toolbar button container                    |
| `GridProvider`     | Combined provider for icons & type defaults |
| `GridTypeProvider` | App-level type defaults context             |
| `GridIconProvider` | App-level icon overrides context            |

### Exported Hooks

| Hook                    | Description                               |
| ----------------------- | ----------------------------------------- |
| `useGrid`               | Grid ref with ready state and methods     |
| `useGridEvent`          | Type-safe event subscription with cleanup |
| `useGridTypeDefaults()` | Get all type defaults from context        |
| `useTypeDefault(type)`  | Get defaults for a specific type          |
| `useGridIcons()`        | Get icon overrides from context           |

### Exported Types

```typescript
import type {
  ReactGridConfig,
  ReactColumnConfig,
  CellRenderContext,
  ColumnEditorContext,
  DetailPanelContext,
  ToolPanelContext,
  DataGridRef,
  DataGridProps,
  // Feature props
  FeatureProps,
  SSRProps,
  // Type-level defaults
  ReactTypeDefault,
  TypeDefaultsMap,
  GridTypeProviderProps,
  // Icon overrides
  GridIconProviderProps,
  GridProviderProps,
} from '@toolbox-web/grid-react';
```

### DataGrid Props

| Prop           | Type                                       | Description               |
| -------------- | ------------------------------------------ | ------------------------- |
| `rows`         | `TRow[]`                                   | Row data to display       |
| `columns`      | `ColumnConfig[]`                           | Column definitions        |
| `gridConfig`   | `GridConfig`                               | Full configuration object |
| `fitMode`      | `'stretch' \| 'fit-columns' \| 'auto-fit'` | Column sizing mode        |
| `customStyles` | `string`                                   | CSS to inject into grid   |
| `ssr`          | `boolean`                                  | Disable features for SSR  |
| `onRowsChange` | `(rows: TRow[]) => void`                   | Rows changed callback     |
| `onCellEdit`   | `(event: CustomEvent) => void`             | Cell edited callback      |
| `onRowClick`   | `(event: CustomEvent) => void`             | Row clicked callback      |

**Feature Props** (require corresponding feature import):

| Prop                   | Type                                                | Feature Import                   |
| ---------------------- | --------------------------------------------------- | -------------------------------- |
| `selection`            | `'cell' \| 'row' \| 'range' \| SelectionConfig`     | `features/selection`             |
| `sorting`              | `boolean \| 'single' \| 'multi' \| MultiSortConfig` | `features/sorting`               |
| `filtering`            | `boolean \| FilterConfig`                           | `features/filtering`             |
| `editing`              | `boolean \| 'click' \| 'dblclick' \| 'manual'`      | `features/editing`               |
| `clipboard`            | `boolean \| ClipboardConfig`                        | `features/clipboard`             |
| `undoRedo`             | `boolean \| UndoRedoConfig`                         | `features/undo-redo`             |
| `contextMenu`          | `boolean \| ContextMenuConfig`                      | `features/context-menu`          |
| `reorder`              | `boolean \| ReorderConfig`                          | `features/reorder`               |
| `rowReorder`           | `boolean \| RowReorderConfig`                       | `features/row-reorder`           |
| `visibility`           | `boolean \| VisibilityConfig`                       | `features/visibility`            |
| `pinnedColumns`        | `boolean`                                           | `features/pinned-columns`        |
| `pinnedRows`           | `boolean \| PinnedRowsConfig`                       | `features/pinned-rows`           |
| `groupingColumns`      | `boolean \| GroupingColumnsConfig`                  | `features/grouping-columns`      |
| `groupingRows`         | `boolean \| GroupingRowsConfig`                     | `features/grouping-rows`         |
| `tree`                 | `boolean \| TreeConfig`                             | `features/tree`                  |
| `columnVirtualization` | `boolean \| ColumnVirtualizationConfig`             | `features/column-virtualization` |
| `export`               | `boolean \| ExportConfig`                           | `features/export`                |
| `print`                | `boolean \| PrintConfig`                            | `features/print`                 |
| `responsive`           | `boolean \| ResponsivePluginConfig`                 | `features/responsive`            |
| `masterDetail`         | `boolean \| MasterDetailConfig`                     | `features/master-detail`         |
| `pivot`                | `boolean \| PivotConfig`                            | `features/pivot`                 |
| `serverSide`           | `boolean \| ServerSideConfig`                       | `features/server-side`           |

### GridColumn Props

| Prop        | Type                                          | Description             |
| ----------- | --------------------------------------------- | ----------------------- |
| `field`     | `string`                                      | Field key in row object |
| `header`    | `string`                                      | Column header text      |
| `type`      | `'string' \| 'number' \| 'date' \| 'boolean'` | Data type               |
| `editable`  | `boolean`                                     | Enable editing          |
| `sortable`  | `boolean`                                     | Enable sorting          |
| `resizable` | `boolean`                                     | Enable column resizing  |
| `width`     | `string \| number`                            | Column width            |
| `children`  | `(ctx: CellRenderContext) => ReactNode`       | Custom renderer         |
| `editor`    | `(ctx: ColumnEditorContext) => ReactNode`     | Custom editor           |

### DataGridRef Methods

| Method                    | Description                 |
| ------------------------- | --------------------------- | -------------------- |
| `getConfig()`             | Get effective configuration |
| `ready()`                 | Wait for grid ready         |
| `forceLayout()`           | Force layout recalculation  |
| `toggleGroup(key)`        | Toggle group expansion      |
| `registerStyles(id, css)` | Register custom styles      |
| `unregisterStyles(id)`    | `void`                      | Remove custom styles |

### ReactGridAdapter

The adapter class is exported for advanced use cases:

```typescript
import { ReactGridAdapter } from '@toolbox-web/grid-react';
```

In most cases, the `DataGrid` component handles adapter registration automatically.

## Demo

See the full React demo at [`demos/employee-management/react/`](../../demos/employee-management/react/) which demonstrates:

- 15+ plugins with full configuration
- Custom editors (star rating, date picker, status select, bonus slider)
- Custom renderers (status badges, rating colors, top performer stars)
- Hooks for programmatic control
- Shell integration (header, tool panels)
- Master-detail expandable rows

## Requirements

- React 18.0.0 or higher
- `@toolbox-web/grid` >= 0.2.0

## Development

```bash
# Build the library
bun nx build grid-react

# Run tests
bun nx test grid-react

# Lint
bun nx lint grid-react
```

---

## Support This Project

This grid is built and maintained by a single developer in spare time. If it saves you time or money, consider sponsoring to keep development going:

[![GitHub Sponsors](https://img.shields.io/badge/Sponsor_on_GitHub-ea4aaa?style=for-the-badge&logo=github)](https://github.com/sponsors/OysteinAmundsen)
[![Patreon](https://img.shields.io/badge/Support_on_Patreon-f96854?style=for-the-badge&logo=patreon)](https://www.patreon.com/c/OysteinAmundsen)

---

## License

MIT
