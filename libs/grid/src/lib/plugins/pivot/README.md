# Pivot Plugin

Pivot table transformation with row/column groups and value aggregation.

## Installation

```typescript
import { PivotPlugin } from '@toolbox-web/grid/plugins/pivot';
```

## Usage

```typescript
import { PivotPlugin } from '@toolbox-web/grid/plugins/pivot';

grid.gridConfig = {
  plugins: [
    new PivotPlugin({
      rowFields: ['region', 'product'],
      columnFields: ['quarter'],
      valueFields: [
        { field: 'revenue', aggregator: 'sum' },
        { field: 'units', aggregator: 'sum' },
      ],
    }),
  ],
};
```

## Configuration

| Option         | Type                | Description                   |
| -------------- | ------------------- | ----------------------------- |
| `rowFields`    | `string[]`          | Fields for row grouping       |
| `columnFields` | `string[]`          | Fields for column grouping    |
| `valueFields`  | `PivotValueField[]` | Value fields with aggregators |

## Value Field Options

```typescript
interface PivotValueField {
  field: string; // Source field name
  aggregator: 'sum' | 'avg' | 'count' | 'min' | 'max' | ((values: any[]) => any);
  header?: string; // Display name
}
```

## Example

Given data:

```javascript
[
  { region: 'North', product: 'Widget', quarter: 'Q1', revenue: 1000 },
  { region: 'North', product: 'Widget', quarter: 'Q2', revenue: 1200 },
  { region: 'South', product: 'Widget', quarter: 'Q1', revenue: 800 },
];
```

Pivot configuration:

```typescript
{
  rowFields: ['region'],
  columnFields: ['quarter'],
  valueFields: [{ field: 'revenue', aggregator: 'sum' }],
}
```

Produces:
| Region | Q1 Revenue | Q2 Revenue |
|--------|------------|------------|
| North | 1000 | 1200 |
| South | 800 | - |

## API Methods

Access via `grid.getPlugin(PivotPlugin)`:

```typescript
const pivot = grid.getPlugin(PivotPlugin);

// Update pivot configuration
pivot.setConfig({
  rowFields: ['product'],
  columnFields: ['region'],
  valueFields: [{ field: 'revenue', aggregator: 'avg' }],
});

// Get pivot result
const result = pivot.getResult();
```
