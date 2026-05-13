# Changelog

## [1.7.0](https://github.com/OysteinAmundsen/toolbox/compare/grid-vue-1.6.1...grid-vue-1.7.0) (2026-05-13)


### Features

* **grid:** add emptyRenderer config for no-rows / error overlay ([#321](https://github.com/OysteinAmundsen/toolbox/issues/321)) ([#322](https://github.com/OysteinAmundsen/toolbox/issues/322)) ([63118e3](https://github.com/OysteinAmundsen/toolbox/commit/63118e308557bdbedb083b0c1bb20a279782217b))

## [1.6.1](https://github.com/OysteinAmundsen/toolbox/compare/grid-vue-1.6.0...grid-vue-1.6.1) (2026-05-10)


### Bug Fixes

* **grid,grid-react,grid-angular:** honor gridConfig.features in dedup and template bridges ([45983a3](https://github.com/OysteinAmundsen/toolbox/commit/45983a3d0ca4957b7011a25c63bddadd001ed4fc))

## [1.6.0](https://github.com/OysteinAmundsen/toolbox/compare/grid-vue-1.5.1...grid-vue-1.6.0) (2026-05-08)


### Features

* **grid-vue:** make TbwGridColumn generic over TRow/TValue ([#289](https://github.com/OysteinAmundsen/toolbox/issues/289)) ([4a00688](https://github.com/OysteinAmundsen/toolbox/commit/4a00688ed1ef06d1ae49f4104890519dbd89cf1d))

## [1.5.1](https://github.com/OysteinAmundsen/toolbox/compare/grid-vue-1.5.0...grid-vue-1.5.1) (2026-05-07)


### Bug Fixes

* **grid-vue,grid-react:** default cell/editor TValue generic to any ([#289](https://github.com/OysteinAmundsen/toolbox/issues/289)) ([#290](https://github.com/OysteinAmundsen/toolbox/issues/290)) ([66ec863](https://github.com/OysteinAmundsen/toolbox/commit/66ec8635c9591244952b217a6a7ad2b5ff0f37f4))

## [1.5.0](https://github.com/OysteinAmundsen/toolbox/compare/grid-vue-1.4.0...grid-vue-1.5.0) (2026-05-02)


### Features

* **adapters:** add 10 missing grid events to vue & angular + drift guard ([c524fbf](https://github.com/OysteinAmundsen/toolbox/commit/c524fbf809bbdd1450e38bd165ff40eb30a643de))
* **adapters:** bring grid-react and grid-vue to full surface-area parity ([8a7314d](https://github.com/OysteinAmundsen/toolbox/commit/8a7314d61d424ffadabe803db1ed13c67897bd5f))
* **grid/pinned-rows:** unified slots[] API (issue [#255](https://github.com/OysteinAmundsen/toolbox/issues/255)) ([#257](https://github.com/OysteinAmundsen/toolbox/issues/257)) ([8a84f0d](https://github.com/OysteinAmundsen/toolbox/commit/8a84f0dc27c64a68645a72ee6c1cda8ce59a6929))


### Bug Fixes

* **grid/pinned-rows:** render top slot wrappers when .header is nested in .rows-body ([d781366](https://github.com/OysteinAmundsen/toolbox/commit/d781366bf72bd52dc35dec74bacf56ac2692c9f8))

## [1.4.0](https://github.com/OysteinAmundsen/toolbox/compare/grid-vue-1.3.0...grid-vue-1.4.0) (2026-04-29)


### Features

* **grid-vue:** overlay editor ([#253](https://github.com/OysteinAmundsen/toolbox/issues/253)) ([ca478ff](https://github.com/OysteinAmundsen/toolbox/commit/ca478ff162b8dd83b247ec28e8eaabeac7096127))


### Bug Fixes

* **grid-react,grid-vue:** flush focused editor on before-edit-close so Tab commits pending input ([9cafde1](https://github.com/OysteinAmundsen/toolbox/commit/9cafde17303e832bf02ce6749922ac1980cb969b))
* **grid,grid-react,grid-vue,grid-angular:** release renderers and flush editors on cell teardown ([#250](https://github.com/OysteinAmundsen/toolbox/issues/250)) ([3121b5f](https://github.com/OysteinAmundsen/toolbox/commit/3121b5f091663514692b53bc59863836637915bb))

## [1.3.0](https://github.com/OysteinAmundsen/toolbox/compare/grid-vue-1.2.0...grid-vue-1.3.0) (2026-04-25)


### Features

* **grid:** RowDragDropPlugin — drag rows within and across grids ([#225](https://github.com/OysteinAmundsen/toolbox/issues/225)) ([#246](https://github.com/OysteinAmundsen/toolbox/issues/246)) ([4a22beb](https://github.com/OysteinAmundsen/toolbox/commit/4a22bebfcad0d26df2302290b73761b090f429d7))

## [1.2.0](https://github.com/OysteinAmundsen/toolbox/compare/grid-vue-1.1.0...grid-vue-1.2.0) (2026-04-22)


### Features

* **grid-vue:** column shorthand + columnDefaults + plugin dep validation; add adapter-conformance ([#237](https://github.com/OysteinAmundsen/toolbox/issues/237)) ([1f84ecc](https://github.com/OysteinAmundsen/toolbox/commit/1f84ecc5240f3d33cf78c70600d3cc465fcf9bf4))


### Bug Fixes

* **grid-vue:** mount TeleportManager + wire createToolPanelRenderer for context-preserving renderers ([#237](https://github.com/OysteinAmundsen/toolbox/issues/237)) ([84fe96d](https://github.com/OysteinAmundsen/toolbox/commit/84fe96d6f6d6c29c760ba310727003c169dd1e7b))

## [1.1.0](https://github.com/OysteinAmundsen/toolbox/compare/grid-vue-1.0.0...grid-vue-1.1.0) (2026-04-20)


### Features

* **grid:** expose tbw-scroll CustomEvent for scroll-driven consumer use cases ([#234](https://github.com/OysteinAmundsen/toolbox/issues/234)) ([259171e](https://github.com/OysteinAmundsen/toolbox/commit/259171ed2e0f1735f4d277f6ad223987ee616390))

## [1.0.0](https://github.com/OysteinAmundsen/toolbox/compare/grid-vue-0.11.5...grid-vue-1.0.0) (2026-04-16)


### ⚠ BREAKING CHANGES

* Remove ~106 deprecated APIs across grid core and all framework adapters.

### Features

* remove deprecated APIs for v2 ([#186](https://github.com/OysteinAmundsen/toolbox/issues/186)) ([c1b4a95](https://github.com/OysteinAmundsen/toolbox/commit/c1b4a95fbf74950d168ea0df706d31d0d813c930))

## [0.11.5](https://github.com/OysteinAmundsen/toolbox/compare/grid-vue-0.11.4...grid-vue-0.11.5) (2026-04-15)


### Bug Fixes

* **grid-vue:** replace createApp with teleports for Vue context preservation ([e2caf8b](https://github.com/OysteinAmundsen/toolbox/commit/e2caf8bdf304a2686014a6737a58f098b282ee66))
* **grid,grid-react:** thread gridEl for multi-grid portal resolution ([f18e397](https://github.com/OysteinAmundsen/toolbox/commit/f18e3975ccd22336bf65cbb44710dabe8781fe53))

## [0.11.4](https://github.com/OysteinAmundsen/toolbox/compare/grid-vue-0.11.3...grid-vue-0.11.4) (2026-04-13)


### Bug Fixes

* **grid-react,grid-vue:** add missing tooltip feature build entry ([b7c586c](https://github.com/OysteinAmundsen/toolbox/commit/b7c586c987ffb71a6f6083a994fb2559f4304fb5))

## [0.11.3](https://github.com/OysteinAmundsen/toolbox/compare/grid-vue-0.11.2...grid-vue-0.11.3) (2026-04-05)


### Bug Fixes

* **grid-vue,grid-react:** close adapter API parity gaps ([3ff3e9a](https://github.com/OysteinAmundsen/toolbox/commit/3ff3e9a8ae0d9e03bfa4ef73f6637a344f4c7a02))

## [0.11.2](https://github.com/OysteinAmundsen/toolbox/compare/grid-vue-0.11.1...grid-vue-0.11.2) (2026-03-29)


### Bug Fixes

* **grid-angular:** re-export feature type anchors to preserve FeatureConfig augmentation ([8d47822](https://github.com/OysteinAmundsen/toolbox/commit/8d4782291fd2475611160713e2d5d39ae391a358))


### Enhancements

* **grid-angular,grid-react,grid-vue:** add optional selector parameter to inject/use functions for multi-grid support ([c8e377d](https://github.com/OysteinAmundsen/toolbox/commit/c8e377d7c2af48ab865d77db97e873739bd46451))

## [0.11.1](https://github.com/OysteinAmundsen/toolbox/compare/grid-vue-0.11.0...grid-vue-0.11.1) (2026-03-26)


### Bug Fixes

* **grid-react,grid-vue:** forward options parameter in filtering proxy methods ([1f2a35f](https://github.com/OysteinAmundsen/toolbox/commit/1f2a35f1110e36216fbdf601377d8c9833b67bee))

## [0.11.0](https://github.com/OysteinAmundsen/toolbox/compare/grid-vue-0.10.3...grid-vue-0.11.0) (2026-03-26)


### Features

* **grid:** add TooltipPlugin with popover-based overflow tooltips ([61fc11c](https://github.com/OysteinAmundsen/toolbox/commit/61fc11c1b755b8eabbd019e37901e2a84ee8bf8a))

## [0.10.3](https://github.com/OysteinAmundsen/toolbox/compare/grid-vue-0.10.2...grid-vue-0.10.3) (2026-03-25)


### Enhancements

* **grid:** add filtering UX helpers — stale detection, set helpers, data ranges, blank toggle ([#166](https://github.com/OysteinAmundsen/toolbox/issues/166), [#167](https://github.com/OysteinAmundsen/toolbox/issues/167), [#168](https://github.com/OysteinAmundsen/toolbox/issues/168), [#169](https://github.com/OysteinAmundsen/toolbox/issues/169)) ([b5452a8](https://github.com/OysteinAmundsen/toolbox/commit/b5452a8d04eb73caa96216004c1e50ae7c155309))

## [0.10.2](https://github.com/OysteinAmundsen/toolbox/compare/grid-vue-0.10.1...grid-vue-0.10.2) (2026-03-17)


### Bug Fixes

* **grid,grid-react,grid-vue:** plug memory leaks in adapters, cache, and global handlers ([c69c86d](https://github.com/OysteinAmundsen/toolbox/commit/c69c86d1a93d2653a45832c28021a40e5b1563c8))

## [0.10.1](https://github.com/OysteinAmundsen/toolbox/compare/grid-vue-0.10.0...grid-vue-0.10.1) (2026-03-16)


### Enhancements

* **grid,grid-react,grid-vue,grid-angular:** allow columnGroups and per-group renderer in plugin config ([91960a9](https://github.com/OysteinAmundsen/toolbox/commit/91960a9ae1c5920abcc5ceed30f3c5f94a19ca3e))

## [0.10.0](https://github.com/OysteinAmundsen/toolbox/compare/grid-vue-0.9.0...grid-vue-0.10.0) (2026-03-15)


### Features

* **grid-vue:** expand event emits to 24 events, deprecate useGridEvent ([34bdc1b](https://github.com/OysteinAmundsen/toolbox/commit/34bdc1ba3de395549c8760b6dd0f39ba5b891b15))


### Enhancements

* **grid-angular:** migrate addEventListener to .on() API ([0592112](https://github.com/OysteinAmundsen/toolbox/commit/059211291721f450ba51c4a9bd8699297cc0866b))
* **grid-react:** migrate addEventListener to .on() API ([24ff2b2](https://github.com/OysteinAmundsen/toolbox/commit/24ff2b21dad39cc03f648e8365be5c4634190b6e))

## [0.9.0](https://github.com/OysteinAmundsen/toolbox/compare/grid-vue-0.8.0...grid-vue-0.9.0) (2026-03-14)


### Features

* **grid-angular,grid-react,grid-vue:** bridge all custom renderer callbacks ([4c01a08](https://github.com/OysteinAmundsen/toolbox/commit/4c01a0877a55a0fe26ae48a7b9c433ff728a82bb))


### Bug Fixes

* **grid-vue:** replace inline import() with static type import ([4ff1ee8](https://github.com/OysteinAmundsen/toolbox/commit/4ff1ee8868b600af05511a7d3a692bbd8cb44a80))

## [0.8.0](https://github.com/OysteinAmundsen/toolbox/compare/grid-vue-0.7.1...grid-vue-0.8.0) (2026-03-12)


### Features

* **grid:** add declarative features API for plugin configuration ([94fa3b4](https://github.com/OysteinAmundsen/toolbox/commit/94fa3b4fcfafb80f562d3458f369bfe9c5763b17))


### Bug Fixes

* **grid:** resolve adapter test aliases to source instead of dist ([deefc10](https://github.com/OysteinAmundsen/toolbox/commit/deefc1064d7f14364fc71b87682668fec047b236))

## [0.7.1](https://github.com/OysteinAmundsen/toolbox/compare/grid-vue-0.7.0...grid-vue-0.7.1) (2026-03-11)


### Bug Fixes

* **grid-angular:** use getPluginByName in adapter features ([acfb512](https://github.com/OysteinAmundsen/toolbox/commit/acfb5128d324ef9abed16902d609d25da99df0cb))
* **grid-react:** use getPluginByName in adapter features ([69d00bf](https://github.com/OysteinAmundsen/toolbox/commit/69d00bf7399e0b30f6fc5c54986482d9bc2ab52f))
* **grid-vue:** use getPluginByName in adapter features and composable ([f51808b](https://github.com/OysteinAmundsen/toolbox/commit/f51808bc9aa8b021cb30c07b675c7475c3e714f5))
* **grid:** recommend getPluginByName over getPlugin in docs and examples ([042b58b](https://github.com/OysteinAmundsen/toolbox/commit/042b58b2e429dc9cb7f4f278cbdd206d72b30ca3))

## [0.7.0](https://github.com/OysteinAmundsen/toolbox/compare/grid-vue-0.6.0...grid-vue-0.7.0) (2026-02-27)


### Features

* **grid:** add transaction API to UndoRedoPlugin for compound undo/redo ([b9d4132](https://github.com/OysteinAmundsen/toolbox/commit/b9d41326344969f8ba27542685833da5af8b5694))

## [0.6.0](https://github.com/OysteinAmundsen/toolbox/compare/grid-vue-0.5.2...grid-vue-0.6.0) (2026-02-25)


### Features

* **grid:** make getPluginByName type-safe and preferred plugin access method ([a69afef](https://github.com/OysteinAmundsen/toolbox/commit/a69afef45c5ccdf976e5d4c3286bd36f7d402cc4))

## [0.5.2](https://github.com/OysteinAmundsen/toolbox/compare/grid-vue-0.5.1...grid-vue-0.5.2) (2026-02-22)


### Bug Fixes

* **grid,grid-angular,grid-react,grid-vue:** add typesVersions for Jest/CommonJS type resolution ([#137](https://github.com/OysteinAmundsen/toolbox/issues/137)) ([cfdf327](https://github.com/OysteinAmundsen/toolbox/commit/cfdf3271916225926d27842569c0dbfdb0fb986c))

## [0.5.1](https://github.com/OysteinAmundsen/toolbox/compare/grid-vue-0.5.0...grid-vue-0.5.1) (2026-02-21)


### Bug Fixes

* **grid:** plug memory leaks in framework adapter lifecycle ([0612c88](https://github.com/OysteinAmundsen/toolbox/commit/0612c8820441fd73caf725cff75dd68422eceedf))

## [0.5.0](https://github.com/OysteinAmundsen/toolbox/compare/grid-vue-0.4.2...grid-vue-0.5.0) (2026-02-20)


### Features

* **grid, grid-angular, grid-react, grid-vue:** add getSelectedRows() to SelectionPlugin ([a0bb977](https://github.com/OysteinAmundsen/toolbox/commit/a0bb977f5e623149dc6a1b5a8f71aeeccc6466e5))

## [0.4.2](https://github.com/OysteinAmundsen/toolbox/compare/grid-vue-0.4.1...grid-vue-0.4.2) (2026-02-16)


### Bug Fixes

* **grid:** prevent editor memory leak via releaseCell lifecycle hook ([00d2ef5](https://github.com/OysteinAmundsen/toolbox/commit/00d2ef5a1803a5329713a728f031a466c9d7d824))
* **grid:** route type/config editors to editorViews for releaseCell cleanup ([4be2a0d](https://github.com/OysteinAmundsen/toolbox/commit/4be2a0d278183cb47ddab1442e5b81b29985b276))

## [0.4.1](https://github.com/OysteinAmundsen/toolbox/compare/grid-vue-0.4.0...grid-vue-0.4.1) (2026-02-15)


### Bug Fixes

* **grid:** fix test failures and update docs to use pinned property ([295a6c8](https://github.com/OysteinAmundsen/toolbox/commit/295a6c8dc0346ff1de700eca81b49732b17a17c0))

## [0.4.0](https://github.com/OysteinAmundsen/toolbox/compare/grid-vue-0.3.1...grid-vue-0.4.0) (2026-02-11)


### Features

* **grid-vue:** bridge filterPanelRenderer in framework adapters ([3923133](https://github.com/OysteinAmundsen/toolbox/commit/39231335334f0661c611a0e5c3ca40c5972a2f04))


### Bug Fixes

* **grid-vue:** re-exporting the GridConfig ([45f55f0](https://github.com/OysteinAmundsen/toolbox/commit/45f55f05ce860ce4087366c71afecdaee4913094))

## [0.3.1](https://github.com/OysteinAmundsen/toolbox/compare/grid-vue-0.3.0...grid-vue-0.3.1) (2026-02-09)


### Bug Fixes

* **grid-vue:** prevent double-wrapping of Vue renderers in demo and adapter ([5c19d34](https://github.com/OysteinAmundsen/toolbox/commit/5c19d346850add91e28ce3d5fae91ed3083bcf83))
* **grid-vue:** process config-based renderers/editors through adapter ([b7217db](https://github.com/OysteinAmundsen/toolbox/commit/b7217db3ab1fd9e610858ed0bf5a86ceaad1a21f))

## [0.3.0](https://github.com/OysteinAmundsen/toolbox/compare/grid-vue-0.2.0...grid-vue-0.3.0) (2026-02-07)


### Features

* **grid-angular,grid-react,grid-vue:** add feature-scoped hooks for selection and export ([41a06b6](https://github.com/OysteinAmundsen/toolbox/commit/41a06b66480f1ec4531cf83e681a6b4858dd54b9))
* **grid-angular,grid-react,grid-vue:** add feature-scoped hooks for undoRedo, filtering, print ([ee4f890](https://github.com/OysteinAmundsen/toolbox/commit/ee4f890ec2f55e8fc0bc766d25918a12f2e37d2f))
* **grid-angular,grid-react,grid-vue:** unify type names across framework bridges ([68505cf](https://github.com/OysteinAmundsen/toolbox/commit/68505cfcdb35bdd37ed716da4c276060cd718be4))
* **grid:** implement variable row height virtualization ([#55](https://github.com/OysteinAmundsen/toolbox/issues/55)) ([#119](https://github.com/OysteinAmundsen/toolbox/issues/119)) ([5b4efb7](https://github.com/OysteinAmundsen/toolbox/commit/5b4efb79f064e40ee3ed098805f5c7e655a6fc93))

## [0.2.0](https://github.com/OysteinAmundsen/toolbox/compare/grid-vue-0.1.0...grid-vue-0.2.0) (2026-02-06)


### Features

* **grid-vue:** add type defaults support for parity with react/angular adapters ([292b5e6](https://github.com/OysteinAmundsen/toolbox/commit/292b5e63d60a0044c41d03d115bd22e293606010))
* **grid,grid-angular,grid-react,grid-vue:** add onBeforeEditClose callback for overlay support ([6a83c02](https://github.com/OysteinAmundsen/toolbox/commit/6a83c02a09ab357d6d2d876f8635c4948f8352a7))

## 0.1.0 (2026-02-01)

### Features

- **grid-vue:** [#72](https://github.com/OysteinAmundsen/toolbox/issues/72) vue 3 framework adapter toolbox webgrid vue ([#110](https://github.com/OysteinAmundsen/toolbox/issues/110)) ([d002329](https://github.com/OysteinAmundsen/toolbox/commit/d00232910d840e4dfe78b15ec9e1a6d2a1de66d8))
