# Selection Plugin

Cell, row, and range selection for `<tbw-grid>`.

## Installation

```typescript
import { SelectionPlugin } from '@toolbox-web/grid/plugins/selection';
```

## Usage

```typescript
import { SelectionPlugin } from '@toolbox-web/grid/plugins/selection';

grid.gridConfig = {
  plugins: [
    new SelectionPlugin({
      mode: 'row', // 'cell' | 'row' | 'range'
    }),
  ],
};
```

## Configuration

| Option         | Type                                          | Default   | Description                                    |
| -------------- | --------------------------------------------- | --------- | ---------------------------------------------- |
| `mode`         | `'cell' \| 'row' \| 'range'`                  | `'cell'`  | Selection mode                                 |
| `multiSelect`  | `boolean`                                     | `true`    | Allow multiple items selected at once          |
| `triggerOn`    | `'click' \| 'dblclick'`                       | `'click'` | Mouse event type that triggers selection       |
| `enabled`      | `boolean`                                     | `true`    | Whether selection is enabled                   |
| `checkbox`     | `boolean`                                     | `false`   | Show checkbox column (row mode only)           |
| `isSelectable` | `(row, rowIndex, col?, colIndex?) => boolean` | -         | Callback to control per-row/cell selectability |

## Selection Modes

### Cell Mode (`'cell'`)

Single cell selection. Clicking a cell focuses and selects it.

### Row Mode (`'row'`)

Row selection. Clicking any cell selects the entire row.

- **Click**: Select single row
- **Ctrl+Click**: Toggle row in selection
- **Shift+Click**: Select range from last selected row
- **Shift+Arrow Up/Down**: Extend selection from anchor row
- **Shift+Page Up/Down**: Extend selection by page
- **Shift+Ctrl+Home/End**: Extend selection to first/last row

### Range Mode (`'range'`)

Rectangular range selection like Excel.

- **Click+Drag**: Select rectangular cell range
- **Shift+Click**: Extend selection to clicked cell
- **Ctrl+Click**: Start new range while keeping existing

## Accessibility

Range selection is a drag, so WCAG 2.2 [SC 2.5.7 Dragging Movements](https://www.w3.org/WAI/WCAG22/Understanding/dragging-movements.html) requires a single-pointer alternative. Two are provided: click the first cell and pick **Extend selection to here** from the context menu on the opposite corner (right-click, long-press, or `Shift+F10`), or **tap** a range corner handle to arm it and tap the cell that corner should move to. Neither reserves extra chrome — both reuse affordances that already exist. When the `ContextMenuPlugin` is installed the action joins the normal menu; otherwise the plugin hosts a minimal `role="group"` menu of its own. Keyboard users can also extend a range with `Shift+Arrow`, but keyboard equivalence alone does not satisfy SC 2.5.7.

## Events

### `selection-change`

Fired when selection changes.

```typescript
grid.addEventListener('selection-change', (e) => {
  console.log('Selected ranges:', e.detail.ranges);
  console.log('Mode:', e.detail.mode);
});
```

## API Methods

Access via `grid.getPluginByName('selection')`:

```typescript
const selection = grid.getPluginByName('selection');

// Get current selection (all modes - returns { mode, ranges, anchor })
const result = selection.getSelection();

// Get selected row indices (row mode, sorted ascending)
const indices = selection.getSelectedRowIndices();

// Get actual row objects (preferred — works in all modes)
const rows = selection.getSelectedRows<Employee>();

// Select specific rows by index (row mode only)
selection.selectRows([0, 2, 4]);

// Select all (rows in row mode, all cells in range mode)
selection.selectAll();

// Clear selection
selection.clearSelection();

// Set ranges programmatically
selection.setRanges([{ from: { row: 0, col: 0 }, to: { row: 5, col: 3 } }]);

// Check if a specific cell is in range selection
const isSelected = selection.isCellSelected(row, col);

// Get all selected cells across all ranges
const cells = selection.getSelectedCells();
```

## CSS Variables

| Variable                   | Description                     |
| -------------------------- | ------------------------------- |
| `--tbw-focus-background`   | Row focus background (row mode) |
| `--tbw-range-selection-bg` | Range selection background      |
| `--tbw-range-border-color` | Range selection border color    |
