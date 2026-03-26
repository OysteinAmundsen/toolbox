# @toolbox-web/grid — Tooltip Plugin

Popover tooltips for overflowing header and cell text, with per-column static or dynamic overrides.

## Usage

```typescript
import '@toolbox-web/grid/features/tooltip';

grid.gridConfig = {
  columns: [
    { field: 'name', header: 'Name' },
    { field: 'email', header: 'Email Address' },
  ],
  features: { tooltip: true },
};
```

## Options

| Option   | Type      | Default | Description                            |
| -------- | --------- | ------- | -------------------------------------- |
| `header` | `boolean` | `true`  | Enable tooltips on overflowing headers |
| `cell`   | `boolean` | `true`  | Enable tooltips on overflowing cells   |

## Per-Column Overrides

| Property        | Type                                         | Description                        |
| --------------- | -------------------------------------------- | ---------------------------------- |
| `headerTooltip` | `false \| string \| (ctx) => string \| null` | Override header tooltip per column |
| `cellTooltip`   | `false \| string \| (ctx) => string \| null` | Override cell tooltip per column   |

## Documentation

See the [docs site](https://toolboxjs.com/grid/plugins/tooltip/) for live examples.
