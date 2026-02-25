# Changelog

## [0.15.0](https://github.com/OysteinAmundsen/toolbox/compare/grid-angular-0.14.3...grid-angular-0.15.0) (2026-02-25)


### Features

* **grid:** add external focus container registry and focusTrap option ([66cb973](https://github.com/OysteinAmundsen/toolbox/commit/66cb9732d8450a864bac570f9baa833aeff3f342))
* **grid:** make getPluginByName type-safe and preferred plugin access method ([a69afef](https://github.com/OysteinAmundsen/toolbox/commit/a69afef45c5ccdf976e5d4c3286bd36f7d402cc4))


### Bug Fixes

* **grid,grid-angular:** stabilize overlay editor lifecycle during resize-triggered re-renders ([e1da999](https://github.com/OysteinAmundsen/toolbox/commit/e1da99942d0d5b9b72e5bbabea58200db1e3e97d))

## [0.14.3](https://github.com/OysteinAmundsen/toolbox/compare/grid-angular-0.14.2...grid-angular-0.14.3) (2026-02-24)


### Bug Fixes

* **grid,grid-angular:** flush managed editors before clearing edit state ([#142](https://github.com/OysteinAmundsen/toolbox/issues/142)) ([52b74e6](https://github.com/OysteinAmundsen/toolbox/commit/52b74e6700a28b95c108de2b9e2949a048eba06e))

## [0.14.2](https://github.com/OysteinAmundsen/toolbox/compare/grid-angular-0.14.1...grid-angular-0.14.2) (2026-02-22)


### Bug Fixes

* **grid,grid-angular,grid-react,grid-vue:** add typesVersions for Jest/CommonJS type resolution ([#137](https://github.com/OysteinAmundsen/toolbox/issues/137)) ([cfdf327](https://github.com/OysteinAmundsen/toolbox/commit/cfdf3271916225926d27842569c0dbfdb0fb986c))

## [0.14.1](https://github.com/OysteinAmundsen/toolbox/compare/grid-angular-0.14.0...grid-angular-0.14.1) (2026-02-21)


### Bug Fixes

* **grid:** plug memory leaks in framework adapter lifecycle ([0612c88](https://github.com/OysteinAmundsen/toolbox/commit/0612c8820441fd73caf725cff75dd68422eceedf))

## [0.14.0](https://github.com/OysteinAmundsen/toolbox/compare/grid-angular-0.13.3...grid-angular-0.14.0) (2026-02-20)


### Features

* **grid, grid-angular, grid-react, grid-vue:** add getSelectedRows() to SelectionPlugin ([a0bb977](https://github.com/OysteinAmundsen/toolbox/commit/a0bb977f5e623149dc6a1b5a8f71aeeccc6466e5))


### Bug Fixes

* **grid-angular:** use stable container for renderer rootNodes ([9e23de3](https://github.com/OysteinAmundsen/toolbox/commit/9e23de306df39ff2c29190d843a2302033cb0c02))

## [0.13.3](https://github.com/OysteinAmundsen/toolbox/compare/grid-angular-0.13.2...grid-angular-0.13.3) (2026-02-20)


### Bug Fixes

* **grid:** harden EditingPlugin row resolution against stale indices ([0208b15](https://github.com/OysteinAmundsen/toolbox/commit/0208b158278874d3ffee1d80e1152682130a6fc1))

## [0.13.2](https://github.com/OysteinAmundsen/toolbox/compare/grid-angular-0.13.1...grid-angular-0.13.2) (2026-02-18)


### Bug Fixes

* **grid:** add missing await for async method ([f2f790f](https://github.com/OysteinAmundsen/toolbox/commit/f2f790f490e07f1a1a6056b0863bac6fa9b94e4d))

## [0.13.1](https://github.com/OysteinAmundsen/toolbox/compare/grid-angular-0.13.0...grid-angular-0.13.1) (2026-02-16)


### Bug Fixes

* **grid-angular:** handle ng-container comment nodes and live hasFormGroups ([24e503c](https://github.com/OysteinAmundsen/toolbox/commit/24e503cbd5895f66e890199b4112041b497bf1c4))
* **grid:** check onBeforeEditClose for Escape in grid edit mode ([846ac39](https://github.com/OysteinAmundsen/toolbox/commit/846ac39b340e2e036ccec0de5b84019725b5def7))
* **grid:** prevent editor memory leak via releaseCell lifecycle hook ([00d2ef5](https://github.com/OysteinAmundsen/toolbox/commit/00d2ef5a1803a5329713a728f031a466c9d7d824))


### Enhancements

* **grid-angular:** add over-bottom-left overlay position, rename over-left to over-top-left ([d2ef2f4](https://github.com/OysteinAmundsen/toolbox/commit/d2ef2f41a4debbe40c87d2ce3e366feaae438bbd))

## [0.13.0](https://github.com/OysteinAmundsen/toolbox/compare/grid-angular-0.12.1...grid-angular-0.13.0) (2026-02-15)


### Features

* **grid-angular:** ([#129](https://github.com/OysteinAmundsen/toolbox/issues/129)) add BaseFilterPanel, BaseGridEditorCVA, and BaseOverlayEditor base classes ([34d4cf6](https://github.com/OysteinAmundsen/toolbox/commit/34d4cf627184d70d6145a9c8e09f0d497b00199e))
* **grid-angular:** eliminate CUSTOM_ELEMENTS_SCHEMA requirement ([1f097c3](https://github.com/OysteinAmundsen/toolbox/commit/1f097c3c89d977cdad0f210667389c2733a6b391))


### Bug Fixes

* **grid-angular:** handle lazy-rendered grids in selection discovery ([ccb75f6](https://github.com/OysteinAmundsen/toolbox/commit/ccb75f67f04884b6d00fd19d6d091b0149e1cfcc))
* **grid:** fix test failures and update docs to use pinned property ([295a6c8](https://github.com/OysteinAmundsen/toolbox/commit/295a6c8dc0346ff1de700eca81b49732b17a17c0))


### Enhancements

* **grid-angular:** eager grid discovery & reactive undo-redo signals ([3d649af](https://github.com/OysteinAmundsen/toolbox/commit/3d649af1382bf372d4d28ae51b4388459e97fcff))

## [0.12.1](https://github.com/OysteinAmundsen/toolbox/compare/grid-angular-0.12.0...grid-angular-0.12.1) (2026-02-12)


### Bug Fixes

* **grid-angular:** added sideeffects annotation to package ([95fc4de](https://github.com/OysteinAmundsen/toolbox/commit/95fc4def576fa0df29a8f6c87737502a0ed56a20))

## [0.12.0](https://github.com/OysteinAmundsen/toolbox/compare/grid-angular-0.11.1...grid-angular-0.12.0) (2026-02-11)


### Features

* **grid-angular:** add signal-based selection API ([58610de](https://github.com/OysteinAmundsen/toolbox/commit/58610de90c6abc8eb753c01a0f32491fa8668122))
* **grid-angular:** bridge filterPanelRenderer in framework adapters ([8142ed9](https://github.com/OysteinAmundsen/toolbox/commit/8142ed932113f49354ece1d7969f9b8957e7300e))


### Enhancements

* **grid-angular:** improve the custom editor lifecycle ([31e0343](https://github.com/OysteinAmundsen/toolbox/commit/31e0343a7f5142f750a5651c8d6d0ef1a35bd719))

## [0.11.1](https://github.com/OysteinAmundsen/toolbox/compare/grid-angular-0.11.0...grid-angular-0.11.1) (2026-02-09)


### Bug Fixes

* **grid-angular:** propperly intercept and handle angular specific config before handing over to grid ([0f0ba35](https://github.com/OysteinAmundsen/toolbox/commit/0f0ba3521c865a8d88b7e119be3fde43cc2799f3))


### Performance Improvements

* **grid:** optimize scroll rendering and fix master-detail height measurement ([0f5865d](https://github.com/OysteinAmundsen/toolbox/commit/0f5865d0d434f302752061395a2c9c0e03be824f))

## [0.11.0](https://github.com/OysteinAmundsen/toolbox/compare/grid-angular-0.10.0...grid-angular-0.11.0) (2026-02-07)


### Features

* **grid-angular,grid-react,grid-vue:** add feature-scoped hooks for selection and export ([41a06b6](https://github.com/OysteinAmundsen/toolbox/commit/41a06b66480f1ec4531cf83e681a6b4858dd54b9))
* **grid-angular,grid-react,grid-vue:** add feature-scoped hooks for undoRedo, filtering, print ([ee4f890](https://github.com/OysteinAmundsen/toolbox/commit/ee4f890ec2f55e8fc0bc766d25918a12f2e37d2f))
* **grid-angular,grid-react,grid-vue:** unify type names across framework bridges ([68505cf](https://github.com/OysteinAmundsen/toolbox/commit/68505cfcdb35bdd37ed716da4c276060cd718be4))
* **grid-angular:** add GridLazyForm directive for lazy form binding ([71584bb](https://github.com/OysteinAmundsen/toolbox/commit/71584bbe1cd5578be796af6dbe07c6260f447a12))
* **grid-angular:** enhance FormArray directive for grid editing mode ([8e8e3de](https://github.com/OysteinAmundsen/toolbox/commit/8e8e3dec2501992f7bc7c9359da400e95a5350f9))
* **grid:** implement variable row height virtualization ([#55](https://github.com/OysteinAmundsen/toolbox/issues/55)) ([#119](https://github.com/OysteinAmundsen/toolbox/issues/119)) ([5b4efb7](https://github.com/OysteinAmundsen/toolbox/commit/5b4efb79f064e40ee3ed098805f5c7e655a6fc93))

## [0.10.0](https://github.com/OysteinAmundsen/toolbox/compare/grid-angular-0.9.1...grid-angular-0.10.0) (2026-02-06)


### Features

* **grid-angular:** add AngularTypeDefault interface and processTypeDefaults support ([431e02d](https://github.com/OysteinAmundsen/toolbox/commit/431e02d5899cb84baf6ad0a6a8527fb452b578c5))
* **grid,grid-angular,grid-react,grid-vue:** add onBeforeEditClose callback for overlay support ([6a83c02](https://github.com/OysteinAmundsen/toolbox/commit/6a83c02a09ab357d6d2d876f8635c4948f8352a7))


### Bug Fixes

* **grid-angular:** return undefined from createEditor when no template exists ([63866eb](https://github.com/OysteinAmundsen/toolbox/commit/63866ebd24e208639fa9aa8474ada04c0a46d3bf))
* **grid-angular:** sync FormArray content changes & pass Space to editors ([963072f](https://github.com/OysteinAmundsen/toolbox/commit/963072f9f29ebf824230fbaa590013c85c91e112))
* **grid:** add missing exports ([6f3086f](https://github.com/OysteinAmundsen/toolbox/commit/6f3086f2e29454d9f61ff5c2bdcf1085f87b9576))

## [0.9.1](https://github.com/OysteinAmundsen/toolbox/compare/grid-angular-0.9.0...grid-angular-0.9.1) (2026-02-04)


### Bug Fixes

* **grid:** apply typeDefaults to columns at config merge time ([ecb6324](https://github.com/OysteinAmundsen/toolbox/commit/ecb6324280e5c97312726a192505aeb85e5fce7a))

## [0.9.0](https://github.com/OysteinAmundsen/toolbox/compare/grid-angular-0.8.0...grid-angular-0.9.0) (2026-02-03)


### Features

* **grid-angular:** bridge Angular FormControl validation to grid invalid styling ([cca89ec](https://github.com/OysteinAmundsen/toolbox/commit/cca89ecbef3d68c0fc4fd5c3f2da9870c7e4af70))

## [0.8.0](https://github.com/OysteinAmundsen/toolbox/compare/grid-angular-0.7.2...grid-angular-0.8.0) (2026-01-30)


### Features

* **grid-react,grid-angular:** add app-wide icon configuration providers ([731837b](https://github.com/OysteinAmundsen/toolbox/commit/731837bd1a308eaf6bb3404b7591042891327965))
* **grid-react,grid-angular:** support for loading ([f883e13](https://github.com/OysteinAmundsen/toolbox/commit/f883e136f8d4167907e706c11fa0d30183e10670))

## [0.7.2](https://github.com/OysteinAmundsen/toolbox/compare/grid-angular-0.7.1...grid-angular-0.7.2) (2026-01-29)


### Bug Fixes

* **grid-angular:** migrate to ng-packagr with secondary entry points ([5a6f3fb](https://github.com/OysteinAmundsen/toolbox/commit/5a6f3fb4fc6b7a7cb09306526903b33d9528f529))

## [0.7.1](https://github.com/OysteinAmundsen/toolbox/compare/grid-angular-0.7.0...grid-angular-0.7.1) (2026-01-29)


### Bug Fixes

* **grid-angular:** add missing multi-sort feature entry to vite builds ([50f9279](https://github.com/OysteinAmundsen/toolbox/commit/50f9279cdad2da51eefedc0ce3794b4fd81e3653))

## [0.7.0](https://github.com/OysteinAmundsen/toolbox/compare/grid-angular-0.6.0...grid-angular-0.7.0) (2026-01-28)


### Features

* **grid:** add gridConfig.filterable and gridConfig.selectable toggles ([8876b42](https://github.com/OysteinAmundsen/toolbox/commit/8876b42ea277f14b27dcb6d2e48d1e4e3b8c0315))


### Bug Fixes

* **grid-angular,grid-react:** fix TypeScript errors in typeDefaults editor assignment ([de84ad6](https://github.com/OysteinAmundsen/toolbox/commit/de84ad60938a61b08da725446846b1f922245f34))
* **grid,grid-angular,grid-react:** add sortable config and rename sorting to multiSort ([4522bfc](https://github.com/OysteinAmundsen/toolbox/commit/4522bfc71bebd3907e31932001c2cf19f7e0a257))

## [0.6.0](https://github.com/OysteinAmundsen/toolbox/compare/grid-angular-0.5.0...grid-angular-0.6.0) (2026-01-27)


### Features

* **grid-angular:** DX add tree-shakeable feature inputs and event outputs ([757f8de](https://github.com/OysteinAmundsen/toolbox/commit/757f8deafd34387b534914152b248b93da68a0a1))
* **grid-react:** Improving DX for react framework bridge ([#98](https://github.com/OysteinAmundsen/toolbox/issues/98)) ([19ab6ae](https://github.com/OysteinAmundsen/toolbox/commit/19ab6ae0816ae6d199a5b811bc7557a4e946ed05))

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
