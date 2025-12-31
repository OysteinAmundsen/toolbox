# Column Reorder Plugin

Drag-and-drop column reordering.

## Installation

```typescript
import { ReorderPlugin } from '@toolbox-web/grid/plugins/reorder';
```

## Usage

```typescript
import { ReorderPlugin } from '@toolbox-web/grid/plugins/reorder';

grid.gridConfig = {
  plugins: [new ReorderPlugin()],
};

// Disable reordering for specific columns
grid.columns = [
  { field: 'id', reorderable: false }, // Cannot be moved
  { field: 'name' },
  { field: 'email' },
];
```

## Column Options

| Option        | Type      | Default | Description                  |
| ------------- | --------- | ------- | ---------------------------- |
| `reorderable` | `boolean` | `true`  | Allow column to be reordered |

## Configuration

| Option              | Type      | Default | Description                        |
| ------------------- | --------- | ------- | ---------------------------------- |
| `animation`         | `boolean` | `true`  | Whether to animate column movement |
| `animationDuration` | `number`  | `200`   | Animation duration in milliseconds |

## Limitations

### Sticky (Pinned) Columns

Columns with `sticky: 'left'` or `sticky: 'right'` cannot be reordered. This is by design:

- Sticky columns use `position: sticky` CSS which requires them to stay in their designated position
- Allowing drag-and-drop on sticky columns would conflict with their pinned behavior
- The plugin automatically marks sticky columns as non-draggable

```typescript
// This column will NOT be draggable
{ field: 'id', sticky: 'left' }

// Use PinnedColumnsPlugin alongside ReorderPlugin
grid.gridConfig = {
  plugins: [
    new ReorderPlugin(),
    new PinnedColumnsPlugin(),
  ],
  columns: [
    { field: 'id', sticky: 'left' },  // Pinned, not draggable
    { field: 'name' },                 // Draggable
    { field: 'actions', sticky: 'right' }, // Pinned, not draggable
  ],
};
```

## Events

### `column-move`

Fired when columns are reordered.

```typescript
grid.addEventListener('column-move', (e) => {
  console.log('Field:', e.detail.field);
  console.log('From index:', e.detail.fromIndex);
  console.log('To index:', e.detail.toIndex);
  console.log('New order:', e.detail.columnOrder);
});
```

## API Methods

Access via `grid.getPlugin(ReorderPlugin)`:

```typescript
const reorder = grid.getPlugin(ReorderPlugin);

// Move column programmatically
reorder.moveColumn('email', 0); // Move to first position
```
