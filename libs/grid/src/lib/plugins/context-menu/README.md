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

| Option     | Type                            | Description                         |
| ---------- | ------------------------------- | ----------------------------------- |
| `items`    | `ContextMenuItem[]`             | Menu items to display               |
| `getItems` | `(params) => ContextMenuItem[]` | Dynamic menu items based on context |

## Menu Item Options

| Option      | Type                | Description                 |
| ----------- | ------------------- | --------------------------- | ------------ |
| `id`        | `string`            | Unique identifier           |
| `name`      | `string`            | Display label               |
| `icon`      | `string`            | Icon (emoji or HTML)        |
| `shortcut`  | `string`            | Keyboard shortcut hint      |
| `disabled`  | `boolean \\         | (params) => boolean`        | Disable item |
| `hidden`    | `boolean \\         | (params) => boolean`        | Hide item    |
| `separator` | `boolean`           | Render as separator line    |
| `subMenu`   | `ContextMenuItem[]` | Nested submenu              |
| `action`    | `(params) => void`  | Click handler               |
| `cssClass`  | `string`            | Optional CSS class for item |

## Context Parameters

The `params` object passed to callbacks:

```typescript
interface ContextMenuParams {
  row: any; // Row data (null for headers)
  rowIndex: number; // Row index (-1 for headers)
  column: ColumnConfig;
  columnIndex: number;
  field: string;
  value: any;
  isHeader: boolean;
  event: MouseEvent;
}
```

## Dynamic Menu Example

```typescript
new ContextMenuPlugin({
  getItems: (params) => {
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
