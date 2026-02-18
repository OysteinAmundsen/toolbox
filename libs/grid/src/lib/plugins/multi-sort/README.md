# Multi-Sort Plugin

Multi-column sorting with customizable sort indicators.

## Installation

```typescript
import { MultiSortPlugin } from '@toolbox-web/grid/plugins/multi-sort';
```

## Usage

```typescript
import { MultiSortPlugin } from '@toolbox-web/grid/plugins/multi-sort';

grid.gridConfig = {
  plugins: [
    new MultiSortPlugin({
      maxSortColumns: 3,
    }),
  ],
};
```

## Configuration

| Option           | Type      | Default | Description                                 |
| ---------------- | --------- | ------- | ------------------------------------------- |
| `maxSortColumns` | `number`  | `3`     | Maximum columns in sort                     |
| `showSortIndex`  | `boolean` | `true`  | Show sort order badges (1, 2, 3) on headers |

## User Interaction

- **Click header**: Sort by column (clears other sorts)
- **Shift+Click header**: Add column to multi-sort stack
- **Ctrl+Click header**: Toggle sort direction
- **Click sorted header**: Toggle asc/desc/none

## Events

### `sort-change`

Fired when sort model changes.

```typescript
grid.addEventListener('sort-change', (e) => {
  console.log('Sort model:', e.detail.sortModel);
  // [{ field: 'name', direction: 'asc' }, { field: 'date', direction: 'desc' }]
});
```

## API Methods

Access via `grid.getPlugin(MultiSortPlugin)`:

```typescript
const multiSort = grid.getPlugin(MultiSortPlugin);

// Get current sort model
const model = multiSort.getSortModel();

// Set sort model programmatically
multiSort.setSortModel([
  { field: 'category', direction: 'asc' },
  { field: 'name', direction: 'asc' },
]);

// Clear all sorting
multiSort.clearSort();

// Get sort index for a field (1-based, or undefined)
const index = multiSort.getSortIndex('name');

// Get sort direction for a field ('asc' | 'desc' | undefined)
const dir = multiSort.getSortDirection('name');
```
