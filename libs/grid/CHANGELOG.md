# Changelog

## [1.31.2](https://github.com/OysteinAmundsen/toolbox/compare/grid-1.31.1...grid-1.31.2) (2026-04-13)


### Bug Fixes

* **grid:** preserve grid DOM during shell refresh to retain event listeners ([c53a12e](https://github.com/OysteinAmundsen/toolbox/commit/c53a12e14299b7634c46361e663bffa417f2fa04))

## [1.31.1](https://github.com/OysteinAmundsen/toolbox/compare/grid-1.31.0...grid-1.31.1) (2026-04-13)


### Bug Fixes

* **grid:** anchor filter panel to filter button instead of header cell ([c87b73b](https://github.com/OysteinAmundsen/toolbox/commit/c87b73b1ce3732c583bee4dc8ee283cab11c326c))
* **grid:** sort set filter values numerically for number columns ([#205](https://github.com/OysteinAmundsen/toolbox/issues/205)) ([0f616a5](https://github.com/OysteinAmundsen/toolbox/commit/0f616a5cf2b6c6b8ffb790afcd5c631c5581b498))

## [1.31.0](https://github.com/OysteinAmundsen/toolbox/compare/grid-1.30.3...grid-1.31.0) (2026-04-11)


### Features

* **grid:** add CSS-first icon system with hybrid JS override ([#185](https://github.com/OysteinAmundsen/toolbox/issues/185)) ([3f63636](https://github.com/OysteinAmundsen/toolbox/commit/3f636365b6bc99c921b6e8ff2105842aed4cbffe))


### Bug Fixes

* **grid:** added missing pivot column sorting via header click ([#183](https://github.com/OysteinAmundsen/toolbox/issues/183)) ([#184](https://github.com/OysteinAmundsen/toolbox/issues/184)) ([7ec66c0](https://github.com/OysteinAmundsen/toolbox/commit/7ec66c072d10d7fefae6394b43a2fb11161dc1b8))
* **grid:** apply value formatting in pivot rendering, fix grand total in row model ([de0eb2e](https://github.com/OysteinAmundsen/toolbox/commit/de0eb2e001e2e3db02f7963c4f0b420fdc8fa3be))
* **grid:** stabilize row height when entering edit mode ([ccf2a5e](https://github.com/OysteinAmundsen/toolbox/commit/ccf2a5eac88e57a1f0313527e6b18441c4f02d1a))


### Enhancements

* **grid:** enhance pivot plugin with events, custom aggregators, sorting, and formatting ([a70304b](https://github.com/OysteinAmundsen/toolbox/commit/a70304b4ecda0effcdb5e30c03cf5b00d4729489))


### Performance Improvements

* **grid:** eliminate collectRows post-pass in grouping-rows tree build ([e215913](https://github.com/OysteinAmundsen/toolbox/commit/e215913337dcd9ae7e4fa0d25292a4633908d488))

## [1.30.3](https://github.com/OysteinAmundsen/toolbox/compare/grid-1.30.2...grid-1.30.3) (2026-04-11)


### Bug Fixes

* **grid:** correct row count for multi-level group headers ([#179](https://github.com/OysteinAmundsen/toolbox/issues/179)) ([#181](https://github.com/OysteinAmundsen/toolbox/issues/181)) ([0af8672](https://github.com/OysteinAmundsen/toolbox/commit/0af8672abf9981900ff2885218c499a5ae9e7ad9))
* **grid:** eliminate socket.dev security warnings from published bundle ([022b052](https://github.com/OysteinAmundsen/toolbox/commit/022b052d9bef4046a8faa7286d2e3ab25de56ac4))

## [1.30.2](https://github.com/OysteinAmundsen/toolbox/compare/grid-1.30.1...grid-1.30.2) (2026-04-09)


### Bug Fixes

* **grid:** add missing filterType augmented column option ([907ff39](https://github.com/OysteinAmundsen/toolbox/commit/907ff3962f7ed70ef3e3c27e11f4304cac67397e))

## [1.30.1](https://github.com/OysteinAmundsen/toolbox/compare/grid-1.30.0...grid-1.30.1) (2026-04-08)


### Bug Fixes

* **grid:** capture abort signal eagerly to prevent listener leak in filter panel ([e7d23a6](https://github.com/OysteinAmundsen/toolbox/commit/e7d23a68ebd7372217849eb216abf224bcf1cff4))

## [1.30.0](https://github.com/OysteinAmundsen/toolbox/compare/grid-1.29.0...grid-1.30.0) (2026-04-08)


### Features

* **grid:** split explicit column group headers at pin boundaries ([252083f](https://github.com/OysteinAmundsen/toolbox/commit/252083fc5764502b7257646a165bb5efa8265e63))


### Bug Fixes

* **grid:** column reorder visual update and FLIP animation direction ([c2e73e4](https://github.com/OysteinAmundsen/toolbox/commit/c2e73e4ed940eab69e89d3100b8233f694787ae6))
* **grid:** sticky positioning and group-end adjustments for better cell rendering during scroll ([d4f884b](https://github.com/OysteinAmundsen/toolbox/commit/d4f884bf63d9f4a3122d8336fa34d2d3da26e8f0))


### Performance Improvements

* **grid:** replace ES6+ loop patterns with indexed for loops in hot paths ([7806c58](https://github.com/OysteinAmundsen/toolbox/commit/7806c58ada7a75fd1cdd7cfc3514a57aabf1d455))
* **grid:** revert NodeList/native C++ optimizations that hurt speed ([e9cfe31](https://github.com/OysteinAmundsen/toolbox/commit/e9cfe3199903a57fa0c2cef74d813bdcfeeca8f7))

## [1.29.0](https://github.com/OysteinAmundsen/toolbox/compare/grid-1.28.2...grid-1.29.0) (2026-04-05)


### Features

* **grid:** add public sort() API for programmatic single-column sorting ([a5a475c](https://github.com/OysteinAmundsen/toolbox/commit/a5a475cf2e290d3a72451842bf7f3e7eb59ecd7b))


### Bug Fixes

* **grid-vue,grid-react:** close adapter API parity gaps ([3ff3e9a](https://github.com/OysteinAmundsen/toolbox/commit/3ff3e9a8ae0d9e03bfa4ef73f6637a344f4c7a02))
* **grid:** prevent stale velocity from causing scroll after touch hold ([92dca5f](https://github.com/OysteinAmundsen/toolbox/commit/92dca5f292ed06db656fe5ffa886c2b3ad7d3aeb))
* **grid:** prevent sticky hover highlight on touch devices during scroll ([82256fe](https://github.com/OysteinAmundsen/toolbox/commit/82256fe005830599f214bc25e377c96251226a6e))


### Performance Improvements

* **grid, docs:** fair benchmark methodology and forceLayout optimization ([81ccda3](https://github.com/OysteinAmundsen/toolbox/commit/81ccda36ae878fc3d1f4eaa13650886765421604))
* **grid, docs:** optimize filter/sort pipeline and improve benchmark methodology ([6f6f574](https://github.com/OysteinAmundsen/toolbox/commit/6f6f574b16488a45c335c4559e8df5cfae20837d))
* **grid:** column resize O(1) fast path + multiSort in-place sort ([7aeb192](https://github.com/OysteinAmundsen/toolbox/commit/7aeb192a4f710a525a81a8f185e2ece853ce7726))
* **grid:** in-place sort for internal paths, eliminating O(n) array copy ([8b87261](https://github.com/OysteinAmundsen/toolbox/commit/8b872610a986fffe25b4ac6122c2cf6a66dbf0df))
* **grid:** optimize filtering hot path with compiled predicates ([6b5287a](https://github.com/OysteinAmundsen/toolbox/commit/6b5287a0516ae76e19f40535d5b5b16530308de7))

## [1.28.2](https://github.com/OysteinAmundsen/toolbox/compare/grid-1.28.1...grid-1.28.2) (2026-03-29)


### Bug Fixes

* **grid:** add type anchors to feature modules for bundler compatibility ([721e610](https://github.com/OysteinAmundsen/toolbox/commit/721e610482fd4575eab6d37260e1606f1fa76a58))
* **grid:** make FeatureConfig reject unknown feature keys via sentinel type ([19e4428](https://github.com/OysteinAmundsen/toolbox/commit/19e4428917418c140e61a08c27e5f9181ebd042f))

## [1.28.1](https://github.com/OysteinAmundsen/toolbox/compare/grid-1.28.0...grid-1.28.1) (2026-03-26)


### Bug Fixes

* **grid,grid-angular:** release editor components before re-render to prevent overlay leaks ([a7b1315](https://github.com/OysteinAmundsen/toolbox/commit/a7b1315d4342d573c158eb2e97b63c89a3e22b8f))
* **grid:** release editor DOM in fastPatchRow standard path before overwriting cell content ([a91dc30](https://github.com/OysteinAmundsen/toolbox/commit/a91dc30bd6da0959d4b20b0fc4eeb4eb0fb25e7a))


### Enhancements

* **grid:** clipboard copy-what-you-see using column format and DOM text ([4798cab](https://github.com/OysteinAmundsen/toolbox/commit/4798caba5c0d4b1209b9bf86f6416fa0b0703af8))

## [1.28.0](https://github.com/OysteinAmundsen/toolbox/compare/grid-1.27.2...grid-1.28.0) (2026-03-26)


### Features

* **grid:** add TooltipPlugin with popover-based overflow tooltips ([61fc11c](https://github.com/OysteinAmundsen/toolbox/commit/61fc11c1b755b8eabbd019e37901e2a84ee8bf8a))


### Bug Fixes

* **grid:** sanitize icon HTML to prevent XSS via innerHTML ([7c5a8e8](https://github.com/OysteinAmundsen/toolbox/commit/7c5a8e8799f2b71f57865e22c9888ff28fcc5715))

## [1.27.2](https://github.com/OysteinAmundsen/toolbox/compare/grid-1.27.1...grid-1.27.2) (2026-03-25)


### Bug Fixes

* **grid:** recompute excludedValues for `in` filters when source data changes ([edf50e9](https://github.com/OysteinAmundsen/toolbox/commit/edf50e93be9a5e135983a9fbae5af613dcfb88af))


### Enhancements

* **grid:** add filtering UX helpers — stale detection, set helpers, data ranges, blank toggle ([#166](https://github.com/OysteinAmundsen/toolbox/issues/166), [#167](https://github.com/OysteinAmundsen/toolbox/issues/167), [#168](https://github.com/OysteinAmundsen/toolbox/issues/168), [#169](https://github.com/OysteinAmundsen/toolbox/issues/169)) ([b5452a8](https://github.com/OysteinAmundsen/toolbox/commit/b5452a8d04eb73caa96216004c1e50ae7c155309))

## [1.27.1](https://github.com/OysteinAmundsen/toolbox/compare/grid-1.27.0...grid-1.27.1) (2026-03-23)


### Bug Fixes

* **grid:** fix custom elements manifest for webcomponents.org compatibility ([194ed8f](https://github.com/OysteinAmundsen/toolbox/commit/194ed8f7dc1a3e95c93e65b79ca0dbfdf7759005))

## [1.27.0](https://github.com/OysteinAmundsen/toolbox/compare/grid-1.26.2...grid-1.27.0) (2026-03-22)


### Features

* **grid:** enable master-detail and row-grouping plugins to work together ([ea5461d](https://github.com/OysteinAmundsen/toolbox/commit/ea5461d97e1e4af8e90daa0f05eed6d3279ae710))
* **grid:** fragment column groups when columns are reordered across boundaries ([4b91a77](https://github.com/OysteinAmundsen/toolbox/commit/4b91a770e487176a15b4101546e2f04ede73e37e))
* **grid:** make PinnedColumnsPlugin and GroupingColumnsPlugin compatible ([d6a30e4](https://github.com/OysteinAmundsen/toolbox/commit/d6a30e4f66a37268888d7e60e091296d01f85c68))
* **grid:** support overlay label in per-column aggregation rows ([ea5e3b3](https://github.com/OysteinAmundsen/toolbox/commit/ea5e3b3e6631e50058bde54a15186a18c758a614))


### Bug Fixes

* **grid:** declare incompatible plugin combinations for row-model and server-side plugins ([c46bc30](https://github.com/OysteinAmundsen/toolbox/commit/c46bc30ea1ff00737fc524cf39a871cfafbb3af3))
* **grid:** downgrade TBW021 optional dependency diagnostic to console.debug ([ecef0cd](https://github.com/OysteinAmundsen/toolbox/commit/ecef0cd392d7ca7a058ecb5fdf66ec010a363eb9))
* **grid:** fix aggregation cell alignment shift from sticky label grid placement ([360a853](https://github.com/OysteinAmundsen/toolbox/commit/360a853893c92cebfd1221ba0854598a491b6a26))
* **grid:** pin column group headers and fix group-end borders at pin boundaries ([437eb54](https://github.com/OysteinAmundsen/toolbox/commit/437eb54587688ef7195c2e9b8e62a9a336f053b4))
* **grid:** pin column group headers with their pinned columns ([4e3e7b1](https://github.com/OysteinAmundsen/toolbox/commit/4e3e7b1f54dae8876c6e4096637fb9bc8c466571))
* **grid:** prevent data columns from being absorbed into adjacent group headers ([dadbf56](https://github.com/OysteinAmundsen/toolbox/commit/dadbf56287ef1ac95ba6c6faf3c79fe26ee763fd))
* **grid:** recalculate virtual scroll height when theme changes row height ([e833ac4](https://github.com/OysteinAmundsen/toolbox/commit/e833ac432baf14e4aa37688a761b79d26946e95b))
* **grid:** remove stale responsive/groupingRows incompatibility — variable row heights now supported ([7e1c13f](https://github.com/OysteinAmundsen/toolbox/commit/7e1c13fa880bde390bdad315d2aa95906f8ceb4b))
* **grid:** replace unreliable children[0] with querySelector in plugins ([a4b6fff](https://github.com/OysteinAmundsen/toolbox/commit/a4b6fff7d24902f8f56ea5df11f16c8214806ab8))
* **grid:** separate resize handle hit area from visual width and freeze columns during resize ([a80088e](https://github.com/OysteinAmundsen/toolbox/commit/a80088e704b21050e112c83366181ddd1162ad3d))
* **grid:** support group header drag in grid and fragment-aware visibility panel ([f1d2d1c](https://github.com/OysteinAmundsen/toolbox/commit/f1d2d1c344a1e6ab45e58aa7e1ba45740870a2d8))

## [1.26.2](https://github.com/OysteinAmundsen/toolbox/compare/grid-1.26.1...grid-1.26.2) (2026-03-20)


### Bug Fixes

* **grid:** recalculate scroll height when entering CSS-only responsive card mode ([8d9f9b2](https://github.com/OysteinAmundsen/toolbox/commit/8d9f9b2161b51313228fdb4b97bcffb0cc5109e5))

## [1.26.1](https://github.com/OysteinAmundsen/toolbox/compare/grid-1.26.0...grid-1.26.1) (2026-03-19)


### Bug Fixes

* **grid:** apply per-row --tbw-row-height override for variable-height mode ([4e595da](https://github.com/OysteinAmundsen/toolbox/commit/4e595da1176dc87846d2120fe0f73e109ac7aae0))
* **grid:** clean up changedRowIds on revert when dirtyTracking is disabled ([2ff51b3](https://github.com/OysteinAmundsen/toolbox/commit/2ff51b30e56f4e1884df2c702d84cfda88162943))
* **grid:** prefer click target when focusing in editor ([3c956a0](https://github.com/OysteinAmundsen/toolbox/commit/3c956a06cec8861c95915092068ca6e2a5bd932a))
* **grid:** re-evaluate per-cell editability on row recycle in grid edit mode ([5c55ddd](https://github.com/OysteinAmundsen/toolbox/commit/5c55dddaddb9b3e75408b2c662f9d1ffc4669526))
* **grid:** rectify variable row height and editor non-primitive handling ([66b780d](https://github.com/OysteinAmundsen/toolbox/commit/66b780d4c48e041f389d5171c7ba840ebfeccf2c))
* **grid:** skip non-primitive values in template editor auto-update ([f8d6d5d](https://github.com/OysteinAmundsen/toolbox/commit/f8d6d5df1ca62fda68792ac3a24ba3caabbe4511))
* **grid:** skip wheel intercept when native select picker is open ([1d35f3a](https://github.com/OysteinAmundsen/toolbox/commit/1d35f3ab419a9a03524f812bedded1c8cb10dd86))


### Enhancements

* **grid:** sort filter panel items with selected first ([933c746](https://github.com/OysteinAmundsen/toolbox/commit/933c746741d7aacd471cae98c4a9abe3d156d41e))

## [1.26.0](https://github.com/OysteinAmundsen/toolbox/compare/grid-1.25.2...grid-1.26.0) (2026-03-17)


### Features

* **grid:** add conditional editing via editable function and rowEditable ([a5c814e](https://github.com/OysteinAmundsen/toolbox/commit/a5c814e7e86d6470fc0829028521135c7fe4dd70))


### Bug Fixes

* **grid:** support Shift+keyboard selection in row mode ([44f2da4](https://github.com/OysteinAmundsen/toolbox/commit/44f2da421cc406d2e54793e6db73d2f68b052b3d))

## [1.25.2](https://github.com/OysteinAmundsen/toolbox/compare/grid-1.25.1...grid-1.25.2) (2026-03-17)


### Bug Fixes

* **grid,grid-react,grid-vue:** plug memory leaks in adapters, cache, and global handlers ([c69c86d](https://github.com/OysteinAmundsen/toolbox/commit/c69c86d1a93d2653a45832c28021a40e5b1563c8))
* **grid:** inline diagnostics into plugin bundles and add doc cross-links to errors.mdx ([348ecd5](https://github.com/OysteinAmundsen/toolbox/commit/348ecd5cd5a12458828008188ec19dd5fcb4f277))


### Performance Improvements

* **grid:** cache hook checks, eliminate allocations in hot paths, O(1) row lookup ([7b3e2d8](https://github.com/OysteinAmundsen/toolbox/commit/7b3e2d896db68d0a45779bfd0b2b5b3090b3410d))

## [1.25.1](https://github.com/OysteinAmundsen/toolbox/compare/grid-1.25.0...grid-1.25.1) (2026-03-16)


### Bug Fixes

* lint error ([7afaf44](https://github.com/OysteinAmundsen/toolbox/commit/7afaf4407d40a092df865bc8fa3d5be17ecada05))


### Enhancements

* **grid,grid-react,grid-vue,grid-angular:** allow columnGroups and per-group renderer in plugin config ([91960a9](https://github.com/OysteinAmundsen/toolbox/commit/91960a9ae1c5920abcc5ceed30f3c5f94a19ca3e))

## [1.25.0](https://github.com/OysteinAmundsen/toolbox/compare/grid-1.24.2...grid-1.25.0) (2026-03-15)


### Features

* **grid:** add async overloads to queryGrid for safe post-upgrade access ([ad1de81](https://github.com/OysteinAmundsen/toolbox/commit/ad1de8126d794afd51b352e398ba502d85e1bac8))
* **grid:** add keyboard navigation to context menu plugin ([a0a089a](https://github.com/OysteinAmundsen/toolbox/commit/a0a089a92ecab980a219ba2284cd7ada34be6060))
* **grid:** implement missing ARIA accessibility features ([2de584e](https://github.com/OysteinAmundsen/toolbox/commit/2de584eb425bf9138b951d9a1cc4b08ebdb0398c))
* **grid:** include grid element ID in validation error messages ([4491460](https://github.com/OysteinAmundsen/toolbox/commit/4491460614278e69d1fd50e445efa89714fe6df2))


### Bug Fixes

* **grid:** bundle core/internal utils into plugins instead of externalizing ([2800011](https://github.com/OysteinAmundsen/toolbox/commit/2800011976aeaa6330c927892d4aa63d8912731d))
* **grid:** fix touch scroll + responsive card height alignment ([b39b035](https://github.com/OysteinAmundsen/toolbox/commit/b39b035b74df0647c749dd953e374eba53172501))
* **grid:** narrow externalizeCore exclusion to core/internal/utils only ([c57d52e](https://github.com/OysteinAmundsen/toolbox/commit/c57d52e7d186b3ccb3e815456e77c5a82a3c0080))
* **grid:** normalize string returns in rowClass/cellClass callbacks ([1057db8](https://github.com/OysteinAmundsen/toolbox/commit/1057db8fe467db3c74b17c517899a1cf51e033aa))
* **grid:** preserve API-registered header content across config rebuilds ([754dc7b](https://github.com/OysteinAmundsen/toolbox/commit/754dc7b42dacf6c533aea57e49287e16047c1431))
* **grid:** preserve open panel content across full shell re-renders ([bbdec39](https://github.com/OysteinAmundsen/toolbox/commit/bbdec39015414a7c52aedd61d72626c3525129e4))
* **grid:** prevent browser from hijacking touch scroll gestures on mobile ([6db4262](https://github.com/OysteinAmundsen/toolbox/commit/6db42621fecbae1d89303e224722cd09eccfb6a7))
* **grid:** re-render shell when tool panel position changes ([bb47b62](https://github.com/OysteinAmundsen/toolbox/commit/bb47b629789d03629aaf571150a235f26deec8c0))
* **grid:** restore tool panel content after shell refresh and fix z-index stacking ([2d9bdc7](https://github.com/OysteinAmundsen/toolbox/commit/2d9bdc74102c0265119472ac7e1ace9dc00fa19b))
* **grid:** use single chevron icon with CSS rotation for accordion animation ([1713217](https://github.com/OysteinAmundsen/toolbox/commit/1713217b182e7ad765ade47dabd95a5b1f960afe))


### Enhancements

* **grid-angular:** migrate addEventListener to .on() API ([0592112](https://github.com/OysteinAmundsen/toolbox/commit/059211291721f450ba51c4a9bd8699297cc0866b))
* **grid-react:** migrate addEventListener to .on() API ([24ff2b2](https://github.com/OysteinAmundsen/toolbox/commit/24ff2b21dad39cc03f648e8365be5c4634190b6e))
* **grid:** add data-change event for row data notifications ([b94c4bc](https://github.com/OysteinAmundsen/toolbox/commit/b94c4bc971097fa66e5dfd7902a9d6842ddee413))

## [1.24.2](https://github.com/OysteinAmundsen/toolbox/compare/grid-1.24.1...grid-1.24.2) (2026-03-14)


### Bug Fixes

* **grid:** close context menu on scroll and ensure cross-grid exclusivity ([135e20c](https://github.com/OysteinAmundsen/toolbox/commit/135e20c74799e6ba404b640b5a08ff055aeb98dd))
* **grid:** fix column reorder FLIP animation with async row rendering ([f106993](https://github.com/OysteinAmundsen/toolbox/commit/f1069939138af08bdb2377d0091fdc52e87a2150))
* **grid:** implement groupHeaderRenderer config (was dead API surface) ([0fa419c](https://github.com/OysteinAmundsen/toolbox/commit/0fa419c9b2d14909386d0bdd10fae7c33ae7b2e7))

## [1.24.1](https://github.com/OysteinAmundsen/toolbox/compare/grid-1.24.0...grid-1.24.1) (2026-03-13)


### Bug Fixes

* **docs:** fix responsive manual control demo — get plugin lazily in click handlers ([1038d67](https://github.com/OysteinAmundsen/toolbox/commit/1038d6782e2a840d1b4fb23b7b3e9b890b4dc26f))
* **grid:** fix row reorder drag handles blocked by mousedown preventDefault ([177c075](https://github.com/OysteinAmundsen/toolbox/commit/177c0750ee9c3822caa0a9a0bd3fdd552398996c))
* **grid:** prevent row height oscillation from mixed-height content ([24ac596](https://github.com/OysteinAmundsen/toolbox/commit/24ac596f870a64c546cf7915d563229d97ca2fe4))

## [1.24.0](https://github.com/OysteinAmundsen/toolbox/compare/grid-1.23.4...grid-1.24.0) (2026-03-12)


### Features

* **grid:** add declarative features API for plugin configuration ([94fa3b4](https://github.com/OysteinAmundsen/toolbox/commit/94fa3b4fcfafb80f562d3458f369bfe9c5763b17))

## [1.23.4](https://github.com/OysteinAmundsen/toolbox/compare/grid-1.23.3...grid-1.23.4) (2026-03-11)


### Bug Fixes

* **docs:** remove duplicate h1 headers from all pages ([ae24f73](https://github.com/OysteinAmundsen/toolbox/commit/ae24f73a2399551f2812ee8b6d65ba3dcf943357))
* **grid-angular:** use getPluginByName in adapter features ([acfb512](https://github.com/OysteinAmundsen/toolbox/commit/acfb5128d324ef9abed16902d609d25da99df0cb))
* **grid-react:** use getPluginByName in adapter features ([69d00bf](https://github.com/OysteinAmundsen/toolbox/commit/69d00bf7399e0b30f6fc5c54986482d9bc2ab52f))
* **grid-vue:** use getPluginByName in adapter features and composable ([f51808b](https://github.com/OysteinAmundsen/toolbox/commit/f51808bc9aa8b021cb30c07b675c7475c3e714f5))
* **grid:** recommend getPluginByName over getPlugin in docs and examples ([042b58b](https://github.com/OysteinAmundsen/toolbox/commit/042b58b2e429dc9cb7f4f278cbdd206d72b30ca3))

## [1.23.3](https://github.com/OysteinAmundsen/toolbox/compare/grid-1.23.2...grid-1.23.3) (2026-03-08)


### Bug Fixes

* **grid:** column group header spans over interleaved utility columns ([49c5b59](https://github.com/OysteinAmundsen/toolbox/commit/49c5b592cf445338b8c96b6076e8266cab4bffc1))
* **grid:** hidden columns CSS specificity in responsive card mode ([f759d32](https://github.com/OysteinAmundsen/toolbox/commit/f759d32cd93f12773d91241afef1a415e57a33fb))
* **grid:** import FOCUSABLE_EDITOR_SELECTOR locally in editing plugin ([007cfc2](https://github.com/OysteinAmundsen/toolbox/commit/007cfc293d86eeeea228a3f1df61c3d136c26d29))

## [1.23.2](https://github.com/OysteinAmundsen/toolbox/compare/grid-1.23.1...grid-1.23.2) (2026-03-03)


### Bug Fixes

* **grid:** Prevent focus recursion in editing plugin ([3485802](https://github.com/OysteinAmundsen/toolbox/commit/3485802c101401b28e759cfeab647e9ed84689b6))
* **grid:** recognize grid edit mode in ensureCellVisible focus logic ([23fad26](https://github.com/OysteinAmundsen/toolbox/commit/23fad263d2dcf92194b7b2dc9f2c9171682c6035))
* **grid:** revert cell value on Escape in grid editing mode ([ce1fc3c](https://github.com/OysteinAmundsen/toolbox/commit/ce1fc3c6ba35f5afe4984aa45667943e82a639fb))
* **grid:** support in operator in filter panel excludedValues ([8641e92](https://github.com/OysteinAmundsen/toolbox/commit/8641e92cbc56143575f15a39fcfb4f1c3fe7cbaa))

## [1.23.1](https://github.com/OysteinAmundsen/toolbox/compare/grid-1.23.0...grid-1.23.1) (2026-03-02)


### Bug Fixes

* **grid:** make filter column-state integration consistent via trackColumnState ([7d9e067](https://github.com/OysteinAmundsen/toolbox/commit/7d9e0670175593edf80da11c02f9f5d7dbad2df6))

## [1.23.0](https://github.com/OysteinAmundsen/toolbox/compare/grid-1.22.1...grid-1.23.0) (2026-02-27)


### Features

* **grid:** add nullable column config for editing plugin ([af1af5e](https://github.com/OysteinAmundsen/toolbox/commit/af1af5e0447fbbc04b22f160b83d7fbf7c0fb4d0))
* **grid:** add tbw-row-dirty/tbw-row-new CSS classes for dirty tracking ([bb5f653](https://github.com/OysteinAmundsen/toolbox/commit/bb5f653297ca304793f39c83091eddeec2afa16b))
* **grid:** add transaction API to UndoRedoPlugin for compound undo/redo ([b9d4132](https://github.com/OysteinAmundsen/toolbox/commit/b9d41326344969f8ba27542685833da5af8b5694))
* **grid:** auto-mark inserted rows as new in dirty tracking ([7b9d130](https://github.com/OysteinAmundsen/toolbox/commit/7b9d1302088d90a2bdfa07cf328166658fdab040))
* **grid:** expose baseline API on EditingPlugin (hasBaseline, baselines-captured event) ([d91a59f](https://github.com/OysteinAmundsen/toolbox/commit/d91a59f3be8f0ed566e38cb5cfa7de0f61525645))
* **grid:** implement dirty tracking in EditingPlugin ([ccb7756](https://github.com/OysteinAmundsen/toolbox/commit/ccb77568f6e6ae7127769b03f219f86218d15225))


### Bug Fixes

* **grid, grid-angular:** preserve focus on undo/redo and notify editors of external value changes ([596442a](https://github.com/OysteinAmundsen/toolbox/commit/596442ad2e7a137c2e6c6e35dbfa274ff372c80a))
* **grid:** mark adapter editors as managed when factory returns void ([e900a2d](https://github.com/OysteinAmundsen/toolbox/commit/e900a2d8a78ca41e16f6cc13696ad648dfb2edc6))
* **grid:** prevent updateRow from re-sorting on insertRow ([cf292a7](https://github.com/OysteinAmundsen/toolbox/commit/cf292a7088a1b3fce2452fcdb75ed10e7409ff84))
* **grid:** undo/redo during active editing — preventDefault, suppress feedback, focus cell ([3170b57](https://github.com/OysteinAmundsen/toolbox/commit/3170b57900fe8c8fab28f324dcda1546ea6ca5db))
* **grid:** use deep comparison for dirty tracking baselines ([56eef98](https://github.com/OysteinAmundsen/toolbox/commit/56eef98270befd2a87fc5e114103d3aeacc2bb32))
* **grid:** use updateRow in UndoRedoPlugin for active editor sync ([1e2d537](https://github.com/OysteinAmundsen/toolbox/commit/1e2d5372a4dbd2d0cecb84aa6768175ffe953150))

## [1.22.1](https://github.com/OysteinAmundsen/toolbox/compare/grid-1.22.0...grid-1.22.1) (2026-02-25)


### Bug Fixes

* **grid:** click-outside commit regression from containsFocus check ([addb4dc](https://github.com/OysteinAmundsen/toolbox/commit/addb4dca5085035eec6834dc70b64761ed346754))

## [1.22.0](https://github.com/OysteinAmundsen/toolbox/compare/grid-1.21.2...grid-1.22.0) (2026-02-25)


### Features

* **grid:** add external focus container registry and focusTrap option ([66cb973](https://github.com/OysteinAmundsen/toolbox/commit/66cb9732d8450a864bac570f9baa833aeff3f342))
* **grid:** make getPluginByName type-safe and preferred plugin access method ([a69afef](https://github.com/OysteinAmundsen/toolbox/commit/a69afef45c5ccdf976e5d4c3286bd36f7d402cc4))


### Bug Fixes

* **grid,grid-angular:** stabilize overlay editor lifecycle during resize-triggered re-renders ([e1da999](https://github.com/OysteinAmundsen/toolbox/commit/e1da99942d0d5b9b72e5bbabea58200db1e3e97d))

## [1.21.2](https://github.com/OysteinAmundsen/toolbox/compare/grid-1.21.1...grid-1.21.2) (2026-02-24)


### Bug Fixes

* **grid,grid-angular:** flush managed editors before clearing edit state ([#142](https://github.com/OysteinAmundsen/toolbox/issues/142)) ([52b74e6](https://github.com/OysteinAmundsen/toolbox/commit/52b74e6700a28b95c108de2b9e2949a048eba06e))
* **grid:** include blank rows in set-filter panel for all columns ([a607259](https://github.com/OysteinAmundsen/toolbox/commit/a607259deb8566c6c11b0b5e0e943c8f773f5432))


### Enhancements

* **grid:** add optional valueTo parameter to applySetFilter for metadata passthrough ([5980e7a](https://github.com/OysteinAmundsen/toolbox/commit/5980e7a1bd7ddd83b13e6f0cc2ae6c85f8bf872f))
* **grid:** offer `currentFilter` property to custom filterPanelRenderers so that they can pre-set values to currently set filters ([3b407b5](https://github.com/OysteinAmundsen/toolbox/commit/3b407b5e16e15604f5ef6729c6f6eb28587b4790))


### Performance Improvements

* **grid:** switch to terser minification, strip CSS comment from bundle ([89f1131](https://github.com/OysteinAmundsen/toolbox/commit/89f1131cb67a8be87ebd20d8322e6b2c58105447))

## [1.21.1](https://github.com/OysteinAmundsen/toolbox/compare/grid-1.21.0...grid-1.21.1) (2026-02-24)


### Bug Fixes

* **grid:** correct sideEffects paths to match published package structure ([c62c2f7](https://github.com/OysteinAmundsen/toolbox/commit/c62c2f713decd56a221fe683dcab6beacb416273))

## [1.21.0](https://github.com/OysteinAmundsen/toolbox/compare/grid-1.20.0...grid-1.21.0) (2026-02-23)


### Features

* **grid:** auto-animate insertRow/removeRow, return Promises from animateRow ([19980c8](https://github.com/OysteinAmundsen/toolbox/commit/19980c844fe367d9d91d68f03481a8545bc31d45))


### Bug Fixes

* **grid:** clear stale core _sortState when MultiSortPlugin owns sorting ([4022d79](https://github.com/OysteinAmundsen/toolbox/commit/4022d79b094c6c0a558bd41e421a7138bb61254d))

## [1.20.0](https://github.com/OysteinAmundsen/toolbox/compare/grid-1.19.3...grid-1.20.0) (2026-02-23)


### Features

* **grid:** add suspendProcessing() API and restore core sort in rebuildRowModel ([0fede1f](https://github.com/OysteinAmundsen/toolbox/commit/0fede1f50ad346d5761cf2c6030e4d8c3979ffff))


### Bug Fixes

* **grid:** use visible-column index when resolving columns from data-col ([1034a8a](https://github.com/OysteinAmundsen/toolbox/commit/1034a8a84d0eb9558ac5d1e410f37666589ac38c))

## [1.19.3](https://github.com/OysteinAmundsen/toolbox/compare/grid-1.19.2...grid-1.19.3) (2026-02-22)


### Bug Fixes

* **grid,grid-angular,grid-react,grid-vue:** add typesVersions for Jest/CommonJS type resolution ([#137](https://github.com/OysteinAmundsen/toolbox/issues/137)) ([cfdf327](https://github.com/OysteinAmundsen/toolbox/commit/cfdf3271916225926d27842569c0dbfdb0fb986c))

## [1.19.2](https://github.com/OysteinAmundsen/toolbox/compare/grid-1.19.1...grid-1.19.2) (2026-02-21)


### Bug Fixes

* **grid:** plug memory leaks in framework adapter lifecycle ([0612c88](https://github.com/OysteinAmundsen/toolbox/commit/0612c8820441fd73caf725cff75dd68422eceedf))


### Performance Improvements

* **grid:** avoid destroying framework renderers on rows-only updates ([c233dc7](https://github.com/OysteinAmundsen/toolbox/commit/c233dc776dc7114b124373dc16df7f441d156665))

## [1.19.1](https://github.com/OysteinAmundsen/toolbox/compare/grid-1.19.0...grid-1.19.1) (2026-02-20)


### Enhancements

* **grid:** add multiSelect option to SelectionPlugin ([3a684b5](https://github.com/OysteinAmundsen/toolbox/commit/3a684b5447272c64f9c503e99c074f58a85c4578))

## [1.19.0](https://github.com/OysteinAmundsen/toolbox/compare/grid-1.18.0...grid-1.19.0) (2026-02-20)


### Features

* **grid, grid-angular, grid-react, grid-vue:** add getSelectedRows() to SelectionPlugin ([a0bb977](https://github.com/OysteinAmundsen/toolbox/commit/a0bb977f5e623149dc6a1b5a8f71aeeccc6466e5))

## [1.18.0](https://github.com/OysteinAmundsen/toolbox/compare/grid-1.17.0...grid-1.18.0) (2026-02-20)


### Features

* **grid:** add BLANK_FILTER_VALUE sentinel, selected map, and batch unique extraction ([1a40c05](https://github.com/OysteinAmundsen/toolbox/commit/1a40c056bf4e86c37442cf9f2fd454392e24c7cd))
* **grid:** add filterValue column extractor for complex cell filtering ([5944a45](https://github.com/OysteinAmundsen/toolbox/commit/5944a452df59b97b32565b5fe65c07ced0790a37))


### Bug Fixes

* **grid:** harden EditingPlugin row resolution against stale indices ([0208b15](https://github.com/OysteinAmundsen/toolbox/commit/0208b158278874d3ffee1d80e1152682130a6fc1))
* **grid:** keep focus on grid element during keyboard navigation ([2d3c44a](https://github.com/OysteinAmundsen/toolbox/commit/2d3c44a79d066271fc0d8250e1055d5f44f8155f))


### Enhancements

* **grid:** add data-type attribute to header cells ([b57b873](https://github.com/OysteinAmundsen/toolbox/commit/b57b873e4d06a39ba2426b1ff41d31956b626697))
* **grid:** use column format function in filter panel display values ([d1f284c](https://github.com/OysteinAmundsen/toolbox/commit/d1f284c1777e47514a6b1ecd9daec3f454c3018d))

## [1.17.0](https://github.com/OysteinAmundsen/toolbox/compare/grid-1.16.1...grid-1.17.0) (2026-02-18)


### Features

* **grid:** add closeOnClickOutside option for tool panel sidebar ([20e3c59](https://github.com/OysteinAmundsen/toolbox/commit/20e3c595970c428781b85a675370d156f191dfe2))


### Bug Fixes

* **grid:** fix stale sort indicators by enriching click events with column object ([b0a79a5](https://github.com/OysteinAmundsen/toolbox/commit/b0a79a5bd0df090211e155f7473133ebc51ba241))

## [1.16.1](https://github.com/OysteinAmundsen/toolbox/compare/grid-1.16.0...grid-1.16.1) (2026-02-17)


### Bug Fixes

* **grid:** ensure grid retains DOM focus for keyboard shortcuts after cell clicks ([ffba5a6](https://github.com/OysteinAmundsen/toolbox/commit/ffba5a6069112e1e2529337ffd38375f3076c317))

## [1.16.0](https://github.com/OysteinAmundsen/toolbox/compare/grid-1.15.0...grid-1.16.0) (2026-02-16)


### Features

* **grid:** render context menu shortcuts as kbd key combos ([a223915](https://github.com/OysteinAmundsen/toolbox/commit/a2239153c2a3aa2a512b7cd95920e19d98f8a8ac))
* **grid:** support shortcut key combos in context menu items ([c0342c9](https://github.com/OysteinAmundsen/toolbox/commit/c0342c9578adf3d3a0b51abf89caf0281d5bb209))


### Bug Fixes

* **grid:** allow ArrowUp/Down to reach editors in grid edit mode ([05fa7c4](https://github.com/OysteinAmundsen/toolbox/commit/05fa7c4877d4a9e9c0bd18ca838de3505e8cdd89))
* **grid:** check onBeforeEditClose for Escape in grid edit mode ([846ac39](https://github.com/OysteinAmundsen/toolbox/commit/846ac39b340e2e036ccec0de5b84019725b5def7))
* **grid:** handle null values correctly in set filter operators (in/notIn) ([12a34dd](https://github.com/OysteinAmundsen/toolbox/commit/12a34ddfec83540447ec96b6eb819bb20dc16e82))
* **grid:** ignore modified Enter key in editing keyboard handler ([fc2f0ab](https://github.com/OysteinAmundsen/toolbox/commit/fc2f0abe31f205ede1f440754e34f35c93cb8060))
* **grid:** preserve editors in grid edit mode on row reference change ([04d21dc](https://github.com/OysteinAmundsen/toolbox/commit/04d21dc205e20cf53b9b8df9dc570b5abadc3386))
* **grid:** prevent editor memory leak via releaseCell lifecycle hook ([00d2ef5](https://github.com/OysteinAmundsen/toolbox/commit/00d2ef5a1803a5329713a728f031a466c9d7d824))
* **grid:** support string widths (%, fr) in column template ([99357d9](https://github.com/OysteinAmundsen/toolbox/commit/99357d938a3cc79675de3fe1be9caad26d8e5861))

## [1.15.0](https://github.com/OysteinAmundsen/toolbox/compare/grid-1.14.1...grid-1.15.0) (2026-02-15)


### Features

* **grid:** add F2 keyboard shortcut for single-cell editing ([836dd15](https://github.com/OysteinAmundsen/toolbox/commit/836dd1591f2f6d68583a8e15df49afa46f5d48fd))
* **grid:** add group drag-and-drop in visibility panel ([67db4f6](https://github.com/OysteinAmundsen/toolbox/commit/67db4f69d723ef8fcf8c71f3e9e1cb6dba5a2ae6))
* **grid:** add plugin-contributed header context menu items ([229d7d8](https://github.com/OysteinAmundsen/toolbox/commit/229d7d84bb9a3d4dac21714a6e25f4e076bd12f5))
* **grid:** grouped visibility panel via plugin query collaboration ([a13290b](https://github.com/OysteinAmundsen/toolbox/commit/a13290b04d0cdcc5e0058955d31cff3d23fb4918))
* **grid:** reorder columns to grid edges on pin/unpin with position restore ([77aa826](https://github.com/OysteinAmundsen/toolbox/commit/77aa826e5160f646e3f843f93682da3362291e76))


### Bug Fixes

* **grid:** collapse duplicate context menu separators and align icon placeholders ([b2e0465](https://github.com/OysteinAmundsen/toolbox/commit/b2e04655b6a73d0053aefe78ca0edcc4a6ca3629))
* **grid:** fix test failures and update docs to use pinned property ([295a6c8](https://github.com/OysteinAmundsen/toolbox/commit/295a6c8dc0346ff1de700eca81b49732b17a17c0))
* **grid:** preserve column order when toggling visibility ([91889c5](https://github.com/OysteinAmundsen/toolbox/commit/91889c5c20dc1509780682a329255777cb91b367))
* **grid:** use part attribute selector for header context menu ([7f92ee9](https://github.com/OysteinAmundsen/toolbox/commit/7f92ee902bbd3a260aa3f0f8943659f912e1a786))

## [1.14.1](https://github.com/OysteinAmundsen/toolbox/compare/grid-1.14.0...grid-1.14.1) (2026-02-12)


### Bug Fixes

* **grid:** invalidate filter cache when upstream plugins change row order ([c0bb985](https://github.com/OysteinAmundsen/toolbox/commit/c0bb985f75aa63a07581654ae325d2e01f6e8273))
* **grid:** selection plugin should not react to ctrl+a when editing. ([a9f5d57](https://github.com/OysteinAmundsen/toolbox/commit/a9f5d578aee5db3e6138d8c49027aaec9dc141cb))
* **grid:** use real DOM elements for row loading spinner ([7cd2e4a](https://github.com/OysteinAmundsen/toolbox/commit/7cd2e4a3a660bacf93da53f63838b0bd30eca9f1))


### Enhancements

* **grid:** add "show only blank" option to date filter panel ([f6603c4](https://github.com/OysteinAmundsen/toolbox/commit/f6603c4d0ea23d761e992c534dd091191491041a))

## [1.14.0](https://github.com/OysteinAmundsen/toolbox/compare/grid-1.13.0...grid-1.14.0) (2026-02-11)


### Features

* **grid:** add fullWidth support to pinned rows plugin ([1c78d13](https://github.com/OysteinAmundsen/toolbox/commit/1c78d13a6f54fcb46fb8a328c02f14a149047d2d))
* **grid:** add onValueChange to editors for cascade reactivity ([c2be2b3](https://github.com/OysteinAmundsen/toolbox/commit/c2be2b33ac2b65c0801780b88133b5ce17dc8ddf))
* **grid:** bridge filterPanelRenderer in framework adapters ([a526b28](https://github.com/OysteinAmundsen/toolbox/commit/a526b28493d7bbc67d2f7c4397f6d844b8a91e64))
* **grid:** expose programmatic copy API with column/row options and extract shared data-collection utility ([b447d56](https://github.com/OysteinAmundsen/toolbox/commit/b447d56f40803852cbcd71fa45462157f1186db3))
* **grid:** support dynamic label function in fullWidth aggregation rows ([fb57ab1](https://github.com/OysteinAmundsen/toolbox/commit/fb57ab18e9f8a332a1888b943afbd3419fb0289e))
* **grid:** sync context-menu selection with query system + tests + docs ([800c344](https://github.com/OysteinAmundsen/toolbox/commit/800c34469b85e80fca64d6cfa4e9c9c09dcefd88))


### Bug Fixes

* **grid:** null-safe the row animations api ([064467b](https://github.com/OysteinAmundsen/toolbox/commit/064467b83a2c5c66d8973f8a589c424ce1728830))
* **grid:** selection plugin should not hijack Esc when editing is in progress. ([2f7d568](https://github.com/OysteinAmundsen/toolbox/commit/2f7d56829df78639077e12b3eb94faed25c89931))


### Enhancements

* **grid:** add more extensibility for css using varialbes ([fdb0b45](https://github.com/OysteinAmundsen/toolbox/commit/fdb0b45cd795e978726050960695494308862b68))

## [1.13.0](https://github.com/OysteinAmundsen/toolbox/compare/grid-1.12.1...grid-1.13.0) (2026-02-10)


### Features

* **grid:** add multi-select for row mode with Shift/Ctrl click and checkbox column ([0f2f572](https://github.com/OysteinAmundsen/toolbox/commit/0f2f572570441d4e79e66f89fac114f1faa94c02))


### Bug Fixes

* **grid,themes:** render selection borders inside cell padding box and fix Bootstrap focus variables ([3a04a86](https://github.com/OysteinAmundsen/toolbox/commit/3a04a866bbc445d531cafb283cabe3e91e735993))
* **grid:** added missing events for editing ([00e1ec4](https://github.com/OysteinAmundsen/toolbox/commit/00e1ec48706cfc3580b0252f78798aea70f21737))
* **grid:** improved the material theme ([44141b0](https://github.com/OysteinAmundsen/toolbox/commit/44141b012b02e1dc7f89eb62e86b9ff9787b51a5))
* **grid:** merge contiguous row selections into minimal ranges ([f7fcb49](https://github.com/OysteinAmundsen/toolbox/commit/f7fcb49d322ce1a1bfc2ca5b26650e5ea50b4c7c))
* **grid:** preserve newline characters on built-in text editors ([31d5274](https://github.com/OysteinAmundsen/toolbox/commit/31d5274bde6e3f6260ddc164966dc14222272595))
* **grid:** preserve null on blur for built-in text editor ([73461f3](https://github.com/OysteinAmundsen/toolbox/commit/73461f3713dca3d7596f20ad3b96391fe929330d))
* **grid:** sync selection state to focus ([99e467e](https://github.com/OysteinAmundsen/toolbox/commit/99e467e2cba6b07281c4dcb596c492d3772bf966))
* **theme:** improved the bootstrap theme ([f9b28ca](https://github.com/OysteinAmundsen/toolbox/commit/f9b28cacc7400db0c72b63a7f8ea0dcd966b9b01))


### Performance Improvements

* **grid:** reduce core bundle via import hint generation and sanitize deduplication ([87f2f58](https://github.com/OysteinAmundsen/toolbox/commit/87f2f5878e3d63cf5e12f72e0e73a86714d0573a))

## [1.12.1](https://github.com/OysteinAmundsen/toolbox/compare/grid-1.12.0...grid-1.12.1) (2026-02-09)


### Bug Fixes

* **grid:** apply group-end class via afterCellRender hook for scroll ([6bd7f76](https://github.com/OysteinAmundsen/toolbox/commit/6bd7f76bab32fd5a9b57a91d458611225fbca863))
* **grid:** enable variable heights when plugins are added after connectedCallback ([7bf4a3b](https://github.com/OysteinAmundsen/toolbox/commit/7bf4a3bd983d5fbf903b6c4b76d21d9dbbb9fbea))
* **grid:** re-setup scroll listeners when scroll plugins added dynamically ([5a8a98b](https://github.com/OysteinAmundsen/toolbox/commit/5a8a98b6906b3eabb9dadd10af2534dabe106475))
* **grid:** target .tbw-grid-root in ContextMenuPlugin instead of children[0] ([2ebee96](https://github.com/OysteinAmundsen/toolbox/commit/2ebee964002eeee7b19dd4eafb9a4029514c7695))


### Performance Improvements

* **grid:** optimize scroll rendering and fix master-detail height measurement ([0f5865d](https://github.com/OysteinAmundsen/toolbox/commit/0f5865d0d434f302752061395a2c9c0e03be824f))

## [1.12.0](https://github.com/OysteinAmundsen/toolbox/compare/grid-1.11.0...grid-1.12.0) (2026-02-07)


### Features

* **grid:** implement grid editing mode via afterCellRender hook ([8f1ee4e](https://github.com/OysteinAmundsen/toolbox/commit/8f1ee4e79be4eac584f1038336ccc57b0e72fc0f))
* **grid:** implement variable row height virtualization ([#55](https://github.com/OysteinAmundsen/toolbox/issues/55)) ([#119](https://github.com/OysteinAmundsen/toolbox/issues/119)) ([5b4efb7](https://github.com/OysteinAmundsen/toolbox/commit/5b4efb79f064e40ee3ed098805f5c7e655a6fc93))


### Bug Fixes

* **grid:** Allow escaping editing mode for fully editable grids ([524a56d](https://github.com/OysteinAmundsen/toolbox/commit/524a56d2ce55d6541cd6805d01a4bad14cb2c58f))
* **grid:** ensure output dirs exist before parallel plugin builds ([ed153c0](https://github.com/OysteinAmundsen/toolbox/commit/ed153c015739adef173292174dea7d5e73ef9d45))
* **grid:** handle empty arrays in min/max aggregators ([53f304c](https://github.com/OysteinAmundsen/toolbox/commit/53f304ca34b67a3c50efb16bcc8a9324e7d08e6e))
* **grid:** preserve toolbar buttons across full re-renders ([80a3496](https://github.com/OysteinAmundsen/toolbox/commit/80a3496523b8064b4bcb0fbe9c5bb40899037d1a))


### Performance Improvements

* **grid:** prevent scrollbar jumpiness by caching scroll height ([60a47b6](https://github.com/OysteinAmundsen/toolbox/commit/60a47b6d44a1063d629270800af3563b41db38fc))

## [1.11.0](https://github.com/OysteinAmundsen/toolbox/compare/grid-1.10.1...grid-1.11.0) (2026-02-06)


### Features

* **grid,grid-angular,grid-react,grid-vue:** add onBeforeEditClose callback for overlay support ([6a83c02](https://github.com/OysteinAmundsen/toolbox/commit/6a83c02a09ab357d6d2d876f8635c4948f8352a7))


### Bug Fixes

* **grid-angular:** looser typing for editor params allowing custom editors to have more flexibility ([94993d9](https://github.com/OysteinAmundsen/toolbox/commit/94993d923ee26241231c6c53aaffbe84f3fae7c9))
* **grid-angular:** return undefined from createEditor when no template exists ([63866eb](https://github.com/OysteinAmundsen/toolbox/commit/63866ebd24e208639fa9aa8474ada04c0a46d3bf))
* **grid-angular:** sync FormArray content changes & pass Space to editors ([963072f](https://github.com/OysteinAmundsen/toolbox/commit/963072f9f29ebf824230fbaa590013c85c91e112))
* **grid:** add missing exports ([6f3086f](https://github.com/OysteinAmundsen/toolbox/commit/6f3086f2e29454d9f61ff5c2bdcf1085f87b9576))
* **grid:** block grid keyboard navigation when onBeforeEditClose returns false ([97fb2ba](https://github.com/OysteinAmundsen/toolbox/commit/97fb2ba6da641030993735fcb99a02fcbea82046))
* **grid:** ensure Tab navigation scrolls focused cell into view while editing ([1d5ee61](https://github.com/OysteinAmundsen/toolbox/commit/1d5ee61f9e237df71547e90d2adc7c1f428913dd))
* **grid:** skip DOM input reading for framework-managed editors ([88f6770](https://github.com/OysteinAmundsen/toolbox/commit/88f6770c6f1633840cf21f7faaf15ceac1c2b6b1))

## [1.10.1](https://github.com/OysteinAmundsen/toolbox/compare/grid-1.10.0...grid-1.10.1) (2026-02-04)


### Bug Fixes

* **grid:** apply typeDefaults to columns at config merge time ([ecb6324](https://github.com/OysteinAmundsen/toolbox/commit/ecb6324280e5c97312726a192505aeb85e5fce7a))

## [1.10.0](https://github.com/OysteinAmundsen/toolbox/compare/grid-1.9.2...grid-1.10.0) (2026-02-03)


### Features

* **grid:** add cell validation and cancelable row-commit ([d8cc9ac](https://github.com/OysteinAmundsen/toolbox/commit/d8cc9ac6f2b59004a7678f226951633df7ac848a))


### Bug Fixes

* **grid:** add missing typed addEventListener overloads for grid events ([e7cd0cd](https://github.com/OysteinAmundsen/toolbox/commit/e7cd0cdcdf40aa8359a96efac592939ede6b11d0))
* **grid:** animate row by comparing snapshot to current value on edit close ([90615d6](https://github.com/OysteinAmundsen/toolbox/commit/90615d601acd363e5eefe4f901a716894a877b5a))
* **grid:** preserve numeric type for custom column types during edit commit ([b7cadd8](https://github.com/OysteinAmundsen/toolbox/commit/b7cadd8f79a4c94c36af07f3412f528b6ae9978e))
* **grid:** preserve string date type during edit to prevent false change detection ([6fd28fd](https://github.com/OysteinAmundsen/toolbox/commit/6fd28fdc3603a3540110291911ece2787f1b8bb9))

## [1.9.2](https://github.com/OysteinAmundsen/toolbox/compare/grid-1.9.1...grid-1.9.2) (2026-02-03)


### Bug Fixes

* **grid:** column virtualization scrolling and add requestColumnsRender API ([9b3c67b](https://github.com/OysteinAmundsen/toolbox/commit/9b3c67bd333ffb050f0b98498beeae00d7d40991))

## [1.9.1](https://github.com/OysteinAmundsen/toolbox/compare/grid-1.9.0...grid-1.9.1) (2026-02-02)


### Bug Fixes

* **grid:** clip resize handle on last column to prevent horizontal overflow ([bbbd891](https://github.com/OysteinAmundsen/toolbox/commit/bbbd8912660142e43240ec9b6ec88fbe60c491cf))

## [1.9.0](https://github.com/OysteinAmundsen/toolbox/compare/grid-1.8.0...grid-1.9.0) (2026-02-01)


### Features

* **grid:** 71 rtl right to left support ([#109](https://github.com/OysteinAmundsen/toolbox/issues/109)) ([89624c1](https://github.com/OysteinAmundsen/toolbox/commit/89624c1c1273104b096109a32c1dde30db77bf3b))


### Bug Fixes

* **grid:** apply typeDefaults format function correctly in cell rendering ([70b0b50](https://github.com/OysteinAmundsen/toolbox/commit/70b0b506dd5bab17b762b9b9d70532d7225b854e))
* **grid:** fix missing light DOM configuration support to ResponsivePlugin ([82820aa](https://github.com/OysteinAmundsen/toolbox/commit/82820aa434599b78cddea2181e20258dfa644b2d))

## [1.8.0](https://github.com/OysteinAmundsen/toolbox/compare/grid-1.7.0...grid-1.8.0) (2026-02-01)


### Features

* **grid:** [#83](https://github.com/OysteinAmundsen/toolbox/issues/83) plugin event bus query system ([#107](https://github.com/OysteinAmundsen/toolbox/issues/107)) ([881c296](https://github.com/OysteinAmundsen/toolbox/commit/881c296809a75ab2b27f4e89c33b87ed08a4b520))
* **grid:** add grid-wide resizable toggle ([483d0f8](https://github.com/OysteinAmundsen/toolbox/commit/483d0f8974510097e5518d4fea5507f82f8b4007))

## [1.7.0](https://github.com/OysteinAmundsen/toolbox/compare/grid-1.6.2...grid-1.7.0) (2026-01-30)


### Features

* **grid:** [#96](https://github.com/OysteinAmundsen/toolbox/issues/96) - add loading UX with grid, row, and cell loading states ([dde4385](https://github.com/OysteinAmundsen/toolbox/commit/dde43857e2d5be85f104b07d1fb77dda90804db4))

## [1.6.2](https://github.com/OysteinAmundsen/toolbox/compare/grid-1.6.1...grid-1.6.2) (2026-01-29)


### Bug Fixes

* **grid:** remove duplicate header from number/date filter panels ([24978a3](https://github.com/OysteinAmundsen/toolbox/commit/24978a38ea88ddba9e33a5a2dadb0872d723b2ca))

## [1.6.1](https://github.com/OysteinAmundsen/toolbox/compare/grid-1.6.0...grid-1.6.1) (2026-01-28)


### Bug Fixes

* **grid:** fix pivot collapse-all bug and add row reorder animation ([b12b809](https://github.com/OysteinAmundsen/toolbox/commit/b12b8096836d1831102f7ce066e197b4356a846c))


### Enhancements

* **themes:** enhance built-in themes with polish and modern styling ([767229f](https://github.com/OysteinAmundsen/toolbox/commit/767229ff773e2220624b29440c33e152eff1b9fd))

## [1.6.0](https://github.com/OysteinAmundsen/toolbox/compare/grid-1.5.0...grid-1.6.0) (2026-01-28)


### Features

* **grid:** add format to typeDefaults and filterPanelRenderer via plugin augmentation ([2be087e](https://github.com/OysteinAmundsen/toolbox/commit/2be087e78f10334b8a187c7883af589b255d2c53))
* **grid:** add gridConfig.filterable and gridConfig.selectable toggles ([8876b42](https://github.com/OysteinAmundsen/toolbox/commit/8876b42ea277f14b27dcb6d2e48d1e4e3b8c0315))


### Bug Fixes

* **grid,grid-angular,grid-react:** add sortable config and rename sorting to multiSort ([4522bfc](https://github.com/OysteinAmundsen/toolbox/commit/4522bfc71bebd3907e31932001c2cf19f7e0a257))
* **grid:** filterpanel should differentiate on column type ([2f4f174](https://github.com/OysteinAmundsen/toolbox/commit/2f4f174595791b0830cd530b42469d4c39c222e9))
* **grid:** respect `--tbw-filter-item-height` CSS variable in filtering panel ([98cca15](https://github.com/OysteinAmundsen/toolbox/commit/98cca154532a9abc881695ba641f3197221c245b))

## [1.5.0](https://github.com/OysteinAmundsen/toolbox/compare/grid-1.4.0...grid-1.5.0) (2026-01-27)


### Features

* **grid-angular:** DX add tree-shakeable feature inputs and event outputs ([757f8de](https://github.com/OysteinAmundsen/toolbox/commit/757f8deafd34387b534914152b248b93da68a0a1))
* **grid-react:** Improving DX for react framework bridge ([#98](https://github.com/OysteinAmundsen/toolbox/issues/98)) ([19ab6ae](https://github.com/OysteinAmundsen/toolbox/commit/19ab6ae0816ae6d199a5b811bc7557a4e946ed05))
* **grid:** add accordion mode and full-width aggregators to GroupingRowsPlugin ([2cec469](https://github.com/OysteinAmundsen/toolbox/commit/2cec469ea98f2473aa142fec68c9391f6bdeba41))
* **grid:** expand defaultExpanded to support index, key, or array of keys ([bb37d21](https://github.com/OysteinAmundsen/toolbox/commit/bb37d214035d376da6feee68c7f539007438e043))


### Bug Fixes

* **grid:** defaultExpanded option now works in GroupingRowsPlugin ([0511b19](https://github.com/OysteinAmundsen/toolbox/commit/0511b19471f6e6da9d3162b9912b17c28d451ff1))

## [1.4.0](https://github.com/OysteinAmundsen/toolbox/compare/grid-1.3.1...grid-1.4.0) (2026-01-26)


### Features

* **grid-angular:** [#80](https://github.com/OysteinAmundsen/toolbox/issues/80) angular reactive forms integration ([#94](https://github.com/OysteinAmundsen/toolbox/issues/94)) ([487118f](https://github.com/OysteinAmundsen/toolbox/commit/487118fc6fcc4e983cb727a282dca223d9b86fe7))
* **grid:** add gridAriaLabel and gridAriaDescribedBy config options ([a0c47a4](https://github.com/OysteinAmundsen/toolbox/commit/a0c47a43ff674f7ba398ee8e3e1cfe0505225868))
* **grid:** add PrintPlugin for print layout mode ([#70](https://github.com/OysteinAmundsen/toolbox/issues/70)) ([#93](https://github.com/OysteinAmundsen/toolbox/issues/93)) ([963b699](https://github.com/OysteinAmundsen/toolbox/commit/963b69977dd8fcefa53b7ecd1aa4b618d643aadf))
* **grid:** header renderers ([#81](https://github.com/OysteinAmundsen/toolbox/issues/81)) ([#91](https://github.com/OysteinAmundsen/toolbox/issues/91)) ([7b713bd](https://github.com/OysteinAmundsen/toolbox/commit/7b713bd1a199b832b51efc6ca87e437eaf0d0e6a))

## [1.3.1](https://github.com/OysteinAmundsen/toolbox/compare/grid-1.3.0...grid-1.3.1) (2026-01-26)


### Bug Fixes

* **grid:** add theming CSS variables and filter icon config ([#87](https://github.com/OysteinAmundsen/toolbox/issues/87), [#88](https://github.com/OysteinAmundsen/toolbox/issues/88), [#89](https://github.com/OysteinAmundsen/toolbox/issues/89)) ([578d87d](https://github.com/OysteinAmundsen/toolbox/commit/578d87d1ed27003b42ff370974f20f7cf646637f))

## [1.3.0](https://github.com/OysteinAmundsen/toolbox/compare/grid-1.2.0...grid-1.3.0) (2026-01-25)


### Features

* **grid:** add isSelectable callback for conditional selection ([#54](https://github.com/OysteinAmundsen/toolbox/issues/54)) ([#77](https://github.com/OysteinAmundsen/toolbox/issues/77)) ([4f5a381](https://github.com/OysteinAmundsen/toolbox/commit/4f5a3816d67b00d2d72ae3e26d2df95c8c50467f))
* **grid:** add Row Animation API (change/insert/remove) [#73](https://github.com/OysteinAmundsen/toolbox/issues/73) ([#78](https://github.com/OysteinAmundsen/toolbox/issues/78)) ([bda69f6](https://github.com/OysteinAmundsen/toolbox/commit/bda69f611cc0136173691f1bc98856fe983d8f25))
* **grid:** EditingPlugin uses row animation system for cell commits ([b7b5c97](https://github.com/OysteinAmundsen/toolbox/commit/b7b5c97c3f0e8d35f36806c7a83ec3bd8a2b8631))


### Bug Fixes

* **grid:** respect editable property during clipboard paste ([86d96ac](https://github.com/OysteinAmundsen/toolbox/commit/86d96acc9fbc40e39e981cc4a2fc3afb7d41c46c))

## [1.2.0](https://github.com/OysteinAmundsen/toolbox/compare/grid-1.1.2...grid-1.2.0) (2026-01-24)


### Features

* **grid:** add afterCellRender plugin hook for efficient cell-level modifications ([48c0b62](https://github.com/OysteinAmundsen/toolbox/commit/48c0b6263070a7af63a0c6482d9826521055ff01))
* **grid:** add afterRowRender plugin hook for row-level modifications ([0dc27aa](https://github.com/OysteinAmundsen/toolbox/commit/0dc27aaec573159ee8cdab97192b512cd8f8c891))
* **grid:** add missing methods to PublicGrid interface for better DX ([d38f1b8](https://github.com/OysteinAmundsen/toolbox/commit/d38f1b84dee0e154a95112866328b460d5919e59))
* **grid:** add row-reorder plugin ([#75](https://github.com/OysteinAmundsen/toolbox/issues/75)) ([123294a](https://github.com/OysteinAmundsen/toolbox/commit/123294a492dd7389f38f06bfc1d51312c41eeeef))


### Bug Fixes

* **grid:** ensure column groups render after shell refresh ([70943ed](https://github.com/OysteinAmundsen/toolbox/commit/70943eddd25a690d9886ea900defc2a04ad1ebcf))
* **grid:** preserve tbw-grid-detail and tbw-grid-responsive-card in shell rebuild ([70943ed](https://github.com/OysteinAmundsen/toolbox/commit/70943eddd25a690d9886ea900defc2a04ad1ebcf))

## [1.1.2](https://github.com/OysteinAmundsen/toolbox/compare/grid-1.1.1...grid-1.1.2) (2026-01-23)


### Bug Fixes

* **demo:** disable responsive plugin when row grouping is enabled ([3f4ad4e](https://github.com/OysteinAmundsen/toolbox/commit/3f4ad4ea0e8039ee002f66ca871b1d6946d7a03b))
* **grid:** clear cached measurements when exiting responsive mode ([e849b9f](https://github.com/OysteinAmundsen/toolbox/commit/e849b9fe785cdc0b8e2bc073c1b78dd543174410))
* **grid:** prevent infinite loop when responsive + grouping plugins combined ([e677356](https://github.com/OysteinAmundsen/toolbox/commit/e67735658afc0830263eb9c1ce8d98570cf1de19))
* **grid:** properly reset row element state when recycling between plugins ([548ef9c](https://github.com/OysteinAmundsen/toolbox/commit/548ef9c773d95878277fe365634183b36b606e93))


### Performance Improvements

* **grid:** eliminate duplicate afterRender calls during render cycle ([605991d](https://github.com/OysteinAmundsen/toolbox/commit/605991de9f72f4beee2f1a120631d9fbab55141e))
* **grid:** reduce render cycles during initialization and mode switches ([24e8c3c](https://github.com/OysteinAmundsen/toolbox/commit/24e8c3c13c627d1d937e031a3f3811ef1f7fa336))

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
