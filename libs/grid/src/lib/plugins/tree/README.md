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

## API Methods

Access via `grid.getPlugin(TreePlugin)`:

```typescript
const tree = grid.getPlugin(TreePlugin);

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
