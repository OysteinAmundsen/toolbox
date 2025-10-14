# Pinned Rows Plugin

Pin rows to top or bottom of grid (footer aggregations).

## Installation

```typescript
import { PinnedRowsPlugin } from '@toolbox-web/grid/plugins/pinned-rows';
```

## Usage

```typescript
import { PinnedRowsPlugin } from '@toolbox-web/grid/plugins/pinned-rows';

grid.gridConfig = {
  plugins: [
    new PinnedRowsPlugin({
      pinnedTopRows: [{ id: 'header', name: 'Header Row', isTotal: false }],
      pinnedBottomRows: [{ id: 'total', name: 'Total', amount: 0, __aggregators: { amount: 'sum' } }],
    }),
  ],
};
```

## Configuration

| Option             | Type    | Description           |
| ------------------ | ------- | --------------------- |
| `pinnedTopRows`    | `any[]` | Rows pinned at top    |
| `pinnedBottomRows` | `any[]` | Rows pinned at bottom |

## Aggregation in Pinned Rows

Add `__aggregators` to a pinned row for automatic aggregation:

```typescript
{
  id: 'totals',
  name: 'Totals',
  amount: 0,       // Will be replaced with sum
  count: 0,        // Will be replaced with count
  __aggregators: {
    amount: 'sum',
    count: 'count',
  },
}
```

Built-in aggregators: `'sum'`, `'avg'`, `'count'`, `'min'`, `'max'`

## API Methods

Access via `grid.getPlugin(PinnedRowsPlugin)`:

```typescript
const pinned = grid.getPlugin(PinnedRowsPlugin);

// Update pinned rows
pinned.setPinnedTopRows([...]);
pinned.setPinnedBottomRows([...]);

// Refresh aggregations
pinned.refreshAggregations();
```

## CSS Variables

| Variable                   | Description           |
| -------------------------- | --------------------- |
| `--tbw-pinned-rows-bg`     | Pinned row background |
| `--tbw-pinned-rows-border` | Pinned row border     |
