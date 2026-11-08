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

## Selection and Focus

`SelectionPlugin` ranges, the selection anchor, and the `col` of every `CellRange` index the full list of visible columns, not the rendered window. A selection stays on its columns while the grid scrolls horizontally, `selectAll()` (`Ctrl+A`) covers every column, and copying or pasting a selection uses the selected columns even when they are scrolled out of view. Column-mode selection (`selectColumn()`, `selectAllColumns()`, `getSelectedColumns()`) works on columns outside the window too.

The focused cell also stays on its column. When you scroll it out of view, no cell shows the focus ring and `grid.focusedCell.colIndex` is `-1`, while `grid.focusedCell.field` still names the column. The next key press on the grid or one of its cells scrolls the column back into view before it is handled, as in a spreadsheet. Keys typed into a control (an input or button rendered in a header or cell) leave it scrolled out. `Home` / `End` go to the first / last column of the whole grid, not of the rendered window.

Arrow keys and `Tab` step through every column: they scroll the next column into view instead of stopping at the rendered window's edge or jumping into a pinned column.

A paste without a multi-cell selection writes into consecutive columns of the full list, so a wide paste continues past the rendered window instead of stopping at its edge. A selected range pastes into the columns it selects.

## Editing

Rows with open editors follow horizontal scrolling like other rows: an editor whose column stays in view keeps its element, focus and draft, and columns that scroll into view get editors (`mode: 'grid'`, or the row being edited in row mode). A focused editor whose column scrolls out of view is blurred first, which commits its value. `Tab` in an editor continues to the next editable column even when it is outside the rendered window, and `beginCellEdit()` scrolls an off-window column into view before opening its editor.

> **Known limitations:**
>
> - Widening the grid or narrowing a column only re-windows on the next horizontal scroll ([#641](https://github.com/OysteinAmundsen/toolbox/issues/641)).
> - Responsive card layout shows only the windowed columns ([#635](https://github.com/OysteinAmundsen/toolbox/issues/635)).
> - `aria-colcount` / `aria-colindex` describe the rendered window, not the full grid ([#642](https://github.com/OysteinAmundsen/toolbox/issues/642)).

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
