# Changelog

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
