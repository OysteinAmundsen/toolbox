# Undo/Redo Plugin

Edit history with undo and redo support.

## Installation

```typescript
import { UndoRedoPlugin } from '@toolbox-web/grid/plugins/undo-redo';
```

## Usage

```typescript
import { UndoRedoPlugin } from '@toolbox-web/grid/plugins/undo-redo';

grid.gridConfig = {
  plugins: [
    new UndoRedoPlugin({
      maxHistorySize: 50,
    }),
  ],
};
```

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

Access via `grid.getPlugin(UndoRedoPlugin)`:

```typescript
const history = grid.getPlugin(UndoRedoPlugin);

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
