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

| Option             | Type                                        | Default   | Description                            |
| ------------------ | ------------------------------------------- | --------- | -------------------------------------- |
| `groupOn`          | `(row) => any[] \| any \| null \| false`    | -         | Function returning group key(s)        |
| `aggregators`      | `Record<string, AggregatorRef>`             | `{}`      | Aggregation functions per field        |
| `fullWidth`        | `boolean`                                   | `true`    | Group rows span full width             |
| `defaultExpanded`  | `boolean \| number \| string \| string[]`   | `false`   | Start groups expanded                  |
| `showRowCount`     | `boolean`                                   | `true`    | Show row count in group headers        |
| `indentWidth`      | `number`                                    | `20`      | Indent width per depth level in pixels |
| `animation`        | `false \| 'slide' \| 'fade'`                | `'slide'` | Expand/collapse animation style        |
| `accordion`        | `boolean`                                   | `false`   | Only one group open at a time          |
| `groupRowHeight`   | `number`                                    | -         | Height of group header rows (px)       |
| `groupRowRenderer` | `(params) => HTMLElement \| string \| void` | -         | Custom group row renderer              |
| `formatLabel`      | `(value, depth, key) => string`             | -         | Custom format function for group label |

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

### `group-toggle`

Fired when a group is expanded or collapsed.

```typescript
grid.addEventListener('group-toggle', (e) => {
  console.log('Group key:', e.detail.key);
  console.log('Expanded:', e.detail.expanded);
  console.log('Value:', e.detail.value);
  console.log('Depth:', e.detail.depth);
});
```

## API Methods

Access via `grid.getPlugin(GroupingRowsPlugin)`:

```typescript
const grouping = grid.getPlugin(GroupingRowsPlugin);

// Expand a group by key
grouping.expand(key);

// Collapse a group by key
grouping.collapse(key);

// Toggle a group
grouping.toggle(key);

// Check if group is expanded
const isExpanded = grouping.isExpanded(key);

// Expand all groups
grouping.expandAll();

// Collapse all groups
grouping.collapseAll();

// Get expanded group keys
const expanded = grouping.getExpandedGroups();

// Get current group state
const state = grouping.getGroupState();

// Get visible row count
const count = grouping.getRowCount();

// Get flattened row model
const rows = grouping.getFlattenedRows();

// Check if grouping is active
const active = grouping.isGroupingActive();

// Set groupOn dynamically
grouping.setGroupOn((row) => row.category);

// Refresh grouped row model
grouping.refreshGroups();
```
