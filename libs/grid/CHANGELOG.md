# Changelog

## [1.1.1](https://github.com/OysteinAmundsen/toolbox/compare/grid-1.1.0...grid-1.1.1) (2026-01-22)


### Bug Fixes

* **grid:** skip group rows in ResponsivePlugin cardRenderer ([b69e774](https://github.com/OysteinAmundsen/toolbox/commit/b69e774bb31f017e0d6f40ce241f28e86c043b4c))

## [1.1.0](https://github.com/OysteinAmundsen/toolbox/compare/grid-1.0.0...grid-1.1.0) (2026-01-22)


### Features

* **grid:** add plugin manifest system for declarative validation ([#59](https://github.com/OysteinAmundsen/toolbox/issues/59)) ([31874ee](https://github.com/OysteinAmundsen/toolbox/commit/31874eeeea57299af9bce121d9acc6ce0ab9b8bf))
* **grid:** add ResponsivePlugin for card layout mode ([#56](https://github.com/OysteinAmundsen/toolbox/issues/56)) ([#62](https://github.com/OysteinAmundsen/toolbox/issues/62)) ([98d8057](https://github.com/OysteinAmundsen/toolbox/commit/98d8057fffd098ffdc5632603d5f2db03c435a2a))
* **grid:** add triggerOn option to SelectionPlugin ([#53](https://github.com/OysteinAmundsen/toolbox/issues/53)) ([#61](https://github.com/OysteinAmundsen/toolbox/issues/61)) ([733d12f](https://github.com/OysteinAmundsen/toolbox/commit/733d12f36a2ad888125511b188ed057b0599d3de))

## [1.0.0](https://github.com/OysteinAmundsen/toolbox/compare/grid-0.6.0...grid-1.0.0) (2026-01-21)


### ⚠ BREAKING CHANGES

* **grid:** remove all deprecated APIs for v1.0.0
* **grid:** move editOn from core to EditingPlugin ownership

### Features

* **grid-angular:** support component classes in column config ([9c0bb3b](https://github.com/OysteinAmundsen/toolbox/commit/9c0bb3b7fce871685ef05e702ca09c93d608bdef))
* **grid:** add cell-click and row-click events for consumers ([0e8366f](https://github.com/OysteinAmundsen/toolbox/commit/0e8366f0b603f16032b2a6dfd33b6c26175b7ae9))
* **grid:** add editorParams for built-in editor configuration ([#49](https://github.com/OysteinAmundsen/toolbox/issues/49)) ([ef73c16](https://github.com/OysteinAmundsen/toolbox/commit/ef73c164c8d8522e03abbd1cf65a454b5456d7b5))
* **grid:** add row update api ([#51](https://github.com/OysteinAmundsen/toolbox/issues/51)) ([c75010c](https://github.com/OysteinAmundsen/toolbox/commit/c75010c2128d54e6874a060375d8c1b540db1ac9))
* **grid:** add type-level default renderers and editors ([b13421d](https://github.com/OysteinAmundsen/toolbox/commit/b13421d8abad014d3e3e486545db6c9ff7126d6e))
* **grid:** add unified cell-activate event with trigger discriminator ([723eaf6](https://github.com/OysteinAmundsen/toolbox/commit/723eaf63c00423d1759b083349d131c711ea32b4))
* **grid:** support [@group](https://github.com/group) tags in typedoc-to-mdx script ([1a0512b](https://github.com/OysteinAmundsen/toolbox/commit/1a0512bce36d66429b3c94e3cc350007f36dec8c))


### Miscellaneous

* **grid:** remove all deprecated APIs for v1.0.0 ([16bdefa](https://github.com/OysteinAmundsen/toolbox/commit/16bdefa57d1f3166cb05c678438e4a1027596d83))


### Code Refactoring

* **grid:** move editOn from core to EditingPlugin ownership ([01d5708](https://github.com/OysteinAmundsen/toolbox/commit/01d570854dd0fc2fa2982183ef36515e37bfeb33))

## [0.6.0](https://github.com/OysteinAmundsen/toolbox/compare/grid-0.5.0...grid-0.6.0) (2026-01-19)


### Features

* **grid:** add cellClass and rowClass callbacks for dynamic styling ([5a5121c](https://github.com/OysteinAmundsen/toolbox/commit/5a5121c3c1cec3666d646c4615d86e17d83c2a57))
* **grid:** add createGrid/queryGrid factory functions ([c00fba0](https://github.com/OysteinAmundsen/toolbox/commit/c00fba0b306f19e73106e59d3ec5a90d4c2fc5b3))


### Bug Fixes

* **grid:** narrow sideEffects to enable tree-shaking ([6e006fe](https://github.com/OysteinAmundsen/toolbox/commit/6e006fe57a335eb0d94e3b1bbcd63a48508d2bcd))
* lint errors ([21af95d](https://github.com/OysteinAmundsen/toolbox/commit/21af95d0716d53d4d261f5852eccd86030a32163))


### Performance Improvements

* **grid:** delegate row click/dblclick events ([923ba46](https://github.com/OysteinAmundsen/toolbox/commit/923ba46b8c4a67843f0bf1b58cb1695e7653c226))

## [0.5.0](https://github.com/OysteinAmundsen/toolbox/compare/grid-0.4.2...grid-0.5.0) (2026-01-18)


### Features

* **grid:** add vertical resize indicator line on column resize hover ([ce42745](https://github.com/OysteinAmundsen/toolbox/commit/ce4274537958aa099ec19dc24546a79e81b6541f))
* **grid:** extend column group borders through all data rows ([75d8c2c](https://github.com/OysteinAmundsen/toolbox/commit/75d8c2c0d76965e410a1b11131ae8560be193867))
* **grid:** implement CSS Cascade Layers for styling architecture ([b0c5067](https://github.com/OysteinAmundsen/toolbox/commit/b0c50678d5527c042707916821dc89c67f960d76))
* **grid:** refactor CSS variables to use base tokens and relative units ([6ac52f4](https://github.com/OysteinAmundsen/toolbox/commit/6ac52f43bcdc8a7f13fbb7c39e9bd6eb19ddcfa3))
* **grid:** removed shadowDom to allow for easier styling of the grid ([#42](https://github.com/OysteinAmundsen/toolbox/issues/42)) ([da1c6d4](https://github.com/OysteinAmundsen/toolbox/commit/da1c6d46d14fa338878253e1d52913aab381b17e))
* **grid:** use CSS Anchor Positioning for filter panel with JS fallback ([22a51da](https://github.com/OysteinAmundsen/toolbox/commit/22a51da19effac648724828532f2984f42be070c))


### Bug Fixes

* **editing:** fix editing plugin not rendering custom editors properly. ([e67adeb](https://github.com/OysteinAmundsen/toolbox/commit/e67adeb0f34ec1c7bca31490060b0fb47b9a0bee))
* **grid:** accumulate plugin styles across multiple grid instances ([25d093a](https://github.com/OysteinAmundsen/toolbox/commit/25d093ad7a5819613329e42e4eceafe107c42e8b))
* **grid:** align filter panel to header cell instead of filter icon ([7378677](https://github.com/OysteinAmundsen/toolbox/commit/737867750057df11265c43653c9b88537c5a494e))
* **grid:** correct context menu conditional items story to use disabled function ([f7e38bd](https://github.com/OysteinAmundsen/toolbox/commit/f7e38bd7ebcf776f42cd8e086e2f22455fad29ae))
* **grid:** ensure numeric widths are used for column resizing ([5cd4076](https://github.com/OysteinAmundsen/toolbox/commit/5cd4076a82be0a0225aefb84b76d87a306ba6088))
* **grid:** respect caseSensitive in filter panel search ([1048336](https://github.com/OysteinAmundsen/toolbox/commit/104833648b50a130b5ccff14fb0054070351addf))
* **reorder:** column-move event must be emitted before actual move in order to cancel it ([55a4026](https://github.com/OysteinAmundsen/toolbox/commit/55a4026d5ccc83c04a5cddfd5663af00b6abbeb6))
* **visibility:** account for utility columns in reorder index ([d26d1ae](https://github.com/OysteinAmundsen/toolbox/commit/d26d1aebaff923678b9635ec7a6c944f412001c7))

## [0.4.2](https://github.com/OysteinAmundsen/toolbox/compare/grid-0.4.1...grid-0.4.2) (2026-01-17)


### Bug Fixes

* build errors ([cccfdc5](https://github.com/OysteinAmundsen/toolbox/commit/cccfdc5806d7bed4bac447ccfcbfd63318315582))
* finetuning plugins ([88d1d6a](https://github.com/OysteinAmundsen/toolbox/commit/88d1d6a3e387455f5d150ae3a503a8212f10b3d2))


### Enhancements

* streamlined DX for plugin development ([f69dd4d](https://github.com/OysteinAmundsen/toolbox/commit/f69dd4d48d0fe4f84eddd8e03ee10240cdf35d38))

## [0.4.1](https://github.com/OysteinAmundsen/toolbox/compare/grid-0.4.0...grid-0.4.1) (2026-01-16)


### Enhancements

* added plugin dependency manifest ([7daecc2](https://github.com/OysteinAmundsen/toolbox/commit/7daecc2f98cebe10d66eced951fa57f44ff6d95d))
* **grid:** Added inter-plugin dependencies ([05f9f8e](https://github.com/OysteinAmundsen/toolbox/commit/05f9f8e2bc39be8ea9b39debfd09771542d21dbc))

## [0.4.0](https://github.com/OysteinAmundsen/toolbox/compare/grid-0.3.3...grid-0.4.0) (2026-01-16)


### Features

* **grid:** Moved editing capabilities out of core. This is now an opt-in plugin instead. ([4e1ee94](https://github.com/OysteinAmundsen/toolbox/commit/4e1ee94faee560c477993d65424b7e0058bba1a0))
* **grid:** moved to a centralized configuration manager ([06286e7](https://github.com/OysteinAmundsen/toolbox/commit/06286e7d570f64592b3cd400d2e9b828b2de8d95))


### Bug Fixes

* **docs:** Examples for angular. ([2b9fdca](https://github.com/OysteinAmundsen/toolbox/commit/2b9fdcabf50f986e00a01d3dbf874189554e2d09))
* **rendering:** plugins did not render correctly after refactor ([4dd6d12](https://github.com/OysteinAmundsen/toolbox/commit/4dd6d120396a87f767c8bdaeba54a8ddfe65729e))


### Enhancements

* **docs:** improved documentation with the opt-in and good and bad practice. ([605d951](https://github.com/OysteinAmundsen/toolbox/commit/605d9515f973356c3c68eaa4d160ceaa9f3dabe8))
* **grid:** added a centralized rendering pipeline to prevent race conditions in rendering. ([8981998](https://github.com/OysteinAmundsen/toolbox/commit/898199873bd5691b020fe621a596c7fa43ce5707))
* **grid:** added a non-intrusive debug log. ([16dc37a](https://github.com/OysteinAmundsen/toolbox/commit/16dc37a5cf5e8ad5658ff1a6d21f5010ee0e1275))
* **grid:** increased typesafety and documentation ([bd63078](https://github.com/OysteinAmundsen/toolbox/commit/bd630784ecf3043ecb1a37ca2a3498d91ef4a20b))

## [0.3.3](https://github.com/OysteinAmundsen/toolbox/compare/grid-0.3.2...grid-0.3.3) (2026-01-12)


### Bug Fixes

* **docs:** update README files for grid-angular, grid-react, and grid with new features and sponsorship links ([6b12d8a](https://github.com/OysteinAmundsen/toolbox/commit/6b12d8a01e4da19ff602af6ce896170239c44367))
* **shell:** escape HTML in shell header title to prevent XSS vulnerabilities ([6b12d8a](https://github.com/OysteinAmundsen/toolbox/commit/6b12d8a01e4da19ff602af6ce896170239c44367))

## [0.3.2](https://github.com/OysteinAmundsen/toolbox/compare/grid-0.3.1...grid-0.3.2) (2026-01-12)


### Bug Fixes

* resolve lint errors and improve package documentation ([2847835](https://github.com/OysteinAmundsen/toolbox/commit/2847835a3275e5df53a40e1868020d83c7a9406f))


### Enhancements

* **docs:** Improved documentation coverage ([39b5626](https://github.com/OysteinAmundsen/toolbox/commit/39b5626cc2bd16c61b26458d636506797626b7b6))
* **grid-angular:** improved developer ergonomics in creating grids ([2d77f07](https://github.com/OysteinAmundsen/toolbox/commit/2d77f071de68a15d64e5c2b8f80c13a89a13217b))
* **grid:** framework and aria support ([a7266c8](https://github.com/OysteinAmundsen/toolbox/commit/a7266c8137c57b677f6dd2f439dab378a090114f))

## [0.3.1](https://github.com/OysteinAmundsen/toolbox/compare/grid-0.3.0...grid-0.3.1) (2026-01-10)


### Bug Fixes

* lint errors ([e4b93a6](https://github.com/OysteinAmundsen/toolbox/commit/e4b93a69cf800e42cefdf9e398fc7ded7eb49f48))

## [0.3.0](https://github.com/OysteinAmundsen/toolbox/compare/grid-0.2.8...grid-0.3.0) (2026-01-10)


### Features

* added angular support through a separate wrapper package for the grid ([baaa1ee](https://github.com/OysteinAmundsen/toolbox/commit/baaa1ee65cef5531a8af941516d6d812bdd8762e))
* **grid:** unified resizable tool panel with accordion sections ([44e13b7](https://github.com/OysteinAmundsen/toolbox/commit/44e13b79e79c887fca595040469aa7c389a2ae10))


### Bug Fixes

* added storybook url to npm ([0561b97](https://github.com/OysteinAmundsen/toolbox/commit/0561b977f5420a036e791cc46630aca89c9be236))
* **column:** resize broke after refactor. ([9f6ffae](https://github.com/OysteinAmundsen/toolbox/commit/9f6ffae40b42f92c74bcc1f17a1ae8778e8c94d3))
* **docs:** fix logo links and default initial page ([279969f](https://github.com/OysteinAmundsen/toolbox/commit/279969f4234754c3e78d6764785c5ec6be9466de))
* **grid:** add version attribute for debugging ([#12](https://github.com/OysteinAmundsen/toolbox/issues/12)) ([d3a15e8](https://github.com/OysteinAmundsen/toolbox/commit/d3a15e855d15cca3e87570a0dcb61c904d45dd2c))
* **grid:** added animation support ([66e056a](https://github.com/OysteinAmundsen/toolbox/commit/66e056a7929c3d3c449eb7216ade563eff05a42a))
* **grid:** all.ts re-exports full core API + document icons config ([69c7501](https://github.com/OysteinAmundsen/toolbox/commit/69c7501ac67a8cc70c5ac79dbb6f5ee7b38f293b))
* **grid:** ARIA compliance, keyboard nav, editing lifecycle, and virtualization ([7600fec](https://github.com/OysteinAmundsen/toolbox/commit/7600feca1994dd6730d383fbf2bcacee9d183c6a))
* **grid:** bugfixes for plugins so that the controls in the docs work as expected ([cb9ced0](https://github.com/OysteinAmundsen/toolbox/commit/cb9ced086f184f914a6d77371f76e46893d7893a))
* **grid:** editOn should be allowed to disable editing by setting `false` ([31c0ea7](https://github.com/OysteinAmundsen/toolbox/commit/31c0ea73f4ed6337273c03b3d05f179def067db9))
* **grid:** erroneous link ([08d747e](https://github.com/OysteinAmundsen/toolbox/commit/08d747e65f3dbc55b721a44d92afb4abdc53e853))
* **grid:** GridElement interface to include focusRow/focusCol properties ([#2](https://github.com/OysteinAmundsen/toolbox/issues/2)) ([a12a43f](https://github.com/OysteinAmundsen/toolbox/commit/a12a43fac53f687aadfc7c8e819c5d98a38d4b14))
* **grid:** linting error ([ffc68ce](https://github.com/OysteinAmundsen/toolbox/commit/ffc68cea3bdff74ec743198a5ac71a4a9a3149a3))
* **grid:** Potential fix for code scanning alert no. 6: Prototype-polluting assignment ([#9](https://github.com/OysteinAmundsen/toolbox/issues/9)) ([ca361ca](https://github.com/OysteinAmundsen/toolbox/commit/ca361ca93fbeaa74755f610efc2918dae8c28b75))
* **grid:** scroll bug when in datasets with less than 24 rows ([e49206f](https://github.com/OysteinAmundsen/toolbox/commit/e49206ffa986707e52400a7954a9d113bc08c853))
* **grid:** viewRenderer cells not updating on row data change ([e5aefde](https://github.com/OysteinAmundsen/toolbox/commit/e5aefde08e38efc3bff27e951b3edb42d57438f1))
* **keyboard:** Home/End key behavior with pinned columns ([e3e716c](https://github.com/OysteinAmundsen/toolbox/commit/e3e716c9870902b18c71681798770a6580d829a8))
* release please config ([87b25a9](https://github.com/OysteinAmundsen/toolbox/commit/87b25a9a866dc9c13918f19a1817046d6917c6c5))
* scrolling moves selection ([db11353](https://github.com/OysteinAmundsen/toolbox/commit/db11353af52ae3dd65e95505a034c2db68dcf5df))
* selection follows data during scroll, touch scrolling, sticky column drag ([e6aefa1](https://github.com/OysteinAmundsen/toolbox/commit/e6aefa103bf03454add13603f90a5f0f0d9c3702))
* **selection:** keyboard range selection ([aa1842b](https://github.com/OysteinAmundsen/toolbox/commit/aa1842b64485ff39a105469df822a7a2c6ca35b5))
* **selection:** Should not select cells when shift+tab'ing through the cells ([b87324f](https://github.com/OysteinAmundsen/toolbox/commit/b87324f79221a942ddab3250e53adea24b5db1df))
* test ([59c89d1](https://github.com/OysteinAmundsen/toolbox/commit/59c89d16603ffdfb44b00f23f9b8fa22afc6ba4a))


### Enhancements

* **docs:** added a demo page showcasing more complex grid examples ([0d1f147](https://github.com/OysteinAmundsen/toolbox/commit/0d1f147bb40dcf37e62ade6f91a89ba082ba0d51))
* **docs:** Enhanced demo page ([e61b8b8](https://github.com/OysteinAmundsen/toolbox/commit/e61b8b8cce852c52aba6889140a21c82eaf9a707))
* **docs:** Open stories in fullscreen ([b18a847](https://github.com/OysteinAmundsen/toolbox/commit/b18a84759dca6d0e9741f9408d5b43afcfef38c1))
* **grid:** add rowHeight configuration for virtualization and improve cell focus handling ([cdec8bb](https://github.com/OysteinAmundsen/toolbox/commit/cdec8bbf2bc45a0c4a4641e0e87b8cc64c9674ea))
* **grid:** added momentum scroll for touch devices ([9c9b994](https://github.com/OysteinAmundsen/toolbox/commit/9c9b9944ad783a67f79cb13b6ae6d0bd8915ad2e))
* **grid:** Cleaned up public facing api. Properly marked internal members ([6f03459](https://github.com/OysteinAmundsen/toolbox/commit/6f034592c606fcc1f480bec39823df6fbbc7d3b8))
* **grid:** implement async sorting and filtering handlers for server-side operations ([530a9b6](https://github.com/OysteinAmundsen/toolbox/commit/530a9b65090cc9bef53ddd9b78805be3b2b0f5e6))
* **grid:** Implement inter-plugin communication ([876ae8f](https://github.com/OysteinAmundsen/toolbox/commit/876ae8f11d51bc3750f6bc5edac92ec936d9c724))
* **groupingColumns:** Added a new gridConfig property to group columns by. ([e88d44e](https://github.com/OysteinAmundsen/toolbox/commit/e88d44eea25e8f6f2e806e72959bb44b9ca9a393))
* **keyboard:** enhance keyboard navigation with CTRL+Home/End functionality ([2ff50d4](https://github.com/OysteinAmundsen/toolbox/commit/2ff50d45b3a9ce240353b8ad39dd6e2111af0464))

## [0.2.8](https://github.com/OysteinAmundsen/toolbox/compare/v0.2.7...v0.2.8) (2026-01-05)


### Bug Fixes

* **grid:** scroll bug when in datasets with less than 24 rows ([e49206f](https://github.com/OysteinAmundsen/toolbox/commit/e49206ffa986707e52400a7954a9d113bc08c853))

## [0.2.7](https://github.com/OysteinAmundsen/toolbox/compare/v0.2.6...v0.2.7) (2026-01-04)


### Bug Fixes

* **grid:** added animation support ([66e056a](https://github.com/OysteinAmundsen/toolbox/commit/66e056a7929c3d3c449eb7216ade563eff05a42a))


### Enhancements

* **docs:** added svg logo and favicon ([2e25aea](https://github.com/OysteinAmundsen/toolbox/commit/2e25aeaa955ff421c2ce60b926e543b83e6536a1))
* **grid:** implement async sorting and filtering handlers for server-side operations ([530a9b6](https://github.com/OysteinAmundsen/toolbox/commit/530a9b65090cc9bef53ddd9b78805be3b2b0f5e6))

## [0.2.6](https://github.com/OysteinAmundsen/toolbox/compare/v0.2.5...v0.2.6) (2026-01-03)


### Bug Fixes

* **grid:** bugfixes for plugins so that the controls in the docs work as expected ([cb9ced0](https://github.com/OysteinAmundsen/toolbox/commit/cb9ced086f184f914a6d77371f76e46893d7893a))
* **selection:** keyboard range selection ([aa1842b](https://github.com/OysteinAmundsen/toolbox/commit/aa1842b64485ff39a105469df822a7a2c6ca35b5))


### Enhancements

* **grid:** added momentum scroll for touch devices ([9c9b994](https://github.com/OysteinAmundsen/toolbox/commit/9c9b9944ad783a67f79cb13b6ae6d0bd8915ad2e))

## [0.2.5](https://github.com/OysteinAmundsen/toolbox/compare/v0.2.4...v0.2.5) (2026-01-03)


### Bug Fixes

* **column:** resize broke after refactor. ([9f6ffae](https://github.com/OysteinAmundsen/toolbox/commit/9f6ffae40b42f92c74bcc1f17a1ae8778e8c94d3))
* **docs:** fix logo links and default initial page ([279969f](https://github.com/OysteinAmundsen/toolbox/commit/279969f4234754c3e78d6764785c5ec6be9466de))


### Enhancements

* **docs:** light-dark mode toggle ([da9b691](https://github.com/OysteinAmundsen/toolbox/commit/da9b6912176444846c8b863cd5941a76d1a66e97))
* **docs:** Open stories in fullscreen ([b18a847](https://github.com/OysteinAmundsen/toolbox/commit/b18a84759dca6d0e9741f9408d5b43afcfef38c1))

## [0.2.4](https://github.com/OysteinAmundsen/toolbox/compare/v0.2.3...v0.2.4) (2026-01-02)


### Enhancements

* **grid:** Cleaned up public facing api. Properly marked internal members ([6f03459](https://github.com/OysteinAmundsen/toolbox/commit/6f034592c606fcc1f480bec39823df6fbbc7d3b8))

## [0.2.3](https://github.com/OysteinAmundsen/toolbox/compare/v0.2.2...v0.2.3) (2026-01-01)


### Bug Fixes

* **keyboard:** Home/End key behavior with pinned columns ([e3e716c](https://github.com/OysteinAmundsen/toolbox/commit/e3e716c9870902b18c71681798770a6580d829a8))
* test ([59c89d1](https://github.com/OysteinAmundsen/toolbox/commit/59c89d16603ffdfb44b00f23f9b8fa22afc6ba4a))


### Enhancements

* **grid:** add rowHeight configuration for virtualization and improve cell focus handling ([cdec8bb](https://github.com/OysteinAmundsen/toolbox/commit/cdec8bbf2bc45a0c4a4641e0e87b8cc64c9674ea))
* **grid:** Implement inter-plugin communication ([876ae8f](https://github.com/OysteinAmundsen/toolbox/commit/876ae8f11d51bc3750f6bc5edac92ec936d9c724))
* **keyboard:** enhance keyboard navigation with CTRL+Home/End functionality ([2ff50d4](https://github.com/OysteinAmundsen/toolbox/commit/2ff50d45b3a9ce240353b8ad39dd6e2111af0464))

## [0.2.2](https://github.com/OysteinAmundsen/toolbox/compare/v0.2.1...v0.2.2) (2025-12-31)


### Bug Fixes

* **grid:** add version attribute for debugging ([#12](https://github.com/OysteinAmundsen/toolbox/issues/12)) ([d3a15e8](https://github.com/OysteinAmundsen/toolbox/commit/d3a15e855d15cca3e87570a0dcb61c904d45dd2c))
* **grid:** Potential fix for code scanning alert no. 6: Prototype-polluting assignment ([#9](https://github.com/OysteinAmundsen/toolbox/issues/9)) ([ca361ca](https://github.com/OysteinAmundsen/toolbox/commit/ca361ca93fbeaa74755f610efc2918dae8c28b75))

## [0.2.1](https://github.com/OysteinAmundsen/toolbox/compare/v0.2.0...v0.2.1) (2025-12-31)


### Bug Fixes

* **ci:** move npm publish to release-please, run tests on PRs only ([bc9a6b9](https://github.com/OysteinAmundsen/toolbox/commit/bc9a6b9662cadda72e5f0b5d60ae089fff942990))
* **ci:** run tests on release-please branch for status checks ([#6](https://github.com/OysteinAmundsen/toolbox/issues/6)) ([c93372c](https://github.com/OysteinAmundsen/toolbox/commit/c93372c9bd69eb4bad675acde0297634a5450359))

## [0.2.0](https://github.com/OysteinAmundsen/toolbox/compare/v0.1.2...v0.2.0) (2025-12-31)


### Features

* **grid:** unified resizable tool panel with accordion sections ([44e13b7](https://github.com/OysteinAmundsen/toolbox/commit/44e13b79e79c887fca595040469aa7c389a2ae10))


### Bug Fixes

* added storybook url to npm ([0561b97](https://github.com/OysteinAmundsen/toolbox/commit/0561b977f5420a036e791cc46630aca89c9be236))
* **grid:** all.ts re-exports full core API + document icons config ([69c7501](https://github.com/OysteinAmundsen/toolbox/commit/69c7501ac67a8cc70c5ac79dbb6f5ee7b38f293b))
* **grid:** ARIA compliance, keyboard nav, editing lifecycle, and virtualization ([7600fec](https://github.com/OysteinAmundsen/toolbox/commit/7600feca1994dd6730d383fbf2bcacee9d183c6a))
* **grid:** erroneous link ([08d747e](https://github.com/OysteinAmundsen/toolbox/commit/08d747e65f3dbc55b721a44d92afb4abdc53e853))
* **grid:** GridElement interface to include focusRow/focusCol properties ([#2](https://github.com/OysteinAmundsen/toolbox/issues/2)) ([a12a43f](https://github.com/OysteinAmundsen/toolbox/commit/a12a43fac53f687aadfc7c8e819c5d98a38d4b14))
* **grid:** linting error ([ffc68ce](https://github.com/OysteinAmundsen/toolbox/commit/ffc68cea3bdff74ec743198a5ac71a4a9a3149a3))
* **grid:** viewRenderer cells not updating on row data change ([e5aefde](https://github.com/OysteinAmundsen/toolbox/commit/e5aefde08e38efc3bff27e951b3edb42d57438f1))
* scrolling moves selection ([db11353](https://github.com/OysteinAmundsen/toolbox/commit/db11353af52ae3dd65e95505a034c2db68dcf5df))
* selection follows data during scroll, touch scrolling, sticky column drag ([e6aefa1](https://github.com/OysteinAmundsen/toolbox/commit/e6aefa103bf03454add13603f90a5f0f0d9c3702))
* storybook preview works on github pages ([cc9efed](https://github.com/OysteinAmundsen/toolbox/commit/cc9efed12c59a418614200514caa88149fe91629))

## 0.1.1 (2025-12-30)

### Bug Fixes

- **grid:** ARIA compliance, keyboard nav, editing lifecycle, and virtualization ([7600fec](https://github.com/OysteinAmundsen/toolbox/commit/7600feca1994dd6730d383fbf2bcacee9d183c6a))
- **grid:** erroneous link ([08d747e](https://github.com/OysteinAmundsen/toolbox/commit/08d747e65f3dbc55b721a44d92afb4abdc53e853))
- **grid:** linting error ([ffc68ce](https://github.com/OysteinAmundsen/toolbox/commit/ffc68cea3bdff74ec743198a5ac71a4a9a3149a3))

## 0.1.0 (2025-12-30)

### Features

- **grid:** unified resizable tool panel with accordion sections ([44e13b7](https://github.com/OysteinAmundsen/toolbox/commit/44e13b79e79c887fca595040469aa7c389a2ae10))

## 0.0.7 (2025-12-29)

### Bug Fixes

- added storybook url to npm ([0561b97](https://github.com/OysteinAmundsen/toolbox/commit/0561b977f5420a036e791cc46630aca89c9be236))
- **grid:** all.ts re-exports full core API + document icons config ([69c7501](https://github.com/OysteinAmundsen/toolbox/commit/69c7501ac67a8cc70c5ac79dbb6f5ee7b38f293b))
- **grid:** viewRenderer cells not updating on row data change ([e5aefde](https://github.com/OysteinAmundsen/toolbox/commit/e5aefde08e38efc3bff27e951b3edb42d57438f1))
- scrolling moves selection ([db11353](https://github.com/OysteinAmundsen/toolbox/commit/db11353af52ae3dd65e95505a034c2db68dcf5df))
- selection follows data during scroll, touch scrolling, sticky column drag ([e6aefa1](https://github.com/OysteinAmundsen/toolbox/commit/e6aefa103bf03454add13603f90a5f0f0d9c3702))
- storybook preview works on github pages ([cc9efed](https://github.com/OysteinAmundsen/toolbox/commit/cc9efed12c59a418614200514caa88149fe91629))
