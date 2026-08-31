# Column Reorder Plugin

Drag-and-drop column reordering.

## Installation

```typescript
import { ReorderPlugin } from '@toolbox-web/grid/plugins/reorder-columns';
```

## Usage

```typescript
import { ReorderPlugin } from '@toolbox-web/grid/plugins/reorder-columns';

grid.gridConfig = {
  plugins: [new ReorderPlugin()],
};

// Disable reordering for specific columns
grid.columns = [
  { field: 'id', reorderable: false }, // Cannot be moved
  { field: 'name' },
  { field: 'email' },
];
```

## Column Options

| Option        | Type      | Default | Description                  |
| ------------- | --------- | ------- | ---------------------------- |
| `reorderable` | `boolean` | `true`  | Allow column to be reordered |

## Configuration

| Option              | Type                        | Default  | Description                                                               |
| ------------------- | --------------------------- | -------- | ------------------------------------------------------------------------- |
| `animation`         | `false \| 'flip' \| 'fade'` | `'flip'` | Animation type: `false` (instant), `'flip'` (slide), `'fade'` (crossfade) |
| `animationDuration` | `number`                    | `200`    | Animation duration in ms (applies to FLIP animation)                      |

### Animation Types

```typescript
// No animation - instant column swap
new ReorderPlugin({ animation: false });

// FLIP animation - columns slide smoothly (default)
new ReorderPlugin({ animation: 'flip', animationDuration: 300 });

// Fade animation - uses View Transitions API for cross-fade effect
new ReorderPlugin({ animation: 'fade' });
```

## Limitations

### Sticky (Pinned) Columns

Columns with `pinned: 'left'` or `pinned: 'right'` cannot be reordered. This is by design:

- Sticky columns use `position: sticky` CSS which requires them to stay in their designated position
- Allowing drag-and-drop on sticky columns would conflict with their pinned behavior
- The plugin automatically marks sticky columns as non-draggable

```typescript
// This column will NOT be draggable
{ field: 'id', pinned: 'left' }

// Use PinnedColumnsPlugin alongside ReorderPlugin
grid.gridConfig = {
  plugins: [
    new ReorderPlugin(),
    new PinnedColumnsPlugin(),
  ],
  columns: [
    { field: 'id', pinned: 'left' },  // Pinned, not draggable
    { field: 'name' },                 // Draggable
    { field: 'actions', pinned: 'right' }, // Pinned, not draggable
  ],
};
```

## Events

### `column-move`

Fired when columns are reordered. This event is **cancelable** - call `preventDefault()` to block the move.
Also fires for group header drags (the `field` is the first column in the dragged fragment).

```typescript
grid.addEventListener('column-move', (e) => {
  console.log('Field:', e.detail.field);
  console.log('From index:', e.detail.fromIndex);
  console.log('To index:', e.detail.toIndex);
  console.log('New order:', e.detail.columnOrder);

  // Optionally prevent the move
  if (shouldBlockMove(e.detail)) {
    e.preventDefault();
  }
});
```

## Column Group Drag

When the `GroupingColumnsPlugin` is also active, group header cells in the grid become draggable.
Dragging a group header moves all columns in that fragment as a block. If a group is fragmented
(split across non-contiguous positions), each fragment can be dragged independently.

Implicit groups (auto-generated for ungrouped column spans) are not draggable.

## Accessibility

Conforms to WCAG 2.2 SC 2.5.7 Dragging Movements: every move available by dragging is also
available from the header's context menu (right-click, long-press, or <kbd>Shift</kbd> +
<kbd>F10</kbd>) as **Move left**, **Move right**, **Move to start** and **Move to end**. The
entries merge into the `ContextMenuPlugin` when it is registered, otherwise the plugin opens its
own `role="group"` menu. No header width is reserved; set `a11y.dragAlternatives: 'inline'` to
also render a hover-revealed move button per header (hover-less pointers always get it).

Group header cells carry the same menu, moving the whole fragment past its whole neighbour so a
step can never land inside — and therefore split — a neighbouring group. A neighbour holding a
locked column disables that step rather than being skipped over. Group headers always host their
own menu: the `ContextMenuPlugin` resolves neither a cell nor a header there.

## API Methods

Access via `grid.getPluginByName('reorder')`:

```typescript
const reorder = grid.getPluginByName('reorder');

// Move column programmatically
reorder.moveColumn('email', 0); // Move to first position
```
