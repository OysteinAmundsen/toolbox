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

## API Methods

Access via `grid.getPlugin(VisibilityPlugin)`:

```typescript
const visibility = grid.getPlugin(VisibilityPlugin);

// Show/hide columns
visibility.setVisible('email', false);
visibility.setVisible('phone', true);

// Toggle visibility
visibility.toggle('notes');

// Get hidden columns
const hidden = visibility.getHiddenColumns();

// Show the visibility panel UI
visibility.showPanel();
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
