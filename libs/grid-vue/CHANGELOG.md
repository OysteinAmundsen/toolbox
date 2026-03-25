# Changelog

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
