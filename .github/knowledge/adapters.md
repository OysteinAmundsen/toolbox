---
domain: adapters
related: [grid-core, grid-features]
---

# Framework Adapters — Mental Model

> **DECIDED entries are facts + one-line WHY. History (what we tried, in what order) belongs in git log, not here.** When updating: condense, do not append.

## shared-architecture

- PATTERN: global singleton adapter registered at module load (React/Vue) or DI setup (Angular)
- FLOW: adapter registered → grid parses light DOM → user sets columns with framework components → `processConfig()` wraps components in bridge fns → grid calls renderer → bridge mounts component into cell container
- INVARIANT: adapter must be registered before grid parses light DOM
- INVARIANT: one adapter per app (singleton)
- INTERFACE (all implement): `processConfig`, `createComponentRenderer`, `createComponentEditor`, `releaseCell`, plus 10 methods listed in `CORE_CONSUMED_ADAPTER_METHODS` (see adapter-conformance)

## adapter-conformance

- OWNS: `CORE_CONSUMED_ADAPTER_METHODS` in `libs/grid/src/lib/core/adapter-conformance.ts`, re-exported from `public.ts`
- INVARIANT: every adapter ships `<framework>-grid-adapter.conformance.spec.ts` that fails when any listed method is missing on instance (React/Vue) or prototype (Angular — ctor needs DI)
- INVARIANT: when core adds a hook it depends on, append to `CORE_CONSUMED_ADAPTER_METHODS` so all adapter conformance specs go red
- DECIDED: only the constant is exported from `public.ts`; helper fns stay internal. WHY: exporting them pushed `index.js` over budget. Each spec inlines a 2-line filter; DRY isn't worth the bytes.
- TENSION (Angular): spec MUST start with `import '@angular/compiler';` (adapter transitively imports `@angular/forms`, partially-compiled). Uses `GridAdapter.prototype` because ctor requires DI.

## react-adapter

