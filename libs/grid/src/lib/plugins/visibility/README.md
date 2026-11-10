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

Search is disabled by default. Enable it with the recommended feature config, or
pass the same option to `new VisibilityPlugin({ searchable: true })` when using plugins directly:

```typescript
import '@toolbox-web/grid/features/shell';
import '@toolbox-web/grid/features/visibility';

grid.gridConfig = {
  features: { shell: true, visibility: { searchable: true } },
};
```

Search matches a trimmed, case-insensitive substring of the displayed column name
(`header || field`), including hidden columns. It only filters the panel list, not
grid data or column visibility. Empty queries restore the full list.

Group checkboxes affect only matching columns in their displayed fragment while
searching; **Show All** always shows all columns, including nonmatches. Panel drag
handles and move menus are unavailable until the query is cleared. Group fragments
retain their original boundaries and order.

The query survives panel close/reopen and list updates on the same plugin instance.
It is not saved in column state; a new plugin instance starts empty. The grid always
keeps at least one column visible; `lockVisible` columns remain protected.

See the [Visibility documentation](https://toolboxjs.com/grid/plugins/visibility/) for a live demo.

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

Opt-in search has an accessible name and native text-editing behaviour
([SC 4.1.2 Name, Role, Value](https://www.w3.org/WAI/WCAG22/Understanding/name-role-value.html)).
An empty result is announced through a polite status region without moving focus
([SC 4.1.3 Status Messages](https://www.w3.org/WAI/WCAG22/Understanding/status-messages.html)).
The input stays mounted during list updates. Escape follows shell behaviour:
overlay/dropdown panels close; persistent push sidebars stay open.
Override `columns.searchLabel`, `columns.searchPlaceholder`, and
`columns.noMatchingColumns` in `gridConfig.locale` to translate the search UI.

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
