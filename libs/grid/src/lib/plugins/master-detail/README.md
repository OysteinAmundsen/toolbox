# Master Detail Plugin

Expandable detail rows for showing nested content.

## Installation

```typescript
import { MasterDetailPlugin } from '@toolbox-web/grid/plugins/master-detail';
```

## Usage

```typescript
import { MasterDetailPlugin } from '@toolbox-web/grid/plugins/master-detail';

grid.gridConfig = {
  plugins: [
    new MasterDetailPlugin({
      detailRenderer: (params) => {
        const div = document.createElement('div');
        div.innerHTML = `
          <h4>Details for ${params.row.name}</h4>
          <p>Email: ${params.row.email}</p>
          <p>Notes: ${params.row.notes}</p>
        `;
        return div;
      },
    }),
  ],
};
```

## Configuration

| Option                   | Type                                                                        | Default   | Description                    |
| ------------------------ | --------------------------------------------------------------------------- | --------- | ------------------------------ |
| `detailRenderer`         | `(row: Record<string, unknown>, rowIndex: number) => HTMLElement \| string` | -         | Render detail content          |
| `detailHeight`           | `number \| 'auto'`                                                          | `'auto'`  | Detail row height              |
| `expandOnRowClick`       | `boolean`                                                                   | `false`   | Expand on row click            |
| `collapseOnClickOutside` | `boolean`                                                                   | `false`   | Collapse when clicking outside |
| `showExpandColumn`       | `boolean`                                                                   | `true`    | Show expand/collapse column    |
| `animation`              | `false \| 'slide' \| 'fade'`                                                | `'slide'` | Expand/collapse animation      |

## Events

### `detail-expand`

Fired when detail row is expanded/collapsed.

```typescript
grid.addEventListener('detail-expand', (e) => {
  console.log('Row index:', e.detail.rowIndex);
  console.log('Row:', e.detail.row);
  console.log('Expanded:', e.detail.expanded);
});
```

## API Methods

Access via `grid.getPluginByName('masterDetail')`:

```typescript
const masterDetail = grid.getPluginByName('masterDetail');

// Expand/collapse detail
masterDetail.expand(rowIndex);
masterDetail.collapse(rowIndex);
masterDetail.toggle(rowIndex);

// Check state
const isExpanded = masterDetail.isExpanded(rowIndex);

// Expand all rows
masterDetail.expandAll();

// Collapse all
masterDetail.collapseAll();

// Get indices of all expanded rows
const expanded = masterDetail.getExpandedRows();

// Get the detail DOM element for a row
const element = masterDetail.getDetailElement(rowIndex);

// Get async detail data fetched via ServerSide
const childRows = masterDetail.getDetailData(rowIndex);

// Check if detail data is loading
const loading = masterDetail.isDetailLoading(rowIndex);
```

## Server-Side Data (Unified DataSource)

When used together with `ServerSidePlugin`, detail data can be loaded asynchronously.
On expand, MasterDetail fires a `datasource:fetch-children` query. The ServerSide
plugin calls `getChildRows()` and delivers the result via `datasource:children`.

```typescript
import { ServerSidePlugin } from '@toolbox-web/grid/plugins/server-side';
import { MasterDetailPlugin } from '@toolbox-web/grid/plugins/master-detail';

grid.gridConfig = {
  plugins: [
    new ServerSidePlugin({
      dataSource: {
        getRows: async (params) => {
          const res = await fetch(`/api/orders?start=${params.startNode}&end=${params.endNode}`);
          return res.json();
        },
        getChildRows: async (params) => {
          const { row } = params.context;
          const res = await fetch(`/api/orders/${row.id}/items`);
          return { rows: await res.json() };
        },
      },
    }),
    new MasterDetailPlugin({
      detailRenderer: (row, rowIndex) => {
        const detail = grid.getPluginByName('masterDetail');
        const childRows = detail.getDetailData(rowIndex);
        if (!childRows) return '<div class="loading">Loading...</div>';
        return `<ul>${childRows.map((item) => `<li>${item.name}</li>`).join('')}</ul>`;
      },
    }),
  ],
};
```

When ServerSide is not present, `detailRenderer` works synchronously as today.
