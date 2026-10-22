# Context Menu Plugin

Configurable right-click context menus for cells and headers.

## Installation

```typescript
import { ContextMenuPlugin } from '@toolbox-web/grid/plugins/context-menu';
```

## Usage

```typescript
import { ContextMenuPlugin } from '@toolbox-web/grid/plugins/context-menu';

grid.gridConfig = {
  plugins: [
    new ContextMenuPlugin({
      items: [
        { id: 'copy', name: 'Copy', icon: '📋', action: (params) => console.log('Copy', params) },
        { id: 'sep1', name: '', separator: true },
        { id: 'delete', name: 'Delete Row', action: (params) => deleteRow(params.rowIndex) },
      ],
    }),
  ],
};
```

## Configuration

| Option  | Type                                                                      | Description                                   |
| ------- | ------------------------------------------------------------------------- | --------------------------------------------- |
| `items` | `ContextMenuItem[] \| ((params: ContextMenuParams) => ContextMenuItem[])` | Menu items — static array or dynamic function |

## Menu Item Options

| Option      | Type                             | Description              |
| ----------- | -------------------------------- | ------------------------ |
| `id`        | `string`                         | Unique identifier        |
| `name`      | `string`                         | Display label            |
| `icon`      | `string`                         | Icon (emoji or HTML)     |
| `shortcut`  | `string \| string[]`             | Keyboard shortcut hint   |
| `disabled`  | `boolean \| (params) => boolean` | Disable item             |
| `hidden`    | `boolean \| (params) => boolean` | Hide item                |
| `separator` | `boolean`                        | Render as separator line |
| `subMenu`   | `ContextMenuItem[]`              | Nested submenu           |
| `action`    | `(params) => void`               | Click handler            |
| `cssClass`  | `string`                         | Optional CSS class       |

## Context Parameters

The `params` object passed to callbacks:

```typescript
interface ContextMenuParams {
  row: unknown; // Row data (null for headers)
  rowIndex: number; // Row index (-1 for headers)
  column: unknown; // Column config
  columnIndex: number;
  field: string;
  value: unknown;
  isHeader: boolean;
  event: MouseEvent;
  selectedRows: number[]; // Currently selected row indices (requires SelectionPlugin)
}
```

### Selection Sync Behavior

When the `SelectionPlugin` is active, opening the menu syncs the selection to the
target cell and reports it in `params.selectedRows`. Every invocation syncs the
same way — right-click, touch long-press, `Shift+F10`, the ContextMenu key, or a
synthesised `contextmenu`:

- **Row mode, on a selected row** → preserves existing multi-selection
- **Row mode, on an unselected row** → selects only that row
- **Range mode, inside a range** → range preserved; `selectedRows` lists every row it covers
- **Range mode, outside every range** → range collapses to that cell; `selectedRows` is `[rowIndex]`
- **Cell mode** → the cell selection moves to that cell; `selectedRows` is `[rowIndex]`
- **Mixed modes (`[..., 'column']`), inside a selected column** → column selection preserved; `selectedRows` is `[rowIndex]`
- **No SelectionPlugin loaded** → `selectedRows` contains just the target row index
- **Header** → `selectedRows` is `[]`

## Accessibility

- [SC 2.1.1 Keyboard](https://www.w3.org/WAI/WCAG22/Understanding/keyboard.html) — `Shift+F10` and the
  dedicated ContextMenu key open the menu at the focused cell with focus on the first item, and sync the
  selection exactly as a right-click on that cell does (see [Selection Sync Behavior](#selection-sync-behavior)).
  Arrow keys navigate, `Enter`/`Space` activate, `Escape` closes. Automatic — no configuration.
- [WAI-ARIA Menu pattern](https://www.w3.org/WAI/ARIA/apg/patterns/menubar/) — the popup is `role="menu"`; items are
  `role="menuitem"` (`tabindex="-1"`), dividers `role="separator"`, disabled items `aria-disabled="true"` (skipped by
  the arrow keys). Clicking outside or scrolling also closes the menu.

## Dynamic Menu Example

```typescript
new ContextMenuPlugin({
  items: (params) => {
    const items = [{ id: 'copy', name: 'Copy Cell', action: () => copyCell(params) }];

    if (!params.isHeader) {
      items.push({ id: 'edit', name: 'Edit', action: () => editCell(params) });
    }

    return items;
  },
});
```

## CSS Variables

| Variable                    | Description      |
| --------------------------- | ---------------- |
| `--tbw-context-menu-bg`     | Menu background  |
| `--tbw-context-menu-hover`  | Hover background |
| `--tbw-context-menu-border` | Menu border      |
