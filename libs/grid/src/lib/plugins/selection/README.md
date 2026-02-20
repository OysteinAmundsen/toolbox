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

### Range Mode (`'range'`)

Rectangular range selection like Excel.

- **Click+Drag**: Select rectangular cell range
- **Shift+Click**: Extend selection to clicked cell
- **Ctrl+Click**: Start new range while keeping existing

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

Access via `grid.getPlugin(SelectionPlugin)`:

```typescript
const selection = grid.getPlugin(SelectionPlugin);

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
