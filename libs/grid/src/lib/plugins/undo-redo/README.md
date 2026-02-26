# Undo/Redo Plugin

Edit history with undo and redo support.

## Installation

```typescript
import { UndoRedoPlugin } from '@toolbox-web/grid/plugins/undo-redo';
```

## Usage

```typescript
import { UndoRedoPlugin } from '@toolbox-web/grid/plugins/undo-redo';
import { EditingPlugin } from '@toolbox-web/grid/plugins/editing';

grid.gridConfig = {
  plugins: [
    new EditingPlugin(), // Required dependency
    new UndoRedoPlugin({
      maxHistorySize: 50,
    }),
  ],
};
```

> **Note:** `UndoRedoPlugin` requires `EditingPlugin` — it tracks cell edit history and will not function without it.

## Configuration

| Option           | Type     | Default | Description                |
| ---------------- | -------- | ------- | -------------------------- |
| `maxHistorySize` | `number` | `100`   | Maximum actions in history |

## Keyboard Shortcuts

| Shortcut                   | Action                  |
| -------------------------- | ----------------------- |
| `Ctrl+Z`                   | Undo last action        |
| `Ctrl+Y` or `Ctrl+Shift+Z` | Redo last undone action |

## API Methods

Access via `grid.getPlugin(UndoRedoPlugin)` or `grid.getPluginByName('undoRedo')`:

```typescript
const history = grid.getPluginByName('undoRedo');

// Undo/redo
history.undo();
history.redo();

// Check availability
const canUndo = history.canUndo();
const canRedo = history.canRedo();

// Clear history
history.clearHistory();

// Record an edit manually
history.recordEdit(rowIndex, field, oldValue, newValue);

// Get stacks
const undoStack = history.getUndoStack();
const redoStack = history.getRedoStack();
```

### Compound Actions (Transactions)

When a single user edit triggers cascaded changes to other fields, group them
into one undo step using `beginTransaction()` / `endTransaction()`:

```typescript
grid.addEventListener('cell-commit', (e) => {
  const undoRedo = grid.getPluginByName('undoRedo');
  undoRedo.beginTransaction();

  // Manually record cascaded side-effects
  const oldTotal = row.total;
  undoRedo.recordEdit(rowIndex, 'total', oldTotal, newTotal);
  grid.updateRow(rowId, { total: newTotal });

  // End after the auto-recorded original edit is captured
  queueMicrotask(() => undoRedo.endTransaction());
});
```

Undoing a compound action reverts **all** grouped edits in reverse order;
redoing replays them in forward order.

## Events

### `undo`

Fired when an undo operation is performed.

```typescript
grid.addEventListener('undo', (e) => {
  console.log('Action undone:', e.detail.action);
});
```

### `redo`

Fired when a redo operation is performed.

```typescript
grid.addEventListener('redo', (e) => {
  console.log('Action redone:', e.detail.action);
});
```
