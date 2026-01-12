# @toolbox-web/grid-react

React adapter library for [@toolbox-web/grid](https://www.npmjs.com/package/@toolbox-web/grid) - a high-performance, framework-agnostic data grid web component.

## Installation

```bash
npm install @toolbox-web/grid @toolbox-web/grid-react
```

## Basic Usage

```tsx
import { DataGrid, GridColumn } from '@toolbox-web/grid-react';

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
      renderer: (ctx) => (
        <span className={`badge badge-${ctx.value.toLowerCase()}`}>
          {ctx.value}
        </span>
      ),
    },
  ],
};

function EmployeeGrid() {
  return <DataGrid rows={employees} gridConfig={config} />;
}
```

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

| Prop               | Type                                      | Default   | Description                          |
| ------------------ | ----------------------------------------- | --------- | ------------------------------------ |
| `children`         | `(ctx: DetailPanelContext) => ReactNode`  | Required  | Render function for panel content    |
| `showExpandColumn` | `boolean`                                 | `true`    | Show expand/collapse chevron column  |
| `animation`        | `'slide' \| 'fade' \| false`              | `'slide'` | Animation style for expand/collapse  |

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

| Prop       | Type                                    | Default    | Description                          |
| ---------- | --------------------------------------- | ---------- | ------------------------------------ |
| `id`       | `string`                                | Required   | Unique panel identifier              |
| `title`    | `string`                                | Required   | Panel title in accordion header      |
| `children` | `(ctx: ToolPanelContext) => ReactNode`  | Required   | Render function for panel content    |
| `icon`     | `string`                                | -          | Icon for the accordion header        |
| `tooltip`  | `string`                                | -          | Tooltip text for header              |
| `order`    | `number`                                | `100`      | Panel sort order (lower = higher)    |

## Using Refs

Access the grid instance for programmatic control:

```tsx
import { DataGrid, DataGridRef } from '@toolbox-web/grid-react';
import { useRef } from 'react';

function MyComponent() {
  const gridRef = useRef<DataGridRef>(null);

  const handleExport = async () => {
    const config = await gridRef.current?.getConfig();
    console.log('Columns:', config?.columns);
  };

  return (
    <>
      <button onClick={handleExport}>Export</button>
      <DataGrid ref={gridRef} rows={employees} />
    </>
  );
}
```

## useGrid Hook

For more complex scenarios, use the `useGrid` hook:

```tsx
import { DataGrid, useGrid } from '@toolbox-web/grid-react';

function MyComponent() {
  const { ref, isReady, forceLayout } = useGrid<Employee>();

  return (
    <>
      <button onClick={() => forceLayout()}>Refresh Layout</button>
      <DataGrid ref={ref} rows={employees} />
    </>
  );
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

```tsx
import { DataGrid, useGridEvent, DataGridRef } from '@toolbox-web/grid-react';

function MyComponent() {
  const gridRef = useRef<DataGridRef>(null);

  useGridEvent(gridRef, 'selection-change', (event) => {
    console.log('Selected:', event.detail.selectedRows);
  });

  return <DataGrid ref={gridRef} rows={employees} />;
}
```

## Plugins

Use plugins from `@toolbox-web/grid/all`:

```tsx
import { DataGrid } from '@toolbox-web/grid-react';
import { SelectionPlugin, FilteringPlugin } from '@toolbox-web/grid/all';

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

## Custom Styles

Inject custom CSS into the grid's shadow DOM:

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

### DataGrid Props

| Prop           | Type                                       | Description                   |
| -------------- | ------------------------------------------ | ----------------------------- |
| `rows`         | `TRow[]`                                   | Row data to display           |
| `columns`      | `ColumnConfig[]`                           | Column definitions            |
| `gridConfig`   | `GridConfig`                               | Full configuration object     |
| `fitMode`      | `'stretch' \| 'fit-columns' \| 'auto-fit'` | Column sizing mode            |
| `editOn`       | `'click' \| 'dblclick' \| 'none'`          | Edit trigger                  |
| `customStyles` | `string`                                   | CSS to inject into shadow DOM |
| `onRowsChange` | `(rows: TRow[]) => void`                   | Rows changed callback         |
| `onCellEdit`   | `(event: CustomEvent) => void`             | Cell edited callback          |
| `onRowClick`   | `(event: CustomEvent) => void`             | Row clicked callback          |

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
| ------------------------- | --------------------------- |
| `getConfig()`             | Get effective configuration |
| `ready()`                 | Wait for grid ready         |
| `forceLayout()`           | Force layout recalculation  |
| `toggleGroup(key)`        | Toggle group expansion      |
| `registerStyles(id, css)` | Register custom styles      |
| `unregisterStyles(id)`    | Remove custom styles        |

## Requirements

- React 18.0.0 or higher
- @toolbox-web/grid 0.2.0 or higher

## License

MIT
