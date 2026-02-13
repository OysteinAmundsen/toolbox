# Responsive Plugin

Responsive card layout for `<tbw-grid>` that automatically switches from table to card view on narrow viewports.

## Installation

```typescript
import { ResponsivePlugin } from '@toolbox-web/grid/plugins/responsive';
```

## Usage

```typescript
import { ResponsivePlugin } from '@toolbox-web/grid/plugins/responsive';

grid.gridConfig = {
  plugins: [
    new ResponsivePlugin({
      breakpoint: 600,
    }),
  ],
};
```

## Configuration

| Option              | Type                          | Default  | Description                                      |
| ------------------- | ----------------------------- | -------- | ------------------------------------------------ |
| `breakpoint`        | `number`                      | —        | Width threshold (px) to trigger card layout      |
| `breakpoints`       | `BreakpointConfig[]`          | —        | Multiple breakpoints for progressive degradation |
| `cardRenderer`      | `(row, index) => HTMLElement` | —        | Custom card renderer                             |
| `hideHeader`        | `boolean`                     | `true`   | Hide header row in responsive mode               |
| `cardRowHeight`     | `number \| 'auto'`            | `'auto'` | Card row height (with custom renderer)           |
| `debounceMs`        | `number`                      | `100`    | Resize event debounce delay (ms)                 |
| `hiddenColumns`     | `HiddenColumnConfig[]`        | —        | Columns to hide in responsive mode               |
| `animate`           | `boolean`                     | `true`   | Smooth transitions between modes                 |
| `animationDuration` | `number`                      | `200`    | Animation duration (ms)                          |

### `BreakpointConfig`

| Property        | Type                   | Default | Description                              |
| --------------- | ---------------------- | ------- | ---------------------------------------- |
| `maxWidth`      | `number`               | —       | Max width for this breakpoint            |
| `hiddenColumns` | `HiddenColumnConfig[]` | —       | Columns to hide at this breakpoint       |
| `cardLayout`    | `boolean`              | `false` | Switch to full card layout at this point |

## Events

| Event               | Detail                   | Description                             |
| ------------------- | ------------------------ | --------------------------------------- |
| `responsive-change` | `ResponsiveChangeDetail` | Transitions between table and card mode |

## API Methods

Access via `grid.getPlugin(ResponsivePlugin)`:

```typescript
const responsive = grid.getPlugin(ResponsivePlugin);

// Check state
responsive.isResponsive();
responsive.getWidth();
responsive.getActiveBreakpoint();

// Control
responsive.setResponsive(true);
responsive.setBreakpoint(480);
responsive.setCardRenderer((row) => { ... });
```

## Incompatibilities

- **Row Grouping**: Card layout does not support row grouping. The plugin will warn at runtime.

## Documentation

See the [Storybook docs](https://toolboxjs.com/?path=/docs/grid-plugins-responsive--docs) for live examples.
