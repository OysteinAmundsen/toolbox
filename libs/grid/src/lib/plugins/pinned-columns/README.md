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
  { field: 'id', pinned: 'left' },
  { field: 'name' },
  { field: 'email' },
  { field: 'actions', pinned: 'right' },
];
```

## Column Options

| Option   | Type                                    | Description        |
| -------- | --------------------------------------- | ------------------ |
| `pinned` | `'left' \| 'right' \| 'start' \| 'end'` | Pin column to edge |

### Physical vs Logical Values

For RTL (Right-to-Left) language support, use logical values:

| Value     | LTR Result | RTL Result | Description                   |
| --------- | ---------- | ---------- | ----------------------------- |
| `'left'`  | Left edge  | Left edge  | Physical left edge            |
| `'right'` | Right edge | Right edge | Physical right edge           |
| `'start'` | Left edge  | Right edge | Logical start (adapts to dir) |
| `'end'`   | Right edge | Left edge  | Logical end (adapts to dir)   |

**Recommended:** Use `'start'` and `'end'` for applications that support both LTR and RTL:

```typescript
// Works correctly in both LTR and RTL layouts
grid.columns = [
  { field: 'id', pinned: 'start' }, // Left in LTR, Right in RTL
  { field: 'name' },
  { field: 'actions', pinned: 'end' }, // Right in LTR, Left in RTL
];
```

## API Methods

Access via `grid.getPlugin(PinnedColumnsPlugin)`:

```typescript
const pinned = grid.getPlugin(PinnedColumnsPlugin);

// Get left pinned columns (after resolving logical positions)
const leftPinned = pinned.getLeftPinnedColumns();

// Get right pinned columns (after resolving logical positions)
const rightPinned = pinned.getRightPinnedColumns();

// Refresh sticky offsets (e.g., after column resize)
pinned.refreshStickyOffsets();

// Clear all sticky positioning
pinned.clearStickyPositions();
```

## Behavior with Other Plugins

### ReorderPlugin

Pinned columns **cannot be reordered**. When using both `PinnedColumnsPlugin` and `ReorderPlugin`, columns with any `pinned` value (`'left'`, `'right'`, `'start'`, or `'end'`) are automatically marked as non-draggable. This ensures the sticky positioning behavior remains consistent.

```typescript
grid.gridConfig = {
  plugins: [new PinnedColumnsPlugin(), new ReorderPlugin()],
  columns: [
    { field: 'id', pinned: 'left' }, // Not draggable
    { field: 'name' }, // Draggable
    { field: 'actions', pinned: 'right' }, // Not draggable
  ],
};
```
