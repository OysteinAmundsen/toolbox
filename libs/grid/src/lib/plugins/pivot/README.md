# Pivot Plugin

Pivot table transformation with row/column grouping, value aggregation, hierarchical expand/collapse, and an interactive tool panel.

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
      rowGroupFields: ['region', 'product'],
      columnGroupFields: ['quarter'],
      valueFields: [
        { field: 'revenue', aggFunc: 'sum' },
        { field: 'units', aggFunc: 'sum' },
      ],
    }),
  ],
};
```

## Configuration

| Option              | Type                | Default | Description                                    |
| ------------------- | ------------------- | ------- | ---------------------------------------------- |
| `active`            | `boolean`           | `true`  | Whether pivot is active on load (auto-enables) |
| `rowGroupFields`    | `string[]`          | `[]`    | Fields for row grouping (hierarchical)         |
| `columnGroupFields` | `string[]`          | `[]`    | Fields for column grouping                     |
| `valueFields`       | `PivotValueField[]` | `[]`    | Value fields with aggregation functions        |
| `showTotals`        | `boolean`           | `true`  | Show row totals column                         |
| `showGrandTotal`    | `boolean`           | `true`  | Show grand total as sticky pinned footer       |
| `showToolPanel`     | `boolean`           | `true`  | Show pivot tool panel for interactive config   |
| `defaultExpanded`   | `boolean`           | `true`  | Whether groups are expanded by default         |
| `indentWidth`       | `number`            | `20`    | Indent width per depth level in pixels         |

## Value Field Options

```typescript
interface PivotValueField {
  field: string; // Source field name
  aggFunc: 'sum' | 'avg' | 'count' | 'min' | 'max' | 'first' | 'last';
  header?: string; // Display name (optional)
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
new PivotPlugin({
  rowGroupFields: ['region'],
  columnGroupFields: ['quarter'],
  valueFields: [{ field: 'revenue', aggFunc: 'sum' }],
});
```

Produces:
| Region | Q1 Revenue | Q2 Revenue | Total |
|--------|------------|------------|-------|
| ▶ North | 1000 | 1200 | 2200 |
| ▶ South | 800 | - | 800 |
| **Grand Total** | 1800 | 1200 | 3000 |

## API Methods

Access via `grid.getPlugin(PivotPlugin)`:

```typescript
const pivot = grid.getPlugin(PivotPlugin);

// Toggle pivot mode
pivot.enablePivot();
pivot.disablePivot();
pivot.isPivotActive(); // boolean

// Update configuration
pivot.setRowGroupFields(['product']);
pivot.setColumnGroupFields(['region']);
pivot.setValueFields([{ field: 'revenue', aggFunc: 'avg' }]);

// Expand/collapse groups
pivot.toggle('North'); // Toggle specific group
pivot.expand('North'); // Expand specific group
pivot.collapse('North'); // Collapse specific group
pivot.expandAll(); // Expand all groups
pivot.collapseAll(); // Collapse all groups
pivot.isExpanded('North'); // Check if group is expanded

// Tool panel control
pivot.showPanel(); // Open pivot tool panel
pivot.hidePanel(); // Close tool panel
pivot.togglePanel(); // Toggle tool panel
pivot.isPanelVisible(); // Check if panel is open

// Get pivot result data
const result = pivot.getPivotResult();

// Force refresh
pivot.refresh();
```

## Tool Panel

The pivot plugin registers a tool panel for interactive configuration:

- **Available Fields**: Drag fields to row groups, column groups, or values
- **Row Groups**: Fields that create hierarchical row grouping
- **Column Groups**: Fields that create column headers
- **Values**: Aggregated value fields with selectable aggregation function
- **Options**: Toggle totals, grand total, and default expansion state

### Programmatic-Only Usage

To use pivot transformation without exposing the tool panel UI to users:

```typescript
new PivotPlugin({
  showToolPanel: false,
  rowGroupFields: ['region'],
  columnGroupFields: ['quarter'],
  valueFields: [{ field: 'revenue', aggFunc: 'sum' }],
});
```

The pivot API methods remain available for programmatic control.

## Features

- ✅ Hierarchical row grouping with expand/collapse
- ✅ Column grouping with dynamic column generation
- ✅ Multiple aggregation functions (sum, avg, count, min, max, first, last)
- ✅ Row totals column
- ✅ Grand total as sticky pinned footer
- ✅ Interactive tool panel for configuration
- ✅ Auto-enable when valid config is provided (`active: true` by default)
