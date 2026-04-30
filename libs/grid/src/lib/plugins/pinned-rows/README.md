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

| Option              | Type                     | Default    | Description                                                              |
| ------------------- | ------------------------ | ---------- | ------------------------------------------------------------------------ |
| `slots`             | `PinnedRowSlot[]`        | —          | **Recommended.** Unified ordered slot list (see [Slots API](#slots-api)) |
| `position`          | `'top' \| 'bottom'`      | `'bottom'` | _Legacy._ Position of the info bar                                       |
| `showRowCount`      | `boolean`                | `true`     | _Legacy._ Show total row count                                           |
| `showSelectedCount` | `boolean`                | `true`     | _Legacy._ Show selected row count                                        |
| `showFilteredCount` | `boolean`                | `true`     | _Legacy._ Show filtered row count                                        |
| `fullWidth`         | `boolean`                | `false`    | Default fullWidth mode for all aggregation rows                          |
| `aggregationRows`   | `AggregationRowConfig[]` | `[]`       | _Legacy._ Aggregation rows with computed values                          |
| `customPanels`      | `PinnedRowsPanel[]`      | `[]`       | _Legacy._ Custom status panels                                           |

> Legacy fields are still supported but ignored when `slots` is set. New code should prefer `slots`.

## Slots API

The unified `slots[]` array replaces both `aggregationRows[]` and
`customPanels[]`. Each entry is either:

- An **aggregation slot** — same shape as `AggregationRowConfig` (no `render`).
- A **panel slot** — has a `render` field. `render` is either
  `(ctx) => HTMLElement | null` (left zone) or an array of
  `{ zone?: 'left' | 'center' | 'right', render }` entries.

A `null` return from a panel render skips that contribution; a slot whose
renderers all return `null` is dropped from the DOM. Built-in renderers
`rowCountPanel()`, `selectedCountPanel()`, and `filteredCountPanel()` use
this to self-hide when there is nothing to show.

```typescript
import {
  PinnedRowsPlugin,
  filteredCountPanel,
  rowCountPanel,
  selectedCountPanel,
} from '@toolbox-web/grid/plugins/pinned-rows';

new PinnedRowsPlugin({
  slots: [
    { position: 'top', aggregators: { price: 'sum' }, cells: { id: 'Totals:' } },
    { position: 'bottom', render: rowCountPanel() },
    { position: 'bottom', render: filteredCountPanel() },
    { position: 'bottom', render: selectedCountPanel() },
  ],
});
```

## Aggregation Rows

Configure computed footer/header rows:

```typescript
{
  id: 'totals',
  position: 'bottom',  // 'top' or 'bottom'
  fullWidth: false,    // Render as single spanning cell
  label: 'Totals',     // Label (overlay in per-column mode, inline in fullWidth mode)
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

### Full-Width Mode

When `fullWidth` is `true`, an aggregation row renders as a single spanning cell with the label and aggregated values displayed inline (similar to the row grouping plugin's full-width mode). When `false` (the default), each column gets its own cell aligned to the grid template.

You can set `fullWidth` globally on `PinnedRowsConfig` or per-row on `AggregationRowConfig`. Per-row settings override the global default.

```typescript
// Global fullWidth: all aggregation rows span full width
new PinnedRowsPlugin({
  fullWidth: true,
  aggregationRows: [
    {
      id: 'totals',
      label: 'Totals',
      aggregators: { quantity: 'sum', price: 'sum' },
    },
    {
      id: 'per-column',
      fullWidth: false, // Override: this row renders per-column
      aggregators: { quantity: 'avg', price: 'avg' },
      cells: { product: 'Averages:' },
    },
  ],
});
```

````

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
````

- `value` - The computed aggregation value
- `field` - The column field name
- `column` - The full column configuration

## API Methods

Access via `grid.getPluginByName('pinnedRows')`:

```typescript
const pinned = grid.getPluginByName('pinnedRows');

// Refresh status bar and aggregations
pinned.refresh();

// Get current context
const context = pinned.getContext();

// Add a custom panel dynamically
pinned.addPanel({ id: 'my-panel', render: () => 'Custom content' });

// Remove a custom panel
pinned.removePanel('my-panel');

// Add an aggregation row dynamically
pinned.addAggregationRow({ id: 'avg', aggregators: { price: 'avg' } });

// Remove an aggregation row
pinned.removeAggregationRow('avg');
```

## CSS Variables

| Variable                   | Description                |
| -------------------------- | -------------------------- |
| `--tbw-pinned-rows-bg`     | Info bar background        |
| `--tbw-pinned-rows-border` | Info bar border            |
| `--tbw-pinned-rows-color`  | Info bar text color        |
| `--tbw-aggregation-bg`     | Aggregation row background |
| `--tbw-aggregation-border` | Aggregation row border     |
