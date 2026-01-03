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
            quantity: 'sum',
            // Object syntax with formatter for currency
            price: {
              aggFunc: 'sum',
              formatter: (value) => `$${value.toFixed(2)}`,
            },
          },
          cells: { id: 'Totals:' },
        },
      ],
    }),
  ],
};
```

## Configuration

| Option              | Type                     | Default    | Description                           |
| ------------------- | ------------------------ | ---------- | ------------------------------------- |
| `position`          | `'top' \| 'bottom'`      | `'bottom'` | Position of the info bar              |
| `showRowCount`      | `boolean`                | `true`     | Show total row count                  |
| `showSelectedCount` | `boolean`                | `true`     | Show selected row count               |
| `showFilteredCount` | `boolean`                | `true`     | Show filtered row count               |
| `aggregationRows`   | `AggregationRowConfig[]` | `[]`       | Aggregation rows with computed values |
| `customPanels`      | `PinnedRowsPanel[]`      | `[]`       | Custom status panels                  |

## Aggregation Rows

Configure computed footer/header rows:

```typescript
{
  id: 'totals',
  position: 'bottom',  // 'top' or 'bottom'
  fullWidth: false,    // Render as single spanning cell
  label: 'Totals',     // Label when fullWidth is true
  aggregators: {
    // Simple string aggregator
    quantity: 'sum',
    // Custom function
    name: (rows, field) => new Set(rows.map(r => r[field])).size,
    // Object syntax with formatter
    price: {
      aggFunc: 'sum',
      formatter: (value) => `$${value.toFixed(2)}`,
    },
  },
  cells: { id: 'Totals:' },  // Static cell values
}
```

### Aggregator Syntax

| Syntax   | Example                                              | Description                |
| -------- | ---------------------------------------------------- | -------------------------- |
| String   | `'sum'`                                              | Built-in aggregator        |
| Function | `(rows, field, column) => value`                     | Custom aggregator function |
| Object   | `{ aggFunc: 'sum', formatter: (v) => v.toFixed(2) }` | Aggregator with formatter  |

### Built-in Aggregators

`sum`, `avg`, `count`, `min`, `max`, `first`, `last`

### Formatter

The `formatter` function formats the computed value for display:

```typescript
formatter: (value, field, column) => string;
```

- `value` - The computed aggregation value
- `field` - The column field name
- `column` - The full column configuration

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
