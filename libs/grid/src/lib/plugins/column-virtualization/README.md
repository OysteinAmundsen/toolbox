# Column Virtualization Plugin

Horizontal column virtualization for grids with many columns.

## Installation

```typescript
import { ColumnVirtualizationPlugin } from '@toolbox-web/grid/plugins/column-virtualization';
```

## Usage

```typescript
import { ColumnVirtualizationPlugin } from '@toolbox-web/grid/plugins/column-virtualization';

grid.gridConfig = {
  plugins: [
    new ColumnVirtualizationPlugin({
      threshold: 30, // Enable when > 30 columns
      overscan: 3, // Extra columns to render
    }),
  ],
};
```

## Configuration

| Option       | Type      | Default | Description                       |
| ------------ | --------- | ------- | --------------------------------- |
| `autoEnable` | `boolean` | `true`  | Auto-enable when threshold is met |
| `threshold`  | `number`  | `30`    | Min columns to activate           |
| `overscan`   | `number`  | `3`     | Extra columns outside viewport    |

## When to Use

Column virtualization improves performance when dealing with many columns (50+). For typical grids with < 30 columns, it adds unnecessary overhead.

The plugin automatically enables when column count exceeds the threshold.

## API Methods

Access via `grid.getPlugin(ColumnVirtualizationPlugin)`:

```typescript
const colVirt = grid.getPlugin(ColumnVirtualizationPlugin);

// Check if virtualization is active
const isActive = colVirt.getIsVirtualized();

// Get visible column range
const { start, end } = colVirt.getVisibleColumnRange();

// Scroll to a specific column
colVirt.scrollToColumn(columnIndex);

// Get column offset
const offset = colVirt.getColumnOffset(columnIndex);

// Get total width
const totalWidth = colVirt.getTotalWidth();
```
