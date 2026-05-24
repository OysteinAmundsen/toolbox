---
domain: adapters-angular
related: [adapters, adapters-react, adapters-vue, grid-core, grid-features, build-and-deploy]
---

# Angular Adapter — Mental Model

> Shared adapter facts (conformance, parity, bridge registries, event/feature wiring, shell-content wrappers) live in [adapters.md](adapters.md).

## angular-adapter

- OWNS: `viewRefs`, `componentRefs`, per-cell editor tracking
- BRIDGE: `createEmbeddedView(template, ctx)` + `syncRootNodes(viewRef, container)`
- SYNC ROOT NODES: compares `viewRef.rootNodes` vs `container.childNodes`; replaces all if different (handles `@if`/`@for`)
- KEY FILES: `angular-grid-adapter.ts`, `angular-column-config.ts`, `inject-grid.ts`, `directives/grid.directive.ts`
- TENSION: two renderer syntaxes (`*tbwRenderer` structural directive vs `tbw-grid-column-view` nested directive) both supported
- TENSION: registration requires manual DI setup (not auto like React/Vue)
- DECIDED (#256): `mountComponentRenderer<TCtx>(componentClass, mapInputs, pool)` is canonical primitive for mounting standalone component into cell/header/panel. Returns `{ hostElement, componentRef }`. All `createComponent*Renderer` methods are thin wrappers. Cell cache (WeakMap pool reuse) and editor wiring stay AROUND the primitive.
- DECIDED (May 2026): `mountComponentRenderer` and `createTrackedEmbeddedView<TCtx>(template, context)` are public `@internal` (typedoc-excluded). WHY: feature secondary entries need them to mount user components without reaching into adapter privates. `setComponentInputs` stays private.

## per-feature-directives (deprecated `Grid` inputs/outputs migrating out)

- DECIDED (May 2026, `refactor/grid-angular-feature-directives`): each plugin's `[input]`/`(output)` lives in attribute-selector directive `features/<name>/src/grid-<name>.directive.ts` (e.g. `selector: 'tbw-grid[filtering], tbw-grid[filterChange]'`). WHY: every `input()`/`output()` on `Grid` ships `ɵɵdefineDirective` metadata into core whether imported or not — sweep moved grid-angular core 239 kB → 250.4 kB raw / 53.0 kB gz with per-feature 2-15 kB tree-shakeable bundles (filtering 14.3 kB, selection 11.5 kB, undo-redo 11.4 kB; pivot/tooltip ~2.2 kB).
- DECIDED: compile-time guarantee (`Can't bind to 'filtering' since it isn't a known property of 'tbw-grid'` when directive not imported) — STRONGER than React/Vue (silent drop) and WC core (runtime throw).
- RULED OUT: Angular `hostDirectives` (static metadata bakes into `Grid.ɵɵdefineDirective`, breaks tree-shake); side-effect auto-registration (standalone compiler resolves statically from consumer's `imports`).
- DECIDED (hybrid co-existence): deprecated `Grid` inputs/outputs stay until v2. Mediation = `libs/grid-angular/src/lib/internal/feature-claims.ts` per-element claims (`WeakMap<HTMLElement, Map<name, configGetter>>` + `WeakMap<HTMLElement, Set<eventName>>`). Directive ctor: `registerFeatureClaim(grid, name, () => this.input())` + `claimEvent(grid, eventName)`. `Grid.createFeaturePlugins` reads `getFeatureClaim(...)?.()` first; `Grid.setupEventListeners` skips `isEventClaimed`. Reading getter inside effect transitively tracks the directive's signal — all directives at a node construct before any `effect()` (microtask). `ngOnDestroy` calls `unregister*`. Cost: +5.5 kB raw / +1.5 kB gz on core.
- DECIDED: feature directive bound alongside deprecated `Grid` input → **directive wins**. Both bindings fire; claim takes precedence. KNOWN ASYMMETRY: deprecated `(filterChange)` listeners go silent when `GridFilteringDirective` imported into same component (called out in directive JSDoc).
- TENSION: claims-registry helpers re-exported from package barrel (ng-packagr forbids relative secondary→primary). `@internal`, typedoc-excluded. Cannot tree-shake out of core for zero-feature-directive consumers.
- DECIDED (employee-management): `gridConfig.features` and per-feature directives compose. When directive matches via event-only binding (`<tbw-grid (filterChange)="..."/>` without `[filtering]`), `registerFeatureClaim` returns `undefined` → `Grid.createFeaturePlugins` skips → core's `createPluginsFromFeatures(gridConfig.features)` creates plugin → directive's `addEventListener('filter-change')` still fires.
- INVARIANT: features added AFTER the sweep with NO deprecated `Grid` input (e.g. `stickyRows`) MUST still appear as `addPlugin('<name>', undefined)` in `Grid.createFeaturePlugins`, else the directive sets a claim nobody reads. Also append to `FeatureName` union in `feature-registry.ts`.
- DECIDED (gh #356 phase 1): Angular's `FeatureName` stays a hand-listed union (NOT `keyof FeatureConfig`) — React/Vue switched, Angular did not. WHY: Angular adapter never side-effect-imports `@toolbox-web/grid/features/*`, so ng-packagr partial compilation sees only the empty `FeatureConfig` sentinel `{ __brand?: never }` and `keyof FeatureConfig` collapses to `'__brand'`, breaking every `[features]` / per-feature directive input. React/Vue avoid this because their `src/features/*.ts` per-feature helper files do side-effect-import the augmenting modules. Closing this gap is a follow-up on #356 — requires either Angular auto-registration of feature modules (bundle cost) or a types-only augmentation entry point. Until then, `feature-registry.spec.ts` enforces strict-additive on whatever shape `FeatureName` has.

### Directive selector / event ownership table

| Directive (`Grid<Name>Directive`) | Selector inputs                                              | Owned events                                                                                                                     |
| --------------------------------- | ------------------------------------------------------------ | -------------------------------------------------------------------------------------------------------------------------------- |
| selection                         | `[selection]`                                                | `selection-change`                                                                                                               |
| editing                           | `[editing]`                                                  | `cell-commit`, `cell-cancel`, `row-commit`, `changed-rows-reset`, `edit-open`, `before-edit-close`, `edit-close`, `dirty-change` |
| clipboard                         | `[clipboard]`                                                | `copy`, `paste`                                                                                                                  |
| contextMenu                       | `[contextMenu]`                                              | `context-menu-open`                                                                                                              |
| multiSort                         | `[multiSort]`                                                | — (`sort-change` stays on Grid; single-col sort emits without plugin)                                                            |
| reorderColumns                    | `[reorderColumns]`                                           | `column-move`                                                                                                                    |
| visibility                        | `[visibility]`                                               | `column-visibility` (`columnStateChange` stays on Grid — multi-source)                                                           |
| pinnedColumns                     | `[pinnedColumns]`                                            | —                                                                                                                                |
| groupingColumns                   | `[groupingColumns]`                                          | —                                                                                                                                |
| columnVirtualization              | `[columnVirtualization]`                                     | —                                                                                                                                |
| reorderRows                       | `[reorderRows]`                                              | — (alias of rowDragDrop; events owned there to avoid duplicate listeners)                                                        |
| rowDragDrop                       | `[rowDragDrop]`                                              | `row-move`, `row-drag-start`, `row-drag-end`, `row-drop`, `row-transfer`                                                         |
| groupingRows                      | `[groupingRows]`                                             | `group-toggle`, `group-expand`, `group-collapse`                                                                                 |
| pinnedRows                        | `[pinnedRows]`                                               | —                                                                                                                                |
| tree                              | `[tree]`                                                     | `tree-expand`                                                                                                                    |
| masterDetail                      | `[masterDetail]`                                             | `detail-expand`                                                                                                                  |
| responsive                        | `[responsive]`                                               | `responsive-change`                                                                                                              |
| undoRedo                          | `[undoRedo]`                                                 | `undo`, `redo`                                                                                                                   |
| export                            | `[export]` (TS field `exportFeature` with `alias: 'export'`) | `export-complete`                                                                                                                |
| print                             | `[print]`                                                    | `print-start`, `print-complete`                                                                                                  |
| pivot                             | `[pivot]`                                                    | —                                                                                                                                |
| serverSide                        | `[serverSide]`                                               | —                                                                                                                                |
| stickyRows                        | `[stickyRows]`                                               | —                                                                                                                                |
| tooltip                           | `[tooltip]`                                                  | —                                                                                                                                |

- STAYS ON `Grid`: `cellChange`, `dataChange` (non-editing paths also emit); `sort-change`, `columnStateChange` (multi-source aggregates).
- TENSION: `Grid.cellCommit`/`rowCommit` use wrapper interfaces in `grid.directive.ts` (stale: `changedRowIndices: Set<number>` vs core `changedRowIds: string[]`; missing `setInvalid`/`updateRow`). Runtime detail = core shape; wrapper = typed view. v2 drops wrappers.

## angular-overlay-editors (`BaseOverlayEditor`)

- OWNS: panel element (moved to `document.body` to escape grid overflow clipping), `_abortCtrl: AbortController` for all listeners.
- DISMISSAL (all call abstract `onOverlayOutsideClick()` — subclass decides commit/cancel): `pointerdown` outside panel+host; `tbw-scroll` CustomEvent on closest `<tbw-grid>`; cell losing `cell-focus` class via MutationObserver → `hideOverlay()` (cancel path).
- INVARIANT: all listeners share `_abortCtrl.signal` — `teardownOverlay()` aborts all at once.
- INVARIANT: handler guards on `_isOpen && _panel` (listener attached eagerly in `initOverlay()` before show).
- DECIDED (#234): scroll → dismiss (NOT reposition). WHY: matches click-outside semantics, consumes public `tbw-scroll`.
- TENSION: anchor positioning uses CSS Anchor (`anchor-name`) when supported, else `_positionWithJs()` (only on open).

## angular-feature-bridges (registry side-effect imports)

- DECIDED (employee-management): Angular `registerTemplateBridge` callbacks (master-detail, responsive) MUST look up via `(grid as any).getPluginByName?.(name)`, NOT scan `gridConfig.plugins`. WHY: feature-resolver plugins (from `gridConfig.features.<name>`) live only in `PluginManager` — scanning `gridConfig.plugins.find(...)` emitted spurious "is not configured" warnings.
- INVARIANT (Angular spec): `angular-grid-adapter.spec.ts` registers bridges/preprocessors inline in `beforeAll` from `./internal/feature-bridges` and `./internal/feature-extensions` — NOT via barrel-side-effect import (would define `tbw-grid` and trip ResizeObserver in jsdom).
- TENSION: Angular feature-claim helpers MUST live in primary-entry barrel (ng-packagr secondary→primary). React/Vue ship as single package — relative `../lib/...` works.
- INVARIANT (Angular): feature secondary VALUE imports MUST go via `@toolbox-web/grid-angular` barrel, NOT relative `../../../src/lib/...`. ng-packagr fails `TS6059: File ... is not under 'rootDir'` (template-typecheck generates `.ngtypecheck.ts` outside secondary's rootDir). Type-only imports may use relative paths.

## angular-adapter-testing

- INVARIANT: angular adapter project deliberately avoids `TestBed`. Bootstrapping platform-browser-dynamic adds 3-5s per spec file and is unnecessary for component-free logic.
- PATTERN: for `inject()`-constructed classes (e.g. `GridTypeRegistry`, `BaseOverlayEditor`), instantiate without ctor: `Object.create(MyClass.prototype)` and seed private fields.
- PATTERN: for `AngularGridAdapter`, mock `createComponent` from `@angular/core` and the seven template-registry getter modules (`./directives/grid-detail-view.directive`, `grid-responsive-card.directive`, `grid-tool-panel.directive`, `grid-column-view.directive`, `grid-column-editor.directive`, `structural-directives`, `./grid-type-registry`). Mocked `createComponent` MUST read its `hostElement` option onto `componentRef.location.nativeElement` so adapter's `cellEl.contains(ref.location.nativeElement)` cleanup checks succeed.
- PATTERN: for directives using `inject()` + `effect()` + `input()` field initialisers (e.g. `GridFormArray`), `vi.mock('@angular/core', …)` to replace the three primitives. See [testing-patterns.instructions.md](../instructions/testing-patterns.instructions.md) for the full real-class spec recipe.
- DECIDED (#237): when CI coverage is V8, only loaded files appear in denominator. Adding `import { GridAdapter }` to a conformance spec dropped angular-adapter from ~80% → ~33%. Restoration path is real unit tests using patterns above, NOT lower threshold or exclude. `grid.directive.ts` (1581 lines) is intentionally NOT exercised by unit tests — covered end-to-end by demo apps and Playwright; importing would double the V8-visible project size.

## angular-spec-quirk

- INVARIANT (Angular): `*-grid-adapter.conformance.spec.ts` MUST start with `import '@angular/compiler';` (adapter transitively imports `@angular/forms`, partially-compiled). Uses `GridAdapter.prototype` because ctor requires DI.

## ng-packagr-secondary-entry-rules

- INVARIANT: ng-packagr 21 forbids primary depending on secondary. Direction: secondary → primary only. Blocks "physically move directive into feature folder, then re-export from main barrel".
- INVARIANT: re-exporting a directive via relative path (`export { GridDetailView } from '../features/master-detail/src/...'`) emits the file into BOTH bundles — two directive classes / two registries; cross-bundle bridge breaks at runtime. NEVER use this.
- DECIDED: feature-specific directives that can't move yet (e.g. `GridDetailView`) use soft-deprecation: source stays in `src/lib/directives/`, main `index.ts` re-exports with `MOVE-IN-V2:` marker (NOT `@deprecated` — would warn correct-feature consumers); feature entry re-exports from `@toolbox-web/grid-angular` so canonical path works. Physical move queued for v2.0.0 (see [build-and-deploy.md](build-and-deploy.md) v3 plan).

## tsconfig-path-mappings-and-typedoc

- INVARIANT: `tsconfig.base.json` mappings `@toolbox-web/grid-angular` → `dist/libs/grid-angular/index.d.ts` and `.../features/*` → `dist/libs/grid-angular/features/*.d.ts` are STALE — ng-packagr 21 emits to `dist/libs/grid-angular/types/...`. Broken since ng-packagr migration (`5a6f3fb4`); most consumers don't notice because they read sources via project references or `package.json#exports` overrides at runtime. Do NOT "fix" the global mapping without auditing every typecheck/typedoc/build target — multiple targets work _because_ the mapping resolves to nothing.
- DECIDED: `libs/grid-angular/tsconfig.typedoc.json` overrides `paths` to point at SOURCE (`./src/index.ts`, `./features/*/src/index.ts`) so typedoc never depends on built dist. Without override typedoc fails with 30+ TS2307 cascades. Mirror for any future "read source across primary/secondary boundary" tooling.

## angular-column-shorthand-rule

- INVARIANT: when grid-angular adds column-defaults support, `column-shorthand.ts` MUST import `ColumnConfig` from local Angular-shaped re-export, NOT `@toolbox-web/grid`. Angular `ColumnConfig` allows `Type<CellRenderer>` etc.; helpers typed against core `ColumnConfig` (`applyColumnDefaults`) need `any` cast at boundary (columns-sync effect); `processColumn` normalizes. Mirror the React rule (see [adapters-react.md](adapters-react.md)).
