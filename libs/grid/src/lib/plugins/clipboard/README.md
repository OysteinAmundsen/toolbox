# Clipboard Plugin

Copy and paste grid data with configurable delimiters.

## Installation

```typescript
import { ClipboardPlugin } from '@toolbox-web/grid/plugins/clipboard';
```

## Usage

```typescript
import { ClipboardPlugin } from '@toolbox-web/grid/plugins/clipboard';

grid.gridConfig = {
  plugins: [
    new ClipboardPlugin({
      copyHeaders: true,
      delimiter: '\t',
    }),
  ],
};
```

## Configuration

| Option         | Type      | Default | Description                                    |
| -------------- | --------- | ------- | ---------------------------------------------- |
| `copyHeaders`  | `boolean` | `false` | Include headers when copying                   |
| `delimiter`    | `string`  | `'\t'`  | Column delimiter (tab for Excel compatibility) |
| `rowDelimiter` | `string`  | `'\n'`  | Row delimiter                                  |

## Keyboard Shortcuts

| Shortcut | Action                            |
| -------- | --------------------------------- |
| `Ctrl+C` | Copy selected cells/rows          |
| `Ctrl+V` | Paste into selected cells         |
| `Ctrl+X` | Cut selected cells (copy + clear) |

## Events

### `clipboard-copy`

Fired when data is copied.

```typescript
grid.addEventListener('clipboard-copy', (e) => {
  console.log('Copied text:', e.detail.text);
  console.log('Rows:', e.detail.rows);
});
```

### `clipboard-paste`

Fired when data is pasted.

```typescript
grid.addEventListener('clipboard-paste', (e) => {
  console.log('Pasted data:', e.detail.data);
  console.log('Target cell:', e.detail.startRow, e.detail.startCol);
});
```

## API Methods

Access via `grid.getPlugin(ClipboardPlugin)`:

```typescript
const clipboard = grid.getPlugin(ClipboardPlugin);

// Copy selection to clipboard
await clipboard.copy();

// Paste from clipboard
await clipboard.paste();

// Copy specific range
await clipboard.copyRange(startRow, startCol, endRow, endCol);
```
