# Changelog

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
