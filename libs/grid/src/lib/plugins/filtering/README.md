# Filtering Plugin

Column filtering with text, number, date, set, and boolean filter types.

## Installation

```typescript
import { FilteringPlugin } from '@toolbox-web/grid/plugins/filtering';
```

## Usage

```typescript
import { FilteringPlugin } from '@toolbox-web/grid/plugins/filtering';

grid.gridConfig = {
  plugins: [
    new FilteringPlugin({
      debounceMs: 150, // Debounce filter input
    }),
  ],
};

// Enable filtering on specific columns
grid.columns = [
  { field: 'name', filterable: true },
  { field: 'status', filterable: true, filterType: 'set' },
  { field: 'price', filterable: true, filterType: 'number' },
];
```

## Configuration

| Option                | Type                  | Default | Description                                  |
| --------------------- | --------------------- | ------- | -------------------------------------------- |
| `debounceMs`          | `number`              | `300`   | Debounce delay for filter input              |
| `caseSensitive`       | `boolean`             | `false` | Whether text filtering is case sensitive     |
| `trimInput`           | `boolean`             | `true`  | Whether to trim whitespace from filter input |
| `useWorker`           | `boolean`             | `true`  | Use Web Worker for filtering large datasets  |
| `filterPanelRenderer` | `FilterPanelRenderer` | -       | Custom filter panel renderer                 |

## Column Options

| Option       | Type         | Description                                                       |
| ------------ | ------------ | ----------------------------------------------------------------- |
| `filterable` | `boolean`    | Enable filtering on this column                                   |
| `filterType` | `FilterType` | Filter type: `'text'`, `'number'`, `'date'`, `'set'`, `'boolean'` |

## Filter Types

### Text Filter

Case-insensitive text matching with operators: contains, equals, starts with, ends with.

### Number Filter

Numeric comparison with operators: equals, not equals, greater than, less than, between.

### Date Filter

Date comparison with operators: equals, before, after, between.

### Set Filter

Checkbox list of unique values in the column.

### Boolean Filter

True/false toggle filter.

## Column Formatters in Filter Panel

When a column defines a `format` function, the built-in **set filter** panel automatically uses it to display formatted labels instead of raw values. This applies to:

- **Checkbox labels** — show the formatted value (e.g., `$9.99` instead of `9.99`)
- **Search** — matches against the formatted text, not the raw value
- **Sort order** — filter values are sorted alphabetically by their formatted display name

```typescript
grid.columns = [
  {
    field: 'price',
    filterable: true,
    format: (value) => `$${Number(value).toFixed(2)}`,
    // Filter checkboxes: ☑ $9.99  ☑ $19.50  ☑ $100.00
  },
  {
    field: 'departmentId',
    filterable: true,
    format: (value) => departmentMap.get(value as string) ?? String(value),
    // Filter checkboxes: ☑ Engineering  ☑ Sales  ☑ Marketing
  },
];
```

> **Note:** The `format` function's `row` parameter is `undefined` in the filter panel context
> (there is no row when formatting standalone values). Avoid accessing `row` properties
> in format functions that should also work in the filter panel.

For fully custom filter UIs, use the `filterPanelRenderer` config option or a type-level
`filterPanelRenderer` in `typeDefaults`.

## Events

### `filter-change`

Fired when filter model changes.

```typescript
grid.addEventListener('filter-change', (e) => {
  console.log('Filters:', e.detail.filters);
  console.log('Filtered row count:', e.detail.filteredRowCount);
});
```

## API Methods

Access via `grid.getPlugin(FilteringPlugin)`:

```typescript
const filtering = grid.getPlugin(FilteringPlugin);

// Get all active filters
const filters = filtering.getFilters();
// or: const filters = filtering.getFilterModel(); // alias

// Set filter on a specific field
filtering.setFilter('name', { type: 'text', operator: 'contains', value: 'John' });
filtering.setFilter('price', { type: 'number', operator: 'greaterThan', value: 100 });

// Set filter model (replaces all existing filters)
filtering.setFilterModel([
  { field: 'name', type: 'text', operator: 'contains', value: 'John' },
  { field: 'price', type: 'number', operator: 'greaterThan', value: 100 },
]);

// Clear all filters
filtering.clearAllFilters();

// Clear filter for specific column
filtering.clearFieldFilter('name');

// Check if a field has an active filter
filtering.isFieldFiltered('name');
```

## CSS Variables

| Variable                    | Description             |
| --------------------------- | ----------------------- |
| `--tbw-filter-panel-bg`     | Panel background        |
| `--tbw-filter-panel-fg`     | Panel text color        |
| `--tbw-filter-panel-border` | Panel border            |
| `--tbw-filter-active-color` | Active filter indicator |
| `--tbw-filter-input-bg`     | Input background        |
| `--tbw-filter-input-focus`  | Input focus border      |
