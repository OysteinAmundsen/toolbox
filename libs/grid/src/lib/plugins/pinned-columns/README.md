# Pinned Columns Plugin

Pin columns to left or right edges for horizontal scrolling.

## Installation

```typescript
import { PinnedColumnsPlugin } from '@toolbox-web/grid/plugins/pinned-columns';
```

## Usage

```typescript
import { PinnedColumnsPlugin } from '@toolbox-web/grid/plugins/pinned-columns';

grid.gridConfig = {
  plugins: [new PinnedColumnsPlugin()],
};

// Pin columns via column config
grid.columns = [
  { field: 'id', sticky: 'left' },
  { field: 'name' },
  { field: 'email' },
  { field: 'actions', sticky: 'right' },
];
```

## Column Options

| Option   | Type                | Description        |
| -------- | ------------------- | ------------------ |
| `sticky` | `'left' \| 'right'` | Pin column to edge |

## API Methods

Access via `grid.getPlugin(PinnedColumnsPlugin)`:

```typescript
const pinned = grid.getPlugin(PinnedColumnsPlugin);

// Pin a column
pinned.pin('id', 'left');

// Unpin a column
pinned.unpin('id');

// Get pinned columns
const leftPinned = pinned.getPinned('left');
const rightPinned = pinned.getPinned('right');
```

## Behavior with Other Plugins

### ReorderPlugin

Pinned columns **cannot be reordered**. When using both `PinnedColumnsPlugin` and `ReorderPlugin`, columns with `sticky: 'left'` or `sticky: 'right'` are automatically marked as non-draggable. This ensures the sticky positioning behavior remains consistent.

```typescript
grid.gridConfig = {
  plugins: [new PinnedColumnsPlugin(), new ReorderPlugin()],
  columns: [
    { field: 'id', sticky: 'left' }, // Not draggable
    { field: 'name' }, // Draggable
    { field: 'actions', sticky: 'right' }, // Not draggable
  ],
};
```
