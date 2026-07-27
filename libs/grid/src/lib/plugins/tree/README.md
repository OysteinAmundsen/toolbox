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

| Option            | Type                                                  | Default      | Description                                 |
| ----------------- | ----------------------------------------------------- | ------------ | ------------------------------------------- |
| `childrenField`   | `string`                                              | `'children'` | Property name for child nodes               |
| `autoDetect`      | `boolean`                                             | `true`       | Auto-detect tree structure                  |
| `defaultExpanded` | `boolean`                                             | `false`      | Expand all nodes initially                  |
| `indentWidth`     | `number`                                              | `20`         | Pixels of indentation per level             |
| `showExpandIcons` | `boolean`                                             | `true`       | Show expand/collapse icons                  |
| `animation`       | `false \| 'slide' \| 'fade'`                          | `'slide'`    | Expand/collapse animation style             |
| `loadChildren`    | `(params) => Promise<TreeRow[]> \| Subscribable<...>` | —            | Lazy-load a node's children on first expand |
| `hasChildren`     | `(row) => boolean`                                    | —            | Predicate marking nodes that have children  |

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

### `tree-load-start` / `tree-load-end` / `tree-load-error`

Fired around lazy child loading (both the `loadChildren` and `ServerSidePlugin` routes).

```typescript
grid.addEventListener('tree-load-start', (e) => console.log('loading', e.detail.key));
grid.addEventListener('tree-load-end', (e) => console.log('loaded', e.detail.childCount));
grid.addEventListener('tree-load-error', (e) => console.error(e.detail.error));
```

## Lazy Loading Children (no ServerSidePlugin)

Use `loadChildren` when you only need on-demand children — not server-side
pagination/sorting/filtering of the root nodes. It is called once per node the
first time that node is expanded while its children are unloaded.

```typescript
new TreePlugin({
  // Show an expand toggle before the children are known
  hasChildren: (row) => row.type === 'folder',
  loadChildren: async ({ row, signal }) => {
    const res = await fetch(`/api/nodes/${row.id}/children`, { signal });
    return res.json();
  },
});
```

While the request is in flight the toggle is replaced by the grid's small
spinner (`.tbw-spinner--small`) and the row carries `aria-busy="true"`. On
failure the node leaves its loading state, so collapsing and re-expanding
retries the fetch. `loadChildren` may also return a `Subscribable` (e.g. an
Angular `HttpClient` observable); the subscription is torn down on detach.

`loadChildren` is ignored when `ServerSidePlugin` is active — child data then
flows through `dataSource.getChildRows()`.

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
