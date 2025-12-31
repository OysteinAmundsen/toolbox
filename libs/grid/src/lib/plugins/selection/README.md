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

| Option | Type                         | Default  | Description    |
| ------ | ---------------------------- | -------- | -------------- |
| `mode` | `'cell' \| 'row' \| 'range'` | `'cell'` | Selection mode |

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

// Get selected rows (row mode)
const rows = selection.getSelectedRows();

// Get selected ranges (range mode)
const ranges = selection.getSelectedRanges();

// Select all rows
selection.selectAll();

// Clear selection
selection.clearSelection();

// Check if row is selected
const isSelected = selection.isRowSelected(rowIndex);
```

## CSS Variables

| Variable                   | Description                     |
| -------------------------- | ------------------------------- |
| `--tbw-focus-background`   | Row focus background (row mode) |
| `--tbw-range-selection-bg` | Range selection background      |
| `--tbw-range-border-color` | Range selection border color    |
