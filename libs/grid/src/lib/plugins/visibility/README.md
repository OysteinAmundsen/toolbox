# Column Visibility Plugin

Show/hide columns with an interactive UI panel.

## Installation

```typescript
import { VisibilityPlugin } from '@toolbox-web/grid/plugins/visibility';
```

## Usage

```typescript
import { VisibilityPlugin } from '@toolbox-web/grid/plugins/visibility';

grid.gridConfig = {
  plugins: [new VisibilityPlugin()],
};

// Columns can be hidden initially
grid.columns = [
  { field: 'id', hidden: true },
  { field: 'name' },
  { field: 'internalCode', hidden: true, lockVisible: true }, // Cannot be shown
];
```

## Column Options

| Option        | Type      | Description               |
| ------------- | --------- | ------------------------- |
| `hidden`      | `boolean` | Initially hidden          |
| `lockVisible` | `boolean` | Prevent visibility toggle |

## Configuration

| Option         | Type      | Default | Description              |
| -------------- | --------- | ------- | ------------------------ |
| `allowHideAll` | `boolean` | `false` | Allow hiding all columns |

## API Methods

Access via `grid.getPlugin(VisibilityPlugin)`:

```typescript
const visibility = grid.getPlugin(VisibilityPlugin);

// Show/hide columns
visibility.setColumnVisible('email', false);
visibility.showColumn('phone');
visibility.hideColumn('notes');

// Toggle visibility
visibility.toggleColumn('notes');

// Check visibility
const isVisible = visibility.isColumnVisible('email');

// Get column lists
const hidden = visibility.getHiddenColumns();
const visible = visibility.getVisibleColumns();
const all = visibility.getAllColumns();

// Show all hidden columns
visibility.showAll();

// Check panel state
visibility.isPanelVisible();
```

## Events

### `column-visibility`

Fired when column visibility changes.

```typescript
grid.addEventListener('column-visibility', (e) => {
  console.log('Field:', e.detail.field);
  console.log('Visible:', e.detail.visible);
});
```
