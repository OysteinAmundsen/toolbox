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

Pinned columns and utility columns (selection checkbox, master-detail expander, row-drag handle) are never virtualized away: they are always rendered, so pinned ones stay visible while scrolling horizontally. Unpinned utility columns scroll out of view like any unpinned column; pin them to keep them on screen.

## Export and Clipboard

Virtualization only limits which columns are **rendered** — `grid.columns` holds the rendered window. `ExportPlugin` and `ClipboardPlugin` still include every column, including those scrolled out of view (a cell-range copy covers only the selected columns).

The plugin always windows the columns **after** every other column plugin (pinning, grouping, pivot), whatever their order in `plugins`, so exports keep pinned order, group header rows, and pivot columns. A custom plugin can get the full list via the `'getFullColumns'` query (answered only while virtualization is active):

```typescript
const [full = this.grid.columns] = this.grid.query<ColumnConfig[]>('getFullColumns');
```

## API Methods

Access via `grid.getPluginByName('columnVirtualization')`:

```typescript
const colVirt = grid.getPluginByName('columnVirtualization');

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
