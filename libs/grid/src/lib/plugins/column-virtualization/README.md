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

## Export, Clipboard and Column APIs

Virtualization only limits which columns are **rendered**. `grid.columns` and every column API (`setColumnVisible`, `setPinPosition`, reordering, …) keep working on the full column list, including columns scrolled out of view. `ExportPlugin` and `ClipboardPlugin` therefore include every column when you export or copy without a cell selection, or pass `columns` explicitly.

> **Known limitation ([#633](https://github.com/OysteinAmundsen/toolbox/issues/633)):** cell-range selections are tracked by rendered position. After a horizontal scroll moves the window, a range points at different columns, and `selectAll()` spans only the rendered window. Copying a selection while virtualized can therefore copy the wrong columns or only part of them. Use `copy({ columns })` or the Export plugin for complete data.

The window is computed **after** every other column plugin (pinning, grouping, pivot), whatever their order in `plugins`, from their final output — so pinned order, group header rows, and pivot columns are preserved. Custom plugins that map columns onto rendered DOM cells by index should use `this.visibleColumns` (the rendered columns), not `this.columns`.

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
