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

| Option           | Type                      | Description           |
| ---------------- | ------------------------- | --------------------- |
| `detailRenderer` | `(params) => HTMLElement` | Render detail content |
| `detailHeight`   | `number \| 'auto'`        | Detail row height     |
| `expandOnClick`  | `boolean`                 | Expand on row click   |

## Detail Renderer Parameters

```typescript
interface DetailRenderParams {
  row: any; // Row data
  rowIndex: number; // Row index
  api: GridApi; // Grid API access
}
```

## Events

### `detail-expand`

Fired when detail row is expanded/collapsed.

```typescript
grid.addEventListener('detail-expand', (e) => {
  console.log('Row:', e.detail.row);
  console.log('Expanded:', e.detail.expanded);
});
```

## API Methods

Access via `grid.getPlugin(MasterDetailPlugin)`:

```typescript
const masterDetail = grid.getPlugin(MasterDetailPlugin);

// Expand/collapse detail
masterDetail.expand(rowIndex);
masterDetail.collapse(rowIndex);
masterDetail.toggle(rowIndex);

// Check state
const isExpanded = masterDetail.isExpanded(rowIndex);

// Collapse all
masterDetail.collapseAll();
```
