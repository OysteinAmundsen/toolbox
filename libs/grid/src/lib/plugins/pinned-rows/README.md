# Pinned Rows Plugin

Status bar with row counts and aggregation rows for computed values.

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
      position: 'bottom',
      showRowCount: true,
      aggregationRows: [
        {
          id: 'totals',
          position: 'bottom',
          aggregators: {
            amount: 'sum',
            count: 'count',
          },
        },
      ],
    }),
  ],
};
```

## Configuration

| Option              | Type                     | Default   | Description                           |
| ------------------- | ------------------------ | --------- | ------------------------------------- | ------------------------ |
| `position`          | `'top' \\                | 'bottom'` | `'bottom'`                            | Position of the info bar |
| `showRowCount`      | `boolean`                | `true`    | Show total row count                  |
| `showSelectedCount` | `boolean`                | `true`    | Show selected row count               |
| `showFilteredCount` | `boolean`                | `true`    | Show filtered row count               |
| `aggregationRows`   | `AggregationRowConfig[]` | -         | Aggregation rows with computed values |
| `customPanels`      | `PinnedRowsPanel[]`      | -         | Custom status panels                  |

## Aggregation Rows

Configure computed footer/header rows:

```typescript
{
  id: 'totals',
  position: 'bottom',  // 'top' or 'bottom'
  fullWidth: false,    // Render as single spanning cell
  label: 'Totals',     // Label when fullWidth is true
  aggregators: {
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

// Refresh status bar and aggregations
pinned.refresh();

// Get current context
const context = pinned.getContext();
```

## CSS Variables

| Variable                   | Description                |
| -------------------------- | -------------------------- |
| `--tbw-pinned-rows-bg`     | Info bar background        |
| `--tbw-pinned-rows-border` | Info bar border            |
| `--tbw-pinned-rows-color`  | Info bar text color        |
| `--tbw-aggregation-bg`     | Aggregation row background |
| `--tbw-aggregation-border` | Aggregation row border     |
