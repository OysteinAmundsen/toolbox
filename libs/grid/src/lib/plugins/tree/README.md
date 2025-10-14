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
      expandedByDefault: false, // Start collapsed
    }),
  ],
};
grid.rows = data;
```

## Configuration

| Option              | Type      | Default      | Description                     |
| ------------------- | --------- | ------------ | ------------------------------- |
| `childrenField`     | `string`  | `'children'` | Property name for child nodes   |
| `expandedByDefault` | `boolean` | `false`      | Expand all nodes initially      |
| `indent`            | `number`  | `20`         | Pixels of indentation per level |

## Auto-Detection

The Tree plugin automatically detects tree structures in your data. If rows contain a property with an array of nested objects, it will be used as the children field.

## Events

### `tree-expand`

Fired when a node is expanded or collapsed.

```typescript
grid.addEventListener('tree-expand', (e) => {
  console.log('Row:', e.detail.row);
  console.log('Expanded:', e.detail.expanded);
  console.log('Level:', e.detail.level);
});
```

## API Methods

Access via `grid.getPlugin(TreePlugin)`:

```typescript
const tree = grid.getPlugin(TreePlugin);

// Expand a node
tree.expand(rowIndex);

// Collapse a node
tree.collapse(rowIndex);

// Toggle expand/collapse
tree.toggle(rowIndex);

// Expand all nodes
tree.expandAll();

// Collapse all nodes
tree.collapseAll();

// Check if node is expanded
const isExpanded = tree.isExpanded(rowIndex);

// Get node depth level
const level = tree.getLevel(rowIndex);
```

## CSS Variables

| Variable                  | Description                |
| ------------------------- | -------------------------- |
| `--tbw-tree-indent`       | Indentation per level      |
| `--tbw-tree-toggle-color` | Expand/collapse icon color |
