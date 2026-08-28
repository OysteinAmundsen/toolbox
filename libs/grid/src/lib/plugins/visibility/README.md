# Column Visibility Plugin

Show/hide columns with an interactive UI panel.

## Installation

```typescript
import { VisibilityPlugin } from '@toolbox-web/grid/plugins/visibility';
```

## Usage

```typescript
import { VisibilityPlugin } from '@toolbox-web/grid/plugins/visibility';

grid.gridConfig = {
  plugins: [new VisibilityPlugin()],
};

// Columns can be hidden initially
grid.columns = [
  { field: 'id', hidden: true },
  { field: 'name' },
  { field: 'internalCode', hidden: true, lockVisible: true }, // Cannot be shown
];
```

## Column Options

| Option        | Type      | Description               |
| ------------- | --------- | ------------------------- |
| `hidden`      | `boolean` | Initially hidden          |
| `lockVisible` | `boolean` | Prevent visibility toggle |

## Configuration

The plugin currently has no configurable options. The visibility panel is enabled
just by registering the plugin. The grid always keeps at least one column visible;
mark a column `lockVisible: true` to make it un-hideable individually.

## API Methods

Access via `grid.getPluginByName('visibility')`:

```typescript
const visibility = grid.getPluginByName('visibility');

// Show/hide columns
visibility.setColumnVisible('email', false);
visibility.showColumn('phone');
visibility.hideColumn('notes');

// Toggle visibility
visibility.toggleColumn('notes');

// Check visibility
const isVisible = visibility.isColumnVisible('email');

// Get column lists
const hidden = visibility.getHiddenColumns();
const visible = visibility.getVisibleColumns();
const all = visibility.getAllColumns();

// Show all hidden columns
visibility.showAll();

// Check panel state
visibility.isPanelVisible();
```

## Column Groups in the Panel

When `GroupingColumnsPlugin` is active, the visibility panel groups columns under their group headers.
If groups are **fragmented** (split across non-contiguous positions due to column reordering), each
fragment appears as a separate section in the panel, matching the grid's actual display order.

When `ReorderPlugin` is also active, group headers in the panel are draggable. Dragging a group
header moves only the columns in that fragment, not the entire group.

## Accessibility

Reordering from the panel is drag-and-drop, which
[WCAG 2.2 SC 2.5.7 Dragging Movements](https://www.w3.org/WAI/WCAG22/Understanding/dragging-movements.html)
requires a single-pointer alternative for. **Clicking** a drag handle — instead of dragging it —
opens a menu with **Move up**, **Move down**, **Move to top** and **Move to bottom**. Entries that
would be a no-op, or that would land on a column the grid refuses to move, are disabled.

Both handle kinds are covered:

- A **column row** handle moves that one column.
- A **group header** handle moves the whole fragment as a block, exactly as dragging it would.

The handles stay draggable, so nothing changes for mouse users: a press-and-release without
movement never starts a drag, so the click and the drag never conflict.

## Events

### `column-visibility`

Fired when column visibility changes.

```typescript
grid.addEventListener('column-visibility', (e) => {
  console.log('Field:', e.detail.field);
  console.log('Visible:', e.detail.visible);
});
```
