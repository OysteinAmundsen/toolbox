# Row Grouping Plugin

Group rows by field values with aggregations and expand/collapse.

## Installation

```typescript
import { GroupingRowsPlugin } from '@toolbox-web/grid/plugins/grouping-rows';
```

## Usage

```typescript
import { GroupingRowsPlugin } from '@toolbox-web/grid/plugins/grouping-rows';

grid.gridConfig = {
  plugins: [
    new GroupingRowsPlugin({
      groupOn: (row) => row.category,
      aggregators: {
        total: 'sum',
        count: 'count',
      },
    }),
  ],
};
```

## Configuration

| Option              | Type                          | Default | Description                     |
| ------------------- | ----------------------------- | ------- | ------------------------------- |
| `groupOn`           | `(row) => string \| string[]` | -       | Function returning group key(s) |
| `aggregators`       | `Record<string, Aggregator>`  | `{}`    | Aggregation functions per field |
| `fullWidth`         | `boolean`                     | `true`  | Group rows span full width      |
| `expandedByDefault` | `boolean`                     | `true`  | Start groups expanded           |

## Multi-Level Grouping

Return an array from `groupOn` for nested groups:

```typescript
new GroupingRowsPlugin({
  groupOn: (row) => [row.region, row.country, row.city],
});
```

## Aggregators

Built-in aggregators: `'sum'`, `'avg'`, `'count'`, `'min'`, `'max'`, `'first'`, `'last'`

Custom aggregator:

```typescript
new GroupingRowsPlugin({
  groupOn: (row) => row.category,
  aggregators: {
    customTotal: (values) => values.reduce((a, b) => a + b, 0) * 1.1,
  },
});
```

## Events

### `group-expand`

Fired when a group is expanded or collapsed.

```typescript
grid.addEventListener('group-expand', (e) => {
  console.log('Group key:', e.detail.groupKey);
  console.log('Expanded:', e.detail.expanded);
});
```

## API Methods

Access via `grid.getPlugin(GroupingRowsPlugin)`:

```typescript
const grouping = grid.getPlugin(GroupingRowsPlugin);

// Expand a group
grouping.expandGroup(groupKey);

// Collapse a group
grouping.collapseGroup(groupKey);

// Expand all groups
grouping.expandAll();

// Collapse all groups
grouping.collapseAll();
```
