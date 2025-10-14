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

| Option                | Type                                | Default | Description                  |
| --------------------- | ----------------------------------- | ------- | ---------------------------- |
| `showGroupBorders`    | `boolean`                           | `true`  | Show borders between groups  |
| `groupHeaderRenderer` | `(params) => HTMLElement \| string` | -       | Custom group header renderer |

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
