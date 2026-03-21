# Column Header Grouping Plugin

Multi-level column header groups.

## Installation

```typescript
import { GroupingColumnsPlugin } from '@toolbox-web/grid/plugins/grouping-columns';
```

## Usage

```typescript
import { GroupingColumnsPlugin } from '@toolbox-web/grid/plugins/grouping-columns';

grid.gridConfig = {
  plugins: [new GroupingColumnsPlugin()],
};

// Group columns via column config
grid.columns = [
  { field: 'firstName', header: 'First', group: 'Name' },
  { field: 'lastName', header: 'Last', group: 'Name' },
  { field: 'street', header: 'Street', group: 'Address' },
  { field: 'city', header: 'City', group: 'Address' },
  { field: 'zip', header: 'ZIP', group: 'Address' },
];
```

## Column Options

| Option  | Type     | Description             |
| ------- | -------- | ----------------------- |
| `group` | `string` | Group ID for the column |

## Configuration

| Option                | Type                                | Default | Description                               |
| --------------------- | ----------------------------------- | ------- | ----------------------------------------- |
| `showGroupBorders`    | `boolean`                           | `true`  | Show borders between groups               |
| `lockGroupOrder`      | `boolean`                           | `false` | Prevent reordering columns outside groups |
| `groupHeaderRenderer` | `(params) => HTMLElement \| string` | -       | Custom group header renderer              |

## Fragmented Groups

When columns are reordered across group boundaries (with `lockGroupOrder: false`, the default), groups **fragment** instead of blocking the move. Each contiguous run of columns belonging to the same group gets its own header cell. If the fragments are later brought back together, the group header merges automatically.

Fragmented groups are reflected in both the grid header and the visibility panel (if active). Each
fragment's group header is independently draggable when `ReorderPlugin` is present.

## Custom Group Header

```typescript
new GroupingColumnsPlugin({
  groupHeaderRenderer: (params) => {
    return `<strong>${params.label}</strong> (${params.columns.length} cols)`;
  },
});
```

## Group Header Renderer Parameters

```typescript
interface GroupHeaderRenderParams {
  id: string; // Group ID
  label: string; // Group label
  columns: ColumnConfig[]; // Columns in group
  firstIndex: number; // First column index
  isImplicit: boolean; // Auto-generated for ungrouped columns
}
```

## API Methods

Access via `grid.getPluginByName('groupingColumns')`:

```typescript
const grouping = grid.getPluginByName('groupingColumns');

// Check if column groups are active
grouping.isGroupingActive();

// Get computed column groups
const groups = grouping.getGroups();

// Get columns in a specific group
const cols = grouping.getGroupColumns('groupId');

// Refresh column groups
grouping.refresh();
```
