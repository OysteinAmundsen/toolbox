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
      maxHistory: 50,
    }),
  ],
};
```

## Configuration

| Option       | Type     | Default | Description                |
| ------------ | -------- | ------- | -------------------------- |
| `maxHistory` | `number` | `100`   | Maximum actions in history |

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
history.clear();

// Get history length
const undoCount = history.getUndoCount();
const redoCount = history.getRedoCount();
```

## Events

### `history-change`

Fired when history state changes.

```typescript
grid.addEventListener('history-change', (e) => {
  console.log('Can undo:', e.detail.canUndo);
  console.log('Can redo:', e.detail.canRedo);
});
```
