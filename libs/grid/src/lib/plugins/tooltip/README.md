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

| Option      | Type      | Default | Description                                                                    |
| ----------- | --------- | ------- | ------------------------------------------------------------------------------ |
| `header`    | `boolean` | `true`  | Enable tooltips on overflowing headers                                         |
| `cell`      | `boolean` | `true`  | Enable tooltips on overflowing cells                                           |
| `focus`     | `boolean` | `true`  | Show the tooltip for the focused cell during keyboard navigation               |
| `hideDelay` | `number`  | `120`   | Grace period (ms) before hiding once the pointer leaves; `0` hides immediately |

## Accessibility

Conforms to WCAG 2.2 SC 1.4.13 Content on Hover or Focus: <kbd>Escape</kbd> dismisses the
tooltip, the pointer can rest on it without dismissing it, it never hides on a timer, and
keyboard navigation onto a truncated cell shows its tooltip (`aria-describedby` +
`role="tooltip"`).

## Per-Column Overrides

| Property        | Type                                         | Description                        |
| --------------- | -------------------------------------------- | ---------------------------------- |
| `headerTooltip` | `false \| string \| (ctx) => string \| null` | Override header tooltip per column |
| `cellTooltip`   | `false \| string \| (ctx) => string \| null` | Override cell tooltip per column   |

## Documentation

See the [docs site](https://toolboxjs.com/grid/plugins/tooltip/) for live examples.
