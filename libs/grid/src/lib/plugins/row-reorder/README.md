# Row Reorder Plugin

Enables row reordering via keyboard shortcuts and drag-and-drop.

## Installation

```ts
import { RowReorderPlugin } from '@toolbox-web/grid/plugins/row-reorder';

// Or from the all-in-one bundle
import { RowReorderPlugin } from '@toolbox-web/grid/all';
```

## Basic Usage

```ts
import '@toolbox-web/grid';
import { RowReorderPlugin } from '@toolbox-web/grid/plugins/row-reorder';

const grid = document.querySelector('tbw-grid');
grid.gridConfig = {
  columns: [
    { field: 'id', header: 'ID' },
    { field: 'name', header: 'Name' },
    { field: 'priority', header: 'Priority' },
  ],
  plugins: [new RowReorderPlugin()],
};

grid.addEventListener('row-move', (e) => {
  console.log('Row moved:', e.detail);
  // Persist new order to server
  saveOrder(e.detail.rows);
});
```

## Configuration

| Option               | Type                                    | Default  | Description                            |
| -------------------- | --------------------------------------- | -------- | -------------------------------------- |
| `enableKeyboard`     | `boolean`                               | `true`   | Enable Ctrl+Up/Down keyboard shortcuts |
| `showDragHandle`     | `boolean`                               | `true`   | Show drag handle column                |
| `dragHandlePosition` | `'left' \| 'right'`                     | `'left'` | Position of drag handle column         |
| `dragHandleWidth`    | `number`                                | `40`     | Width of drag handle column (px)       |
| `canMove`            | `(row, from, to, direction) => boolean` | -        | Validation callback                    |
| `debounceMs`         | `number`                                | `150`    | Debounce time for keyboard moves       |
| `animation`          | `false \| 'flip'`                       | `'flip'` | Animation style for row transitions    |

## Keyboard Shortcuts

| Key        | Action                |
| ---------- | --------------------- |
| `Ctrl + ↑` | Move focused row up   |
| `Ctrl + ↓` | Move focused row down |

Rapid keyboard moves are debounced - a single `row-move` event is emitted after the debounce period.

## Events

### `row-move`

Fired when a row is moved. Cancelable.

```ts
grid.addEventListener('row-move', (e) => {
  const { row, fromIndex, toIndex, rows, source } = e.detail;

  // Cancel the move
  if (row.locked) {
    e.preventDefault();
  }
});
```

**Event Detail:**

| Property    | Type                   | Description                  |
| ----------- | ---------------------- | ---------------------------- |
| `row`       | `T`                    | The row that was moved       |
| `fromIndex` | `number`               | Original index               |
| `toIndex`   | `number`               | New index                    |
| `rows`      | `T[]`                  | Full rows array in new order |
| `source`    | `'keyboard' \| 'drag'` | How the move was initiated   |

## Validation

Use the `canMove` callback to prevent invalid moves:

```ts
new RowReorderPlugin({
  canMove: (row, fromIndex, toIndex, direction) => {
    // Prevent moving locked rows
    if (row.locked) return false;

    // Only allow moving within same group
    if (row.groupId !== getGroupAtIndex(toIndex)) return false;

    return true;
  },
});
```

## API Methods

```ts
const plugin = grid.getPlugin(RowReorderPlugin);

// Move row programmatically
plugin.moveRow(fromIndex, toIndex);

// Check if move is valid
const canMove = plugin.canMoveRow(fromIndex, toIndex);
```

## CSS Variables

| Variable                          | Description             |
| --------------------------------- | ----------------------- |
| `--tbw-row-reorder-handle-color`  | Drag handle icon color  |
| `--tbw-row-reorder-handle-hover`  | Drag handle hover color |
| `--tbw-row-reorder-indicator`     | Drop indicator color    |
| `--tbw-row-reorder-moving-bg`     | Moving row background   |
| `--tbw-row-reorder-moving-border` | Moving row border       |
| `--tbw-animation-duration`        | FLIP animation duration |

## Styling the Drag Handle

```css
/* Customize drag handle appearance */
.dg-row-drag-handle {
  cursor: grab;
}

.dg-row-drag-handle:active {
  cursor: grabbing;
}

/* Customize grip icon */
.dg-row-drag-handle .drag-icon span {
  background-color: var(--my-custom-color);
}
```
