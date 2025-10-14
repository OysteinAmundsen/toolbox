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

| Option       | Type     | Default | Description                     |
| ------------ | -------- | ------- | ------------------------------- |
| `debounceMs` | `number` | `150`   | Debounce delay for filter input |

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

## Events

### `filter-change`

Fired when filter model changes.

```typescript
grid.addEventListener('filter-change', (e) => {
  console.log('Filter model:', e.detail.filterModel);
});
```

## API Methods

Access via `grid.getPlugin(FilteringPlugin)`:

```typescript
const filtering = grid.getPlugin(FilteringPlugin);

// Get current filter model
const model = filtering.getFilterModel();

// Set filter model programmatically
filtering.setFilterModel({
  name: { type: 'contains', value: 'John' },
  price: { type: 'greaterThan', value: 100 },
});

// Clear all filters
filtering.clearFilters();

// Clear filter for specific column
filtering.clearFilter('name');
```

## CSS Variables

| Variable                       | Description               |
| ------------------------------ | ------------------------- |
| `--tbw-filtering-panel-bg`     | Filter panel background   |
| `--tbw-filtering-input-border` | Filter input border color |
