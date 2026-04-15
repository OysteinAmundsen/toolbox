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

| Option            | Type                         | Default      | Description                                      |
| ----------------- | ---------------------------- | ------------ | ------------------------------------------------ |
| `childrenField`   | `string`                     | `'children'` | Property name for child nodes                    |
| `autoDetect`      | `boolean`                    | `true`       | Auto-detect tree structure                       |
| `defaultExpanded` | `boolean`                    | `false`      | Expand all nodes initially                       |
| `indentWidth`     | `number`                     | `20`         | Pixels of indentation per level                  |
| `showExpandIcons` | `boolean`                    | `true`       | Show expand/collapse icons                       |
| `animation`       | `false \| 'slide' \| 'fade'` | `'slide'`    | Expand/collapse animation style                  |
| `dataSource`      | `TreeDataSource`             | —            | Data source for lazy-loading tree data           |
| `pageSize`        | `number`                     | `50`         | Top-level nodes per page when using `dataSource` |

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

Fired during lazy data source loading:

```typescript
grid.addEventListener('tree-load-start', () => console.log('Loading...'));
grid.addEventListener('tree-load-end', (e) => {
  console.log(`Loaded ${e.detail.loadedCount}/${e.detail.totalTopLevelCount}`);
});
grid.addEventListener('tree-load-error', (e) => console.error(e.detail.error));
```

## Lazy Loading (Data Source)

For large datasets where top-level nodes are paginated by the server, use the
`dataSource` option to load tree data on demand as the user scrolls.

```typescript
const tree = new TreePlugin({
  pageSize: 50,
  dataSource: {
    async getRows(params) {
      const res = await fetch(`/api/departments?start=${params.startNode}&count=${params.count}`);
      return res.json();
      // Expected response: { rows: [...], totalTopLevelCount: 500 }
    },
  },
});
```

The server returns pages of **top-level nodes with children already embedded**.
Pagination operates at the top-level node granularity. Expand/collapse of
loaded nodes works entirely client-side without additional server requests.

### Sort/Filter Pass-Through

When sort or filter state changes, the tree resets and re-fetches from page 0,
passing `sortModel` and `filterModel` to the data source so the server can
apply sorting/filtering.

### Programmatic API (lazy mode)

```typescript
const tree = grid.getPluginByName('tree');

// Set or change data source at runtime
tree.setDataSource(myDataSource);

// Re-fetch all data from the beginning
tree.refreshDataSource();

// Manually load the next page
await tree.loadMore();

// Check loading state
console.log(tree.isLoading);
console.log(tree.getTotalTopLevelCount());
console.log(tree.getLoadedTopLevelCount());
```

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
