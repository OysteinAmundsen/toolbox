# Changelog

## [0.5.0](https://github.com/OysteinAmundsen/toolbox/compare/grid-angular-0.4.0...grid-angular-0.5.0) (2026-01-26)


### Features

* **grid-angular:** [#80](https://github.com/OysteinAmundsen/toolbox/issues/80) angular reactive forms integration ([#94](https://github.com/OysteinAmundsen/toolbox/issues/94)) ([487118f](https://github.com/OysteinAmundsen/toolbox/commit/487118fc6fcc4e983cb727a282dca223d9b86fe7))

## [0.4.0](https://github.com/OysteinAmundsen/toolbox/compare/grid-angular-0.3.1...grid-angular-0.4.0) (2026-01-22)


### Features

* **grid:** add ResponsivePlugin for card layout mode ([#56](https://github.com/OysteinAmundsen/toolbox/issues/56)) ([#62](https://github.com/OysteinAmundsen/toolbox/issues/62)) ([98d8057](https://github.com/OysteinAmundsen/toolbox/commit/98d8057fffd098ffdc5632603d5f2db03c435a2a))

## [0.3.1](https://github.com/OysteinAmundsen/toolbox/compare/grid-angular-0.3.0...grid-angular-0.3.1) (2026-01-22)


### Bug Fixes

* **grid-angular:** [#57](https://github.com/OysteinAmundsen/toolbox/issues/57) correct package exports paths ([22460b4](https://github.com/OysteinAmundsen/toolbox/commit/22460b4028f3a7358873694c9a3b416bca508e91))

## [0.3.0](https://github.com/OysteinAmundsen/toolbox/compare/grid-angular-0.2.0...grid-angular-0.3.0) (2026-01-21)


### Features

* **grid-angular:** support component classes in column config ([9c0bb3b](https://github.com/OysteinAmundsen/toolbox/commit/9c0bb3b7fce871685ef05e702ca09c93d608bdef))
* **grid:** add type-level default renderers and editors ([b13421d](https://github.com/OysteinAmundsen/toolbox/commit/b13421d8abad014d3e3e486545db6c9ff7126d6e))

## [0.2.0](https://github.com/OysteinAmundsen/toolbox/compare/grid-angular-0.1.3...grid-angular-0.2.0) (2026-01-19)


### Features

* **grid:** add cellClass and rowClass callbacks for dynamic styling ([5a5121c](https://github.com/OysteinAmundsen/toolbox/commit/5a5121c3c1cec3666d646c4615d86e17d83c2a57))

## [0.1.3](https://github.com/OysteinAmundsen/toolbox/compare/grid-angular-0.1.2...grid-angular-0.1.3) (2026-01-16)


### Enhancements

* **grid:** Added inter-plugin dependencies ([05f9f8e](https://github.com/OysteinAmundsen/toolbox/commit/05f9f8e2bc39be8ea9b39debfd09771542d21dbc))

## [0.1.3](https://github.com/OysteinAmundsen/toolbox/compare/grid-angular-0.1.2...grid-angular-0.1.3) (2026-01-16)


### Enhancements

* **grid:** Added inter-plugin dependencies ([05f9f8e](https://github.com/OysteinAmundsen/toolbox/commit/05f9f8e2bc39be8ea9b39debfd09771542d21dbc))

## [0.1.2](https://github.com/OysteinAmundsen/toolbox/compare/grid-angular-0.1.1...grid-angular-0.1.2) (2026-01-12)


### Bug Fixes

* **docs:** update README files for grid-angular, grid-react, and grid with new features and sponsorship links ([6b12d8a](https://github.com/OysteinAmundsen/toolbox/commit/6b12d8a01e4da19ff602af6ce896170239c44367))
* **shell:** escape HTML in shell header title to prevent XSS vulnerabilities ([6b12d8a](https://github.com/OysteinAmundsen/toolbox/commit/6b12d8a01e4da19ff602af6ce896170239c44367))

## [0.1.1](https://github.com/OysteinAmundsen/toolbox/compare/grid-angular-0.1.0...grid-angular-0.1.1) (2026-01-12)


### Bug Fixes

* copy readme to build output ([5326377](https://github.com/OysteinAmundsen/toolbox/commit/532637797790ae346f8ec51051e2e42edd1bfae9))
* resolve lint errors and improve package documentation ([2847835](https://github.com/OysteinAmundsen/toolbox/commit/2847835a3275e5df53a40e1868020d83c7a9406f))


### Enhancements

* **grid-angular:** improved developer ergonomics in creating grids ([2d77f07](https://github.com/OysteinAmundsen/toolbox/commit/2d77f071de68a15d64e5c2b8f80c13a89a13217b))

## [0.1.1](https://github.com/OysteinAmundsen/toolbox/compare/grid-angular-0.1.0...grid-angular-0.1.1) (2026-01-12)


### Bug Fixes

* copy readme to build output ([5326377](https://github.com/OysteinAmundsen/toolbox/commit/532637797790ae346f8ec51051e2e42edd1bfae9))
* resolve lint errors and improve package documentation ([2847835](https://github.com/OysteinAmundsen/toolbox/commit/2847835a3275e5df53a40e1868020d83c7a9406f))


### Enhancements

* **grid-angular:** improved developer ergonomics in creating grids ([2d77f07](https://github.com/OysteinAmundsen/toolbox/commit/2d77f071de68a15d64e5c2b8f80c13a89a13217b))

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
