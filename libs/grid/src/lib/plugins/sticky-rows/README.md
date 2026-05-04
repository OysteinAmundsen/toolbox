# `@toolbox-web/grid/plugins/sticky-rows`

Pin selected data rows below the grid header as the user scrolls past them.

## Recommended: feature shorthand

```ts
import '@toolbox-web/grid/features/sticky-rows';

grid.gridConfig = {
  features: {
    stickyRows: {
      isSticky: 'isSection', // field name OR (row, index) => boolean
      mode: 'stack', // 'push' (default) or 'stack'
      maxStacked: 3, // stack-mode cap (default Infinity)
    },
  },
};
```

## Direct plugin usage (advanced)

Use this only when you're composing plugins manually (e.g. building your own
plugin that needs to coordinate registration order).

```ts
import { StickyRowsPlugin } from '@toolbox-web/grid/plugins/sticky-rows';

grid.gridConfig = {
  plugins: [new StickyRowsPlugin({ isSticky: 'isSection' })],
};
```

## Modes

- **`'push'`** (default) — only one stuck row at a time. The next sticky row
  pushes the previous one up and out, iOS section-header style.
- **`'stack'`** — stuck rows accumulate below the header up to `maxStacked`.

## API

```ts
interface StickyRowsConfig {
  isSticky: string | ((row, index) => unknown);
  mode?: 'push' | 'stack';
  maxStacked?: number;
  className?: string;
}
```

Stuck rows are rendered as **clones** of the real rows. The originals stay in
the row pool and remain interactive — clones are decorative and marked
`aria-hidden="true"` so screen readers traverse the underlying row in flow.
