# RowDragDropPlugin

Drag rows within a grid (reorder) **and** between grids that share a
`dropZone`. Strict superset of the deprecated `RowReorderPlugin`.

## Quick start

```ts
import { RowDragDropPlugin } from '@toolbox-web/grid/plugins/row-drag-drop';
// or, declarative feature key:
import '@toolbox-web/grid/features/row-drag-drop';

grid.gridConfig = {
  features: {
    rowDragDrop: {
      dropZone: 'employees',
      operation: 'move',
    },
  },
};
```

## Highlights

- **Drop zones** — only grids with a matching `dropZone` accept drops from
  one another. Without `dropZone` the plugin behaves as the legacy
  intra-grid reorder.
- **Move / copy** — `operation: 'move'` removes rows from the source on a
  successful cross-grid drop, `'copy'` keeps them.
- **Multi-row** — when the SelectionPlugin is loaded and the dragged row is
  part of a multi-row selection, all selected rows are dragged together.
  This is automatic — there is no `selection` config option.
- **Cross-window** — uses HTML5 `dataTransfer` so dragging into a different
  browser window works via JSON serialisation.
- **`canDrop` / `canDrag`** — synchronous hooks to veto drops or drags.
  `canDrop` is invoked during `dragover` (so it must be sync) and again at
  drop time; `canDrag` is invoked once at `dragstart` for the originating
  row.
- **TSV / plain-text** — every drag also exposes a tab-separated text payload
  on the clipboard MIME so rows can be pasted into spreadsheets.

## Migration from `RowReorderPlugin`

```diff
- import { RowReorderPlugin } from '@toolbox-web/grid/plugins/reorder-rows';
+ import { RowDragDropPlugin } from '@toolbox-web/grid/plugins/row-drag-drop';

- new RowReorderPlugin(cfg);
+ new RowDragDropPlugin(cfg);
```

The legacy `canMove` callback continues to work — it is mapped internally to
`canDrop` with a synthesised intra-grid payload.

See the [docs page](https://toolboxjs.com/grid/plugins/row-drag-drop/) for a
live two-grid demo and the full configuration reference.
