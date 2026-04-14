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

| Option             | Type                                                    | Default   | Description                              |
| ------------------ | ------------------------------------------------------- | --------- | ---------------------------------------- |
| `groupOn`          | `(row) => any[] \| any \| null \| false`                | -         | Function returning group key(s)          |
| `groups`           | `GroupDefinition[] \| () => Promise<GroupDefinition[]>` | -         | Pre-defined groups (static or async)     |
| `rows`             | `(group: GroupDefinition) => Promise<unknown[]>`        | -         | Callback to lazily load rows for a group |
| `aggregators`      | `Record<string, AggregatorRef>`                         | `{}`      | Aggregation functions per field          |
| `fullWidth`        | `boolean`                                               | `true`    | Group rows span full width               |
| `defaultExpanded`  | `boolean \| number \| string \| string[]`               | `false`   | Start groups expanded                    |
| `showRowCount`     | `boolean`                                               | `true`    | Show row count in group headers          |
| `indentWidth`      | `number`                                                | `20`      | Indent width per depth level in pixels   |
| `animation`        | `false \| 'slide' \| 'fade'`                            | `'slide'` | Expand/collapse animation style          |
| `accordion`        | `boolean`                                               | `false`   | Only one group open at a time            |
| `groupRowHeight`   | `number`                                                | -         | Height of group header rows (px)         |
| `groupRowRenderer` | `(params) => HTMLElement \| string \| void`             | -         | Custom group row renderer                |
| `formatLabel`      | `(value, depth, key) => string`                         | -         | Custom format function for group label   |

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

### `group-expand` / `group-collapse`

Fired in pre-defined groups mode when a group is expanded or collapsed. Use these to lazily load data from a server.

```typescript
grid.addEventListener('group-expand', async (e) => {
  const { groupKey, groupPath } = e.detail;
  grouping.setGroupLoading(groupKey, true);
  const rows = await fetchGroupRows(groupKey);
  grouping.setGroupRows(groupKey, rows);
  grouping.setGroupLoading(groupKey, false);
});
```

## API Methods

Access via `grid.getPluginByName('groupingRows')`:

```typescript
const grouping = grid.getPluginByName('groupingRows');

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

## Server-Side Grouping (Pre-Defined Groups)

For server-side scenarios, use `groups` and `rows` callbacks to lazily load data:

```typescript
// Declarative API (recommended) — plugin handles loading/caching automatically
grid.gridConfig = {
  features: {
    groupingRows: {
      groups: () => fetch('/api/groups').then((r) => r.json()),
      rows: (group) => fetch(`/api/groups/${group.key}/rows`).then((r) => r.json()),
    },
  },
};

// Static groups with async rows
grid.gridConfig = {
  features: {
    groupingRows: {
      groups: [
        { key: 'engineering', value: 'Engineering', rowCount: 150 },
        { key: 'sales', value: 'Sales', rowCount: 89 },
      ],
      rows: (group) => fetch(`/api/groups/${group.key}/rows`).then((r) => r.json()),
    },
  },
};
```

### Imperative API

For full control over loading states and partial updates, use the plugin instance directly:

```typescript
import '@toolbox-web/grid/features/grouping-rows';
import { queryGrid } from '@toolbox-web/grid';

const grid = await queryGrid('tbw-grid', true);
grid.gridConfig = {
  features: { groupingRows: true },
};

const grouping = grid.getPluginByName('groupingRows');

// Lazy-load rows when a group is expanded
grid.on('group-expand', async ({ groupKey }) => {
  grouping.setGroupLoading(groupKey, true);
  const rows = await fetchGroupRows(groupKey);
  grouping.setGroupRows(groupKey, rows); // also clears loading state
});

// Load groups asynchronously
const groups = await fetch('/api/groups').then((r) => r.json());
grouping.setGroups(groups);
```

| Method                          | Description                               |
| ------------------------------- | ----------------------------------------- |
| `setGroups(groups)`             | Replace groups with an external structure |
| `getGroups()`                   | Get the current group definitions         |
| `setGroupRows(key, rows)`       | Populate rows for an expanded group       |
| `setGroupLoading(key, loading)` | Toggle loading indicator for a group      |
| `clearGroupRows(key?)`          | Clear cached rows (specific group or all) |

## Documentation

See the [docs site](https://toolboxjs.com/grid/plugins/grouping-rows/) for live examples.
