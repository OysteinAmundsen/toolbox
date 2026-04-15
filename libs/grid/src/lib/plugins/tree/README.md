# Tree Plugin

Hierarchical tree data with expand/collapse functionality.

## Installation

```typescript
import { TreePlugin } from '@toolbox-web/grid/plugins/tree';
```

## Usage

```typescript
import { TreePlugin } from '@toolbox-web/grid/plugins/tree';

// Data with nested children
const data = [
  {
    name: 'Documents',
    children: [{ name: 'Report.pdf' }, { name: 'Notes.txt' }],
  },
  {
    name: 'Images',
    children: [{ name: 'Photo.jpg' }],
  },
];

grid.gridConfig = {
  plugins: [
    new TreePlugin({
      childrenField: 'children', // Property containing child nodes
      defaultExpanded: false, // Start collapsed
    }),
  ],
};
grid.rows = data;
```

## Configuration

| Option            | Type                         | Default      | Description                     |
| ----------------- | ---------------------------- | ------------ | ------------------------------- |
| `childrenField`   | `string`                     | `'children'` | Property name for child nodes   |
| `autoDetect`      | `boolean`                    | `true`       | Auto-detect tree structure      |
| `defaultExpanded` | `boolean`                    | `false`      | Expand all nodes initially      |
| `indentWidth`     | `number`                     | `20`         | Pixels of indentation per level |
| `showExpandIcons` | `boolean`                    | `true`       | Show expand/collapse icons      |
| `animation`       | `false \| 'slide' \| 'fade'` | `'slide'`    | Expand/collapse animation style |

## Auto-Detection

The Tree plugin automatically detects tree structures in your data. If rows contain a property with an array of nested objects, it will be used as the children field.

## Events

### `tree-expand`

Fired when a node is expanded or collapsed.

```typescript
grid.addEventListener('tree-expand', (e) => {
  console.log('Key:', e.detail.key);
  console.log('Row:', e.detail.row);
  console.log('Expanded:', e.detail.expanded);
  console.log('Depth:', e.detail.depth);
});
```

## Server-Side Data (Unified DataSource)

When used together with `ServerSidePlugin`, tree data is loaded through the
unified DataSource architecture. The Tree plugin automatically claims
`datasource:data` events and processes child rows delivered via
`datasource:children` events.

```typescript
import { ServerSidePlugin } from '@toolbox-web/grid/plugins/server-side';
import { TreePlugin } from '@toolbox-web/grid/plugins/tree';

grid.gridConfig = {
  plugins: [
    new ServerSidePlugin({
      dataSource: {
        getRows: async (params) => {
          const res = await fetch(`/api/tree?start=${params.startRow}&end=${params.endRow}`);
          return res.json();
        },
        getChildRows: async (parentRow) => {
          const res = await fetch(`/api/tree/${parentRow.id}/children`);
          return res.json();
        },
      },
    }),
    new TreePlugin({ childrenField: 'children' }),
  ],
};
```

The `ServerSidePlugin` manages data fetching and pagination while the
Tree plugin handles expand/collapse and flattening. Viewport mapping
is handled automatically — the Tree plugin translates flat row indices
to top-level node indices for correct pagination.

## API Methods

Access via `grid.getPluginByName('tree')`:

```typescript
const tree = grid.getPluginByName('tree');

// Expand a node by key
tree.expand(key);

// Collapse a node by key
tree.collapse(key);

// Toggle expand/collapse
tree.toggle(key);

// Expand all nodes
tree.expandAll();

// Collapse all nodes
tree.collapseAll();

// Check if node is expanded
const isExpanded = tree.isExpanded(key);

// Get all expanded node keys
const expandedKeys = tree.getExpandedKeys();

// Expand all ancestors so a node becomes visible
tree.expandToKey(key);

// Get flattened tree rows (with depth, parentKey, etc.)
const flatRows = tree.getFlattenedRows();

// Get row data by key
const row = tree.getRowByKey(key);
```

## CSS Variables

| Variable                   | Default                       | Description                        |
| -------------------------- | ----------------------------- | ---------------------------------- |
| `--tbw-tree-indent-width`  | `var(--tbw-tree-toggle-size)` | Indentation per level              |
| `--tbw-tree-toggle-size`   | `1.25em`                      | Toggle icon width/height           |
| `--tbw-tree-accent`        | `var(--tbw-color-accent)`     | Toggle icon hover color            |
| `--tbw-animation-duration` | `200ms`                       | Expand/collapse animation duration |
| `--tbw-animation-easing`   | `ease-out`                    | Animation easing curve             |
| `--tbw-tree-accent`        | Expand/collapse icon color    |
