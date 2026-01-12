# Changelog

## [0.2.0](https://github.com/OysteinAmundsen/toolbox/compare/grid-angular-0.1.0...grid-angular-0.2.0) (2025-01-XX)

### Features

- **structural-directives:** renamed `TbwCellView` to `TbwRenderer` and `TbwCellEditor` to `TbwEditor` for cleaner template syntax
- **auto-wiring:** editor components with `commit` and `cancel` outputs are now automatically connected
- **grid-events:** added `(cellCommit)` and `(rowCommit)` event outputs on the `Grid` directive
- **backwards-compat:** old directive names (`TbwCellView`, `TbwCellEditor`) exported as aliases

### Breaking Changes

The directive names have been simplified:

- `*tbwCellView` → `*tbwRenderer`
- `*tbwCellEditor` → `*tbwEditor`

**Migration:** Update your imports and template selectors. The old names are still exported as aliases for backwards compatibility.

```typescript
// Before
import { TbwCellView, TbwCellEditor } from '@toolbox-web/grid-angular';

// After
import { TbwRenderer, TbwEditor } from '@toolbox-web/grid-angular';
```

```html
<!-- Before -->
<app-status *tbwCellView="let value" [value]="value" />
<app-editor *tbwCellEditor="let value" [value]="value" />

<!-- After -->
<app-status *tbwRenderer="let value" [value]="value" />
<app-editor *tbwEditor="let value" [value]="value" />
```

## [0.1.0](https://github.com/OysteinAmundsen/toolbox/compare/grid-angular-0.0.1...grid-angular-0.1.0) (2026-01-10)

### Features

- added angular support through a separate wrapper package for the grid ([baaa1ee](https://github.com/OysteinAmundsen/toolbox/commit/baaa1ee65cef5531a8af941516d6d812bdd8762e))

## Changelog

All notable changes to `@toolbox-web/grid-angular` will be documented in this file.
