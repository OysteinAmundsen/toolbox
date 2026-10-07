# Hierarchy Plugin

Builds one hierarchical row model from every plugin that contributes row structure, and announces each row's position with the WAI-ARIA treegrid pattern.

`TreePlugin` (child rows) and `GroupingRowsPlugin` (groups of sibling rows) depend on it. The grid attaches it automatically, so you never add it yourself. It has no configuration.

## Installation

```typescript
import { HierarchyPlugin } from '@toolbox-web/grid/plugins/hierarchy';
```

Only needed to read row positions or to write your own structure plugin.

## Combining Tree and Row Grouping

```typescript
grid.gridConfig = {
  plugins: [
    new TreePlugin({ childrenField: 'children' }),
    new GroupingRowsPlugin({ groupOn: (row, { depth }) => (depth > 0 ? row.kind : null) }),
  ],
};
```

On every rebuild the plugin walks one sibling list at a time (root rows, then the children of each expanded node). Structure contributors (`TreePlugin`) run first, transform contributors (`GroupingRowsPlugin`) next, and the result is flattened in display order. Contributors keep their own expand/collapse state, events and API.

## API

```typescript
const meta = grid.getPluginByName('hierarchy')?.getRowMeta(grid.rows[0]);
// { level: 1, setSize: 2, posInSet: 1 }
```

## Accessibility

[WCAG 2.2 SC 1.3.1 Info and Relationships](https://www.w3.org/WAI/WCAG22/Understanding/info-and-relationships.html): while a contributor is attached the rows container uses `role="treegrid"`, and every rendered row (including group headers and rows scrolled into view) carries `aria-level`, `aria-setsize` and `aria-posinset`.

## Writing a Contributor

Implement `HierarchyContributor` (`hierarchyStage`, `beginHierarchy`, `processSiblings`, `endHierarchy`), forward your `processRows` hook to `grid.getPluginByName('hierarchy').process(rows, this)`, and declare the dependency with a provider:

```typescript
static override readonly dependencies = [
  { name: 'hierarchy', required: true, provide: () => new HierarchyPlugin() },
];
```

## CDN (UMD)

`tree.umd.js` and `grouping-rows.umd.js` each bundle a copy of this plugin. **Deprecated:** the next major release stops doing so — load `hierarchy.umd.js` first from then on.

## Documentation

See the [Hierarchy plugin docs](https://toolboxjs.com/grid/plugins/hierarchy/).