- OWNS: `columnRegistries` WeakMap, `fieldRegistries` Map (fallback), portal manager
- BRIDGE: React portal — `createPortal(component, container)` mounts into cell DOM
- KEY FILES: `react-grid-adapter.ts`, `portal-bridge.ts`, `react-column-config.ts`, `use-grid.ts`, `portal-manager.tsx`, `data-grid.tsx`
- DECIDED (#256): `createNodeBridge<TCtx>(reactFn)` in `portal-bridge.ts` is the canonical `(ctx) => ReactNode` → `HTMLElement | null` wrapper (`display:contents` wrapper + `renderToContainer` + null passthrough). Used by `features/pinned-rows.ts`, `features/grouping-columns.ts`, `features/grouping-rows.ts`. Non-nullable callers coerce via `bridged(ctx) ?? document.createElement('div')`. `features/filtering.ts` stays inline (per-container key tracking + `appendChild` shape doesn't fit).
- DECIDED (Apr 2026, #250 fix): `<tbw-grid>` inline `ref` callback in `data-grid.tsx` performs initial sync ONCE, gated by `initialSyncDoneRef = useRef(false)`. WHY: React detaches/reattaches inline refs on every render (calls with `null` then element). Without the gate, every parent re-render re-assigned `grid.gridConfig`, flipping `sourcesChanged=true` and rebuilding `effectiveConfig.columns` from `gridConfig.columns` — wiping runtime mutations like `col.hidden`. Naive `if (!previous)` is INSUFFICIENT (detach leaves `previous === null`); only `useRef` survives detach. Test: `data-grid.spec.tsx > does not re-assign gridConfig on parent re-render`. (Identity short-circuit also added in ConfigManager — see `grid-core.md` config-manager.)

## vue-adapter

- OWNS: `columnRegistries` WeakMap, `fieldRegistries` Map (fallback), teleport manager
- BRIDGE: Vue teleport mounts VNode into cell container
- COMPONENT DETECTION: `__name` (SFC) → `setup` (Composition) → `render` (Options) → plain function (Functional)
- KEY FILES: `vue-grid-adapter.ts`, `teleport-manager.ts`, `vue-column-config.ts`, `use-grid.ts`, `TbwGrid.vue`
- INVARIANT: `TbwGrid.vue` MUST mount `<TeleportManager>` and register via `setTeleportManager(gridEl, handle)` before any teleport-bridge call. Without it, `renderToContainer()` falls back to `createApp()` and silently severs `provide`/`inject`, Pinia, Router, i18n. The fallback path is reachable by adapter-internal renders (tool panels, master-detail) too, not just user cell renderers.
- INVARIANT: `TbwGrid.vue` MUST call `nextTick(() => { masterDetail.refreshDetailRenderer?.(); responsive.refreshCardRenderer?.(); refreshColumns(); refreshShellHeader(); })` in `onMounted`. Light-DOM children (`<TbwGridToolPanel>`, `<TbwGridResponsiveCard>`) mount AFTER the grid's first scan; without these calls they're silently ignored.
- DECIDED (#237): `createToolPanelRenderer` uses wrapper-detach (inner `<div class="vue-tool-panel">`, on cleanup synchronously `wrapper.remove()` BEFORE the async teleport-removal microtask). WHY: Vue 3.5 has no `flushSync` equivalent; detaching the wrapper makes the shell's downstream `container.innerHTML = ''` a no-op while Vue's deferred unmount still finds children attached and unmounts cleanly without `NotFoundError`.
- DECIDED (#237): Vue reuses core `createPluginsFromFeatures` from `@toolbox-web/grid/features/registry` — same source of truth as React. Do NOT reintroduce hand-rolled feature loops.
- DECIDED (#256): `createNodeBridge<TCtx>(vueFn)` in `teleport-bridge.ts` mirrors React's helper exactly. Same `?? createElement('div')` coercion; `features/filtering.ts` left inline for the same reason.

## angular-adapter

- OWNS: `viewRefs`, `componentRefs`, per-cell editor tracking
- BRIDGE: `createEmbeddedView(template, ctx)` + `syncRootNodes(viewRef, container)`
- SYNC ROOT NODES: compares `viewRef.rootNodes` vs `container.childNodes`; replaces all if different (handles `@if`/`@for`)
- KEY FILES: `angular-grid-adapter.ts`, `angular-column-config.ts`, `inject-grid.ts`, `directives/grid.directive.ts`
- TENSION: two renderer syntaxes (`*tbwRenderer` structural directive vs `tbw-grid-column-view` nested directive) both supported
- TENSION: registration requires manual DI setup (not auto like React/Vue)
- DECIDED (#256): `mountComponentRenderer<TCtx>(componentClass, mapInputs, pool)` is the canonical primitive for mounting a standalone component into a cell/header/panel. Returns `{ hostElement, componentRef }`. All `createComponent*Renderer` methods are thin wrappers around it. Cell cache (WeakMap pool reuse) and editor wiring stay AROUND the primitive — they're per-callsite concerns.
- DECIDED (May 2026): `mountComponentRenderer` and `createTrackedEmbeddedView<TCtx>(template, context)` are public `@internal` (typedoc-excluded). WHY: feature secondary entries need them to mount user components without reaching into adapter privates. `setComponentInputs` stays private.

### Per-feature directives (deprecated `Grid` inputs/outputs migrating out)

- DECIDED (May 2026, refactor `refactor/grid-angular-feature-directives`): each plugin's `[input]`/`(output)` migrates from the central `Grid` directive into an attribute-selector directive in the matching `features/<name>/src/grid-<name>.directive.ts` (e.g. `selector: 'tbw-grid[filtering], tbw-grid[filterChange]'`). WHY: every `input()` / `output()` on `Grid` ships `ɵɵdefineDirective` metadata + signal-factory code into core whether imported or not — 22 plugins × ~2 bindings made grid-angular core 239 kB / 50.5 kB gz vs grid-react 16.5 kB gz. Per-feature directives tree-shake with the feature.
- DECIDED (May 2026): compile-time guarantee (`Can't bind to 'filtering' since it isn't a known property of 'tbw-grid'` if directive not imported) is STRONGER than React/Vue (silent drop) and stronger than WC core (runtime throw).
- RULED OUT: Angular `hostDirectives` (static metadata baked into `Grid.ɵɵdefineDirective` — listing 22 there breaks tree-shaking). Side-effect auto-registration (Angular's standalone compiler resolves directives statically from the consuming component's `imports`, never runtime).
- DECIDED (May 2026, hybrid co-existence): deprecated `Grid` inputs/outputs stay alongside new feature directives until v2 cut. Mediation: per-element claims registry in `libs/grid-angular/src/lib/internal/feature-claims.ts` (`WeakMap<HTMLElement, Map<name, configGetter>>` + `WeakMap<HTMLElement, Set<eventName>>`). Directive ctor calls `registerFeatureClaim(grid, name, () => this.input())` + `claimEvent(grid, eventName)`; `Grid.createFeaturePlugins` reads `getFeatureClaim(grid, name)?.()` first (falls back to deprecated input); `Grid.setupEventListeners` skips `isEventClaimed` events. Reading the getter inside the effect transitively reads the directive's signal so reactivity propagates. All directives at a node construct before any `effect()` fires (effects = next microtask). `ngOnDestroy` calls `unregister*`. Foundation cost: +5.5 kB raw / +1.5 kB gz on grid-angular core, paid once.
- DECIDED (May 2026): when both feature directive and deprecated `Grid` input are bound, **directive wins**. Both bindings still fire (Angular assigns to all matching directives) but `Grid.createFeaturePlugins` reads the claim. KNOWN ASYMMETRY: deprecated `Grid` `(filterChange)` listeners go silent the moment `GridFilteringDirective` is imported into the same component — by design, called out in directive JSDoc.
- TENSION (May 2026): claims-registry helpers are re-exported from package barrel because ng-packagr forbids relative imports from secondary entries. Marked `@internal`, typedoc-excluded; can't tree-shake out of core for consumers using zero feature directives. The alternative (duplicating per feature entry) loses cross-grid claim isolation.
- DECIDED (May 2026, full sweep landed): pattern extended to all 23 features. Final bundle (FESM2022): grid-angular core 250.4 kB raw / 53.0 kB gz; per-feature 2-15 kB raw (largest: filtering 14.3 kB, selection 11.5 kB, undo-redo 11.4 kB; smallest: pivot/tooltip ~2.2 kB). Demo migration: zero template changes — adding directive to `imports` activates it on existing bindings. v2 will delete deprecated inputs/outputs + `eventOutputMap` plugin entries + claim consultation.

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
| tooltip                           | `[tooltip]`                                                  | —                                                                                                                                |

- STAYS ON `Grid`: `cellChange`, `dataChange` (emitted by non-editing paths too); `sort-change`, `columnStateChange` (multi-source aggregates).
- TENSION: `Grid.cellCommit` / `rowCommit` use Angular-adapter wrapper interfaces in `grid.directive.ts`, NOT core `CellCommitDetail` / `RowCommitDetail`. Wrappers are stale (e.g. `changedRowIndices: Set<number>` vs core's `changedRowIds: string[]`; missing `setInvalid`/`updateRow` callbacks). Runtime detail has core shape; wrapper is the typed view. v2 swaps to core types and drops wrappers.

## adapter-feature-purity (May 2026, all three adapters)

- DECIDED: adapter core source files (`{react,vue,angular}-grid-adapter.ts`, `react-column-config.ts`) MUST NOT contain runtime references to feature-specific behaviour. Type-only imports from feature subpaths are fine. Runtime feature wiring lives exclusively in the corresponding `features/<name>.ts` (React/Vue) or `features/<name>/src/` (Angular) secondary entry, which augments the adapter via registered bridges/hooks. Mirrors webcomponent grid's plugin discipline.

### Bridge registries (append-only, populated by side-effect imports)

| Registry                                                                | Module                                                                                   | Installed by                                                | Purpose                                                                                  |
| ----------------------------------------------------------------------- | ---------------------------------------------------------------------------------------- | ----------------------------------------------------------- | ---------------------------------------------------------------------------------------- |
| `registerEditorMountHook` / `notifyEditorMounted`                       | `editor-mount-hooks.ts` (each adapter)                                                   | `features/editing`                                          | `before-edit-close` → native `.blur()` on focused input                                  |
| `registerFilterPanelTypeDefaultBridge`                                  | each adapter                                                                             | `features/filtering`                                        | wraps user `filterPanelRenderer` in framework render path                                |
| `registerDetailRendererBridge` / `registerResponsiveCardRendererBridge` | `react-grid-adapter.ts` / `vue-grid-adapter.ts` / `angular: internal/feature-bridges.ts` | `features/master-detail` / `features/responsive`            | turns user template/component into renderer fn; adapter method becomes thin delegate     |
| `registerFeatureConfigPreprocessor(name, fn)` (Angular)                 | `internal/feature-extensions.ts`                                                         | `features/grouping-columns`, `grouping-rows`, `pinned-rows` | bridges Angular component classes embedded in feature config                             |
| `registerTemplateBridge` (Angular)                                      | `internal/feature-extensions.ts`                                                         | `features/master-detail`, `responsive`                      | wires `<tbw-grid-detail>`/`<tbw-grid-responsive-card>` templates in `ngAfterContentInit` |

- INVARIANT: features import from the adapter's primary entry (registry hooks + types); adapter primary entry MUST NOT import from feature secondary entries (build cycle).
- INVARIANT (Angular): feature secondary entries MUST import VALUE imports via `@toolbox-web/grid-angular` package barrel, NOT relative `../../../src/lib/...`. ng-packagr fails with `TS6059: File ... is not under 'rootDir'` (template-typecheck generates `.ngtypecheck.ts` files outside the secondary's rootDir). Type-only imports may use relative paths (erased before program graph materialises).
- INVARIANT: spec files exercising bridge behaviour MUST add side-effect imports of `'../features/<name>'` at the top, mirroring real consumers. Otherwise the bridge is null and methods return `undefined`.
- INVARIANT (Angular spec): `angular-grid-adapter.spec.ts` registers bridges/preprocessors inline in `beforeAll` from `./internal/feature-bridges` and `./internal/feature-extensions` — NOT via barrel-side-effect import (would define `tbw-grid` and trip ResizeObserver in jsdom).
- DECIDED: `createToolPanelRenderer` stays on adapter (CORE primitive — `shell.ts` parses `<tbw-grid-tool-panel>` and calls it). `createEditor`/`createRenderer` stay on adapter (per-cell primitives, not editing-feature-specific). `createFilterPanelRenderer` stays inline (generic node-to-container wrap; only filter-feature dep is type-only).
- TENSION: Angular feature-claim registry helpers MUST live in primary-entry barrel (ng-packagr secondary→primary direction). React/Vue don't have this — their features can use relative `../lib/...` because they ship as a single package.

### Pre-Tier-1 historical context (kept short)

The Tier-1 (May 2026) and Tier-2 (May 2026) sweeps moved feature wiring out of the Angular adapter in two passes; React/Vue had been pure since #256. Bundle savings were marginal — the win was architectural (adding a feature never touches the adapter). All decisions above represent the post-sweep state.

## react-overlay-editors (`useGridOverlay`) and vue-overlay-editors (`useGridOverlay`)

- OWNS: nothing — pure hook/composable. Delegates to `grid.registerExternalFocusContainer(panel)` / `unregisterExternalFocusContainer(panel)`.
- GRID RESOLUTION (in order): 1) explicit `gridElement` option, 2) `panelRef.current.closest('tbw-grid')`, 3) React `GridElementContext` / Vue `inject(GRID_ELEMENT_KEY)` from `<DataGrid>`/`<TbwGrid>`/`<GridProvider>`.
- INVARIANT: portaled/teleported panels can't use path 2 (`closest()` walks DOM, not React/Vue tree). Path 3 is the safety net; both frameworks preserve context across portals/teleports.
- INVARIANT: hook is intentionally minimal — no synthetic Tab dispatch, Escape, outside-click. Consumers needing full Angular `BaseOverlayEditor` parity wire those themselves. Bundle ~0.1 kB gzipped (#251).
- DECIDED (#251): React/Vue do NOT ship `BaseOverlayEditor` equivalents — no React class-component idiom, Vue idioms favor composables. `ColumnEditorContext.grid` covers class-style editors that want to call `registerExternalFocusContainer` directly from `componentDidMount` / `mounted()`.
- DECIDED (#251): `EditingPlugin`'s ARIA-expanded fallback (see `grid-plugins.md`) means most React/Vue combobox/autocomplete editors work WITHOUT calling the hook — provided trigger sets `aria-expanded="true"` + `aria-controls="<panel-id>"`. Use the hook for editors not advertising the WAI-ARIA combobox pattern (color pickers, menus).
- VUE COMPOSABLE QUIRK: accepts `MaybeRef<boolean>` for `open` and `MaybeRef<DataGridElement | null | undefined>` for `gridElement`. Watch dependency object pattern (`watch({open, panel, grid, ctx}, …, {immediate: true, flush: 'post'})`) is required because `unref(open)` inside a getter must be reactivity-tracked.

## angular-overlay-editors (`BaseOverlayEditor`)

- OWNS: panel element (moved to `document.body` to escape grid overflow clipping), `_abortCtrl: AbortController` for all listener cleanup
- DISMISSAL SIGNALS (all call abstract `onOverlayOutsideClick()` — subclass decides commit vs cancel):
  - `pointerdown` on document outside panel + host
  - `tbw-scroll` CustomEvent on closest `<tbw-grid>` ancestor
  - Focus observer: cell losing `cell-focus` class via MutationObserver → `hideOverlay()` (cancel path, not commit)
- INVARIANT: all listeners share `_abortCtrl.signal` so `teardownOverlay()` releases everything in one abort
- INVARIANT: handler must guard on `_isOpen && _panel` — listener is attached eagerly in `initOverlay()` before panel is shown
- DECIDED (#234 follow-up): scroll → dismiss (call `onOverlayOutsideClick()`), NOT scroll → reposition. WHY: same semantics as click-outside preserves subclass commit/cancel contracts; consumes public `tbw-scroll` API (no shadow-DOM reach-arounds).
- TENSION: anchor positioning uses CSS Anchor (`anchor-name`) when supported, else `_positionWithJs()` (only on open). Scroll-dismissal sidesteps live reposition loop.

## vue-teleport-manager (per-entry error boundary)

- OWNS: `teleports: ShallowRef<Map<string, TeleportEntry>>` keyed by stable id. Each entry rendered as `<Teleport :to="entry.container" :key="key"><TeleportEntryBoundary :entryKey="key">{{ vnode }}</TeleportEntryBoundary></Teleport>`.
- INVARIANT: `TeleportEntryBoundary.errorCaptured` MUST `return false`. WHY: stops error propagating to host's `app.config.errorHandler` and ancestor `errorCaptured`. Without it, one misbehaving cell renderer surfaces as global Vue error.
- INVARIANT: dropping an entry MUST replace `teleports.value` with a new `Map` instance (`new Map(teleports.value); copy.delete(key); teleports.value = copy`). `ShallowRef` only fires on identity change; in-place mutation would render the entry indefinitely.
- DECIDED (#250/#251): mirrors React's `PortalBoundary`. Vue's `errorCaptured` is the idiomatic equivalent of React's `componentDidCatch`. Bundle ~30 LoC.

## adapter-event-props (drift-safety pattern)

- OWNS (React): hand-maintained `EventProps<TRow>` interface + `EVENT_PROP_MAP` runtime constant in `libs/grid-react/src/lib/event-props.ts`. Guard: `} as const satisfies Readonly<Record<keyof EventProps, keyof DataGridEventMap<unknown>>>;` — bidirectional drift fails compile.
- OWNS (Angular): `output<T>()` signals + `eventOutputMap` runtime constant in `directives/grid.directive.ts`. Guard: `} as const satisfies Readonly<Record<string, keyof DataGridEventMap<unknown>>>;` — value-side only.
- OWNS (Angular forward-only drift guard): `private declare _intentionallyOmittedEvents: never; private declare _assertEventOutputMapCoversCore: [Exclude<keyof DataGridEventMap<unknown>, (typeof Grid.prototype.eventOutputMap)[keyof typeof Grid.prototype.eventOutputMap] | Grid['_intentionallyOmittedEvents']>] extends [never] ? true : ['Missing Angular outputs for core grid events:', ...]`. Widen `_intentionallyOmittedEvents` to a string-literal union to consciously skip.
- INVARIANT: NEVER widen the satisfies clause to silence a complaint. The complaint is the feature: either the event isn't real (drop the prop) OR the registration is missing (add to plugin's `declare module '../../core/types'` augmentation).
- INVARIANT: when satisfies rejects an event name, BEFORE dropping the prop check emit sites: `grep` for `'event-name'` and `_emit('event-name'`. Plugins emit via `this._emit(...)` but `DataGridEventMap` registration is the consumer-facing contract; they can diverge silently.
- INVARIANT: when a core event is added (registered in `DataGridEventMap`), all three adapters wire it: React `EVENT_PROP_MAP` + `EventProps`, Vue `EVENT_MAP` + `defineEmits`, Angular `eventOutputMap` + `output<T>()`. React/Angular guards catch their sides at build; Vue has no equivalent guard yet (worth a follow-up).
- INVARIANT: missing core public exports surface as Angular build failures, not Vue/React. `libs/grid/src/public.ts` is the only re-export Angular's `@toolbox-web/grid/all` deep-import can pick up — adding a new event detail type to a plugin's `types.ts` requires also adding to `public.ts`.
- INVARIANT (Angular `ColumnConfig` flavour): Angular's `ColumnConfig` (`angular-column-config.ts`) extends core by allowing `Type<CellRenderer>` / `Type<CellEditor>` / `Type<FilterPanel>`. Helpers typed against core `ColumnConfig` (`applyColumnDefaults`) cannot accept the Angular flavour at type level even though they work at runtime. Cast to `any` at the boundary (columns-sync effect); `processColumn` handles Angular-specific normalization.
- DECIDED: `EventProps` is intentionally flat (one entry per event, even pairs like `onUndo`/`onRedo`, `onGroupExpand`/`onGroupCollapse`). Tried `onUndoRedo` (single prop) — bound to `'undo-redo'` which the plugin never emits.
- DECIDED: hand-maintained interface + `satisfies` rather than auto-derived mapped type. Mapped types render as `type EventProps = unknown` in TypeDoc, losing per-prop JSDoc.
- TENSION (Angular): `eventOutputMap` keys can't be statically tied to `output<T>()` fields today (would require `keyof Grid` filtered to output-typed — verbose/brittle). Forgetting a map entry = silent runtime bug.

## adapter-feature-props (forward-only drift guard, React)

- OWNS: `FeatureConfig` (in `@toolbox-web/grid/all`) is augmented by every side-effect feature import. Canonical core feature registry.
- OWNS (React): hand-maintained `FeatureProps<TRow>` in `libs/grid-react/src/lib/feature-props.ts`. EOF guard: `type _MissingReactProps = Exclude<keyof FeatureConfig, keyof FeatureProps>; type _AssertFeaturePropsCoverCore = [_MissingReactProps] extends [never] ? true : ['Missing React props for core features:', _MissingReactProps];`
- INVARIANT: forward-only by design. React props are intentionally richer (shorthand unions, React-node renderers, React-only options like `SSRProps.ssr`). Reverse direction not checked.
- DECIDED: Vue/Angular don't have this guard yet — same pattern would work. Angular FeatureProps deliberately not mirrored: Angular configures via individual signal inputs on `Grid` directive, not a unified prop interface.
- DECIDED: `SSRProps.ssr` is `@deprecated`. React adapter no longer uses dynamic imports (features = synchronous side-effect imports, SSR-safe by construction). Setting `ssr={true}` only skips React-side plugin instantiation; `<tbw-grid>` still needs custom-elements polyfill server-side regardless. To be removed in a future major. Mirror in Vue's `feature-props.ts`.

## adapter-internal-helpers

- `createPortalContainer(className)` in `react-column-config.ts`; `createTeleportContainer(className)` in `vue-grid-adapter.ts`; `makeFlushFocusedInput(container)` in both. Deliberately NOT extracted to a shared package — 3-5 lines each, duplicating keeps each adapter independently tree-shakeable. Same rationale as `column-shorthand.ts`.
- `FEATURE_KEYS` array hoisted to module scope in React's `data-grid.tsx` (was per-render allocation of 24-element array).
- INVARIANT (Vue): `createEditor` (slot-path) MUST resolve `gridEl` eagerly via `element.closest('tbw-grid')`, NOT via `attachBeforeEditCloseFlush`'s `queueMicrotask` path. WHY: tests/user code dispatch `before-edit-close` synchronously during the editor's first render task; microtask path installs listener too late. `createConfig*Editor` family MUST use microtask path (containers built before DOM attach). Both share `makeFlushFocusedInput`.

## react-vue-parity (May 2026 audit)

- DECIDED: React and Vue audited for surface parity — verified identical 26 feature props, 28 grid events, hooks/composables, providers, tree-shakeable feature registration, portal/teleport bridges, registry types. Adjustments: `applyColumnDefaults` added to React (Vue had it); `cardRowHeight` exposed on `TbwGridResponsiveCard.vue` (React had it); `SSRProps` re-introduced as deprecated type in Vue `feature-props.ts` so `AllFeatureProps<TRow>` shape is identical; `GridCellContext`/`GridEditorContext` exported from `@toolbox-web/grid-vue` as type aliases over `CellSlotProps`/`EditorSlotProps`; `tool-panel-registry.spec.ts` created in Vue.
- DECIDED (#289, May 2026): cell/editor context generics use **asymmetric defaults**: `TRow = unknown`, `TValue = any` on Vue `CellSlotProps`/`EditorSlotProps`/`GridCellContext`/`GridEditorContext` and React `GridCellContext`/`GridEditorContext`. WHY: `unknown` for `TRow` keeps row-shape safety (users almost always know it); `any` for `TValue` unblocks single-generic usage like `CellSlotProps<MyRow>` — `unknown` defaults required casting in templates/JSX where narrowing is awkward. Type-level regression: `slot-types.spec.ts` (Vue), `context-types.spec.ts` (React).
- DECIDED (#289 follow-up, May 2026): `TbwGridColumn.vue` is now generic: `<script setup lang="ts" generic="TRow = unknown, TValue = any">`. `defineSlots` declares `cell?: (props: CellSlotProps<TRow, TValue>) => VNode[]` and editor likewise. WHY: without column-level generics, slot props were typed `CellSlotProps<unknown>` and `<template #cell="...: CellSlotProps<Employee>">` failed contravariance (function-parameter assignability requires `unknown` ⊑ `Employee`). With the column generic, consumers write `<TbwGridColumn<Employee> field="...">` and slot inference flows in. Adapter callbacks (`registerColumnRenderer`/`registerColumnEditor`) still receive core's erased `CellRenderContext<unknown, unknown>` — the slot args are bridged via a fresh-object-literal `as CellSlotProps<TRow, TValue>` cast (object-literal assignability, not `as unknown as`). Runtime is unchanged.
- INVARIANT: when adding a public export to one adapter, add equivalent to the other in the same PR. `index.ts` files are the canonical surface.
- INVARIANT: `AllFeatureProps<TRow>` shape MUST be identical across React and Vue. If `SSRProps` is ever truly removed, remove from both atomically.
- TENSION: idiomatic naming differences are NOT parity gaps (`<DataGrid>` vs `<TbwGrid>`, `children` render props vs `#cell`/`#editor` slots, `GridElementContext` vs `GRID_ELEMENT_KEY`, `PortalManager` vs `TeleportManager`).

## angular-react-vue-parity (May 2026 audit)

- DECIDED, Pass 1 (events): Vue and Angular were missing `cellCancel`, `editOpen`, `beforeEditClose`, `editClose`, `dirtyChange`, `dataChange`, `columnResizeReset`, `groupExpand`, `groupCollapse`, `contextMenuOpen`. Added to both. Vue's previous `'undo-redo'` listener was a latent bug — `UndoRedoPlugin` emits separate `'undo'`/`'redo'`; replaced with two `defineEmits` entries.
- DECIDED, Pass 2 (column shorthand): mirrored `column-shorthand.ts` to grid-angular; Angular `Grid` `columns` input widened to `ColumnShorthand<any>[]` + new `columnDefaults` input flowing through `normalizeColumns` → `applyColumnDefaults` → `adapter.processColumn`.
- DECIDED, Pass 3 (cardRowHeight): added `cardRowHeight = input<number | 'auto'>()` to `GridResponsiveCard` directive; mirrors to `card-row-height` attribute via effect.
- DECIDED, Pass 4 (plugin access): added `getPlugin<T>(pluginClass)` and `getPluginByName(name)` to `injectGrid()`'s return.
- DECIDED, Pass 5 (combined provider): added `provideGrid({ typeDefaults, icons })` in `grid-provider.ts`. WHY Angular uses providers vs Vue's `<GridProvider>` component: provide/inject is component-scoped in Vue, environment-scoped in Angular. FeatureProps deliberately NOT mirrored to Angular (Angular configures via signal inputs).
- DECIDED, Pass 6: Angular drift guard added (see adapter-event-props above).

## adapter-feature-bridge-registries

(Combined into "adapter-feature-purity" above — registries table.)

## angular-adapter-testing

- INVARIANT: angular adapter project deliberately avoids `TestBed`. Bootstrapping platform-browser-dynamic adds 3-5s per spec file and is unnecessary for component-free logic.
- PATTERN: for `inject()`-constructed classes (e.g. `GridTypeRegistry`, `BaseOverlayEditor`), instantiate without ctor: `Object.create(MyClass.prototype)` and seed private fields.
- PATTERN: for `AngularGridAdapter`, mock `createComponent` from `@angular/core` and the seven template-registry getter modules (`./directives/grid-detail-view.directive`, `grid-responsive-card.directive`, `grid-tool-panel.directive`, `grid-column-view.directive`, `grid-column-editor.directive`, `structural-directives`, `./grid-type-registry`). Mocked `createComponent` MUST read its `hostElement` option onto `componentRef.location.nativeElement` so adapter's `cellEl.contains(ref.location.nativeElement)` cleanup checks succeed.
- PATTERN: for directives using `inject()` + `effect()` + `input()` field initialisers (e.g. `GridFormArray`), `vi.mock('@angular/core', …)` to replace the three primitives. See `testing-patterns.instructions.md` for the full real-class spec recipe.
- DECIDED (#237): when CI coverage is V8, only loaded files appear in denominator. Adding `import { GridAdapter }` to a conformance spec dropped angular-adapter from ~80% → ~33%. Restoration path is real unit tests using patterns above, NOT lower threshold or exclude. `grid.directive.ts` (1581 lines) is intentionally NOT exercised by unit tests — covered end-to-end by demo apps and Playwright; importing would double the V8-visible project size.

## ng-packagr-secondary-entry-rules

- INVARIANT: ng-packagr 21 forbids primary entry depending on secondary. Direction is one-way: secondary → primary. Blocks "physically move the directive into feature folder, then re-export from main barrel".
- INVARIANT: re-exporting a directive via relative path (`export { GridDetailView } from '../features/master-detail/src/...'`) compiles, but ng-packagr emits the file into BOTH bundles — two distinct directive classes with same selector and two module-level registries. Cross-bundle bridge stops working at runtime. NEVER use this pattern.
- DECIDED: feature-specific directives that cannot move yet (e.g. `GridDetailView` belongs to master-detail) get the soft-deprecation pattern: source stays in `src/lib/directives/`, main `src/index.ts` re-exports with `MOVE-IN-V2:` marker comment (NOT `@deprecated` — would warn consumers of the correct feature entry), feature entry re-exports from `@toolbox-web/grid-angular` so canonical import path already works. Physical move queued for v2.0.0 (see `build-and-deploy.md` v3 plan).
- DECIDED: `getDetailConfig` (read `showExpandColumn`/`animation` attrs from DOM) was deleted — never used by any production code. Plugin reads `GridDetailView`'s `input()` signals directly via `parseLightDomDetail`.

## tsconfig-path-mappings-and-typedoc

- INVARIANT: `tsconfig.base.json` mappings `@toolbox-web/grid-angular` → `dist/libs/grid-angular/index.d.ts` and `.../features/*` → `dist/libs/grid-angular/features/*.d.ts` are STALE — ng-packagr 21 emits to `dist/libs/grid-angular/types/...`. Broken since ng-packagr migration (`5a6f3fb4`); most consumers don't notice because they read sources via project references or `package.json#exports` overrides at runtime. Do NOT "fix" the global mapping without auditing every typecheck/typedoc/build target — multiple targets work _because_ the mapping resolves to nothing.
- DECIDED: `libs/grid-angular/tsconfig.typedoc.json` overrides `paths` to point at SOURCE (`./src/index.ts`, `./features/*/src/index.ts`) so typedoc never depends on built dist. Without this override, typedoc fails with 30+ TS2307 cascades. Mirror this pattern for any future "read source across primary/secondary boundary" tooling.
- INVARIANT: `libs/grid-react/src/lib/column-shorthand.ts` MUST import `ColumnConfig` from `./react-column-config`, NOT `@toolbox-web/grid`. React-shaped `ColumnConfig` widens `renderer` to `(ctx) => ReactNode`. If column-shorthand uses core type, `applyColumnDefaults(...)` triggers TS2345. Mirror in `grid-vue` (Vue-shaped) and `grid-angular` (TemplateRef-shaped) when those adapters add column-defaults support.

## adapter-conformance-quick-table

| Framework | Registration           | Event idiom                                                                | Programmatic access                         |
| --------- | ---------------------- | -------------------------------------------------------------------------- | ------------------------------------------- |
| React     | global at module load  | props `onCellClick={(d)=>...}` (event-props.ts maps to `addEventListener`) | `useGrid<TRow>()` hook                      |
| Vue       | global at module load  | emits `@cell-click="handler"` (props → `addEventListener`)                 | `useGrid<TRow>()` composable (Ref wrappers) |
| Angular   | DI via `provideGrid()` | outputs `(cellClick)="handler($event)"` (directive wires native → outputs) | `injectGrid()`                              |

## event-handling — `before-edit-close` blur bridge

- DECIDED: editor `before-edit-close` → native `.blur()` on focused input/textarea/select inside editor container. WHY: Tab and programmatic row exits rebuild cell DOM synchronously; editors written with `onBlur={commit}` / `@blur="commit"` / `(blur)="commit()"` would lose pending input. Native `.blur()` required (NOT synthetic `FocusEvent`) — React 17+ delegates focus events at root via bubbling `focusout`, not non-bubbling `blur`; `.blur()` dispatches both. Angular's `BaseGridEditor.onBeforeEditClose()` is the parallel.
- DECIDED (#249 follow-up): bridge MUST wire BOTH slot/JSX `createEditor` path AND config-path editor wrappers. Specifically: React `wrapReactEditor`; Vue `createConfigVNodeEditor`/`createConfigComponentEditor`/`createTypeEditor` (via `attachBeforeEditCloseFlush` helper); Angular `createComponentEditor` + template `createEditor` (same helper). WHY: Tab from last editable cell triggers `EditingPlugin.preventDefault()` + `#exitRowEdit(currentRow, false)` → `beginBulkEdit(nextRow)` synchronously — focused input never blurs naturally. Grid element resolved lazily via `queueMicrotask` (container appended after wrapper returns).
- CLEANUP: React threads `unsub` field through `mountedPortals` (called in `cleanupConfigRootsIn`); Vue/Angular store unsubs in `editorMountTeardowns` Map keyed by container/host, swept in `releaseCell` (cell-scoped) and `destroy()` (bulk).
- TESTS: `react-column-config.spec.ts > flushes the focused input on before-edit-close`, `vue-grid-adapter.spec.ts > flushes the focused input on before-edit-close for config-based VNode editor`, `angular-grid-adapter.spec.ts > before-edit-close blur bridge`.
- DECIDED (Tier 1, May 2026): editor blur listener installation moved out of adapter into `editor-mount-hooks.ts` notifier system (see adapter-feature-purity registries). Field renamed `editorBeforeCloseUnsubs` → `editorMountTeardowns`; method `attachBeforeEditCloseFlush` → `runEditorMountHooks`. `features/editing` registers the hook.

## event-handling — releaseCell DOM-recycle invariant (issue #250)

- DECIDED: grid core MUST call `grid.__frameworkAdapter?.releaseCell?.(cell)` BEFORE any synchronous wipe (`innerHTML = ''` / `replaceChildren()`) of a cell that may contain adapter-managed renderer DOM. WHY: `cell.innerHTML = ''` removes React-mounted `.react-cell-renderer` nodes without notifying React; fiber tree still references orphans; next React commit throws `NotFoundError: Failed to execute 'removeChild' on 'Node'`.
- COVERED PATHS: (1) `editor-injection.ts` (open editor); (2) pool-shrink branch in `renderVisibleRows` (`core/internal/rows.ts`) calls per-cell `releaseCell` for each pool element about to `el.remove()`; (3) `_clearRowPool` (`grid.ts`) walks every row's children before `_bodyEl.innerHTML = ''`. All guarded by `cell.firstElementChild` so default-rendered cells skip.
- REACT IMPLEMENTATION: `releaseCell` resolves portal containers via `cellEl.querySelectorAll('.react-cell-renderer, .react-cell-editor')` + `containerToKey` reverse index (O(cell descendants), not O(total portals)) → `removeFromContainer(key, { sync: true })` + `untrackPortal(key)` → `cleanupConfigRootsIn(cellEl)` (DOM-scoped lookup against `Map<HTMLElement, MountedEntry>`).
- DEFENSE IN DEPTH: both `wrapReactRenderer` and `createRenderer` validate `cellEl.contains(cached.container)` before reusing `cellCache` WeakMap entry; if detached, sync-tear-down stale React root and create fresh container.
- DECIDED (#250 follow-up, per-portal error boundary): `PortalManager` (`portal-manager.tsx`) wraps each `createPortal` subtree in a class-component `PortalBoundary` whose `componentDidCatch` drops the offending entry from `portalsRef` and re-renders. WHY: third-party editors (EDS Autocomplete, popover-API widgets) can move DOM out from under React mid-edit. **In React 18+/19, exceptions thrown during a `flushSync` commit are routed to the nearest descendant error boundary's `componentDidCatch`, NOT re-thrown synchronously to the `flushSync` caller.** A `try/catch` around `flushSync(forceRender)` therefore CANNOT recover. Per-portal boundary sits between failing subtree and host app.
- ALSO: render-time filter skips portals whose `container.isConnected === false`.
- TESTS: `react-column-config.spec.ts > evicts cache and creates fresh container...`, `react-grid-adapter.spec.ts > evicts stale cache... > also unmounts renderer portals inside the cell`, `rows.spec.ts > releases cells when pool shrinks`, `portal-manager.spec.ts > should isolate a crashing portal so other portals keep working (#250)`.
- KNOWN WEAKNESSES (relying on the boundary): `GroupingRowsPlugin.ts` and `pinned-rows.ts` have `rowEl.innerHTML = ''` paths that do NOT call `releaseCell` first.

## feature-prop-bridging

- All adapters expose feature props that auto-load plugins. React: `<DataGrid selection="range" editing="dblclick" />`. Vue: `<TbwGrid :selection="'range'" :editing="'dblclick'" />`. Angular: `<tbw-grid [selection]="'range'" [editing]="'dblclick'">`.
- MECHANISM: feature props → `createPluginsFromFeatures()` → factory creates plugins → added to `gridConfig.plugins`.

## cross-adapter-tensions

- REGISTRATION TIMING: React/Vue auto-register at module load (sync); Angular requires explicit DI setup
- WEAKMAP FALLBACK: dual lookup (WeakMap → field name → factory) needed because framework re-renders create new DOM elements
- PORTAL/TELEPORT OVERHEAD: mounting framework components into web component cells requires bridge layer managing lifecycle outside framework's component tree
