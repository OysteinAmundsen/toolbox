# Print Plugin

Print-optimized layout for `<tbw-grid>` with configurable orientation, row limits, and isolated printing.

## Installation

```typescript
import { PrintPlugin } from '@toolbox-web/grid/plugins/print';
```

## Usage

```typescript
import { PrintPlugin } from '@toolbox-web/grid/plugins/print';

grid.gridConfig = {
  plugins: [
    new PrintPlugin({
      button: true,
      orientation: 'landscape',
    }),
  ],
};
```

## Configuration

| Option             | Type                        | Default       | Description                                           |
| ------------------ | --------------------------- | ------------- | ----------------------------------------------------- |
| `button`           | `boolean`                   | `false`       | Show print button in toolbar                          |
| `orientation`      | `'portrait' \| 'landscape'` | `'landscape'` | Page orientation                                      |
| `warnThreshold`    | `number`                    | `500`         | Confirm dialog when rows exceed this (0 = no warning) |
| `maxRows`          | `number`                    | `0`           | Hard limit on printed rows (0 = unlimited)            |
| `includeTitle`     | `boolean`                   | `true`        | Include grid title in print output                    |
| `includeTimestamp` | `boolean`                   | `true`        | Include timestamp in footer                           |
| `title`            | `string`                    | `''`          | Custom print title (overrides shell title)            |
| `isolate`          | `boolean`                   | `false`       | Hide all other page content during printing           |

## Column Configuration

| Property      | Type      | Description                    |
| ------------- | --------- | ------------------------------ |
| `printHidden` | `boolean` | Hide this column when printing |

## Events

| Event            | Detail                | Description             |
| ---------------- | --------------------- | ----------------------- |
| `print-start`    | `PrintStartDetail`    | Fired when print begins |
| `print-complete` | `PrintCompleteDetail` | Fired when print ends   |

## API Methods

Access via `grid.getPlugin(PrintPlugin)`:

```typescript
const printer = grid.getPlugin(PrintPlugin);

// Print with default config
await printer.print();

// Print with overrides
await printer.print({
  orientation: 'portrait',
  title: 'Monthly Report',
  maxRows: 1000,
  isolate: true,
});

// Check state
printer.isPrinting();
```

## Documentation

See the [Storybook docs](https://toolboxjs.com/?path=/docs/grid-plugins-print--docs) for live examples.
