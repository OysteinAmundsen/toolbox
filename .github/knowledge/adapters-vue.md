---
domain: adapters-vue
related: [adapters, adapters-react, adapters-angular, grid-core, grid-features]
---

# Vue Adapter — Mental Model

> Shared adapter facts (conformance, parity, bridge registries, event/feature wiring, shell-content wrappers) live in [adapters.md](adapters.md).

## vue-adapter

- OWNS: `columnRegistries` WeakMap, `fieldRegistries` Map (fallback), teleport manager
- BRIDGE: Vue teleport mounts VNode into cell container
- COMPONENT DETECTION: `__name` (SFC) → `setup` (Composition) → `render` (Options) → plain function (Functional)
- KEY FILES: `vue-grid-adapter.ts`, `teleport-manager.ts`, `vue-column-config.ts`, `use-grid.ts`, `TbwGrid.vue`
- INVARIANT: `TbwGrid.vue` MUST mount `<TeleportManager>` and register via `setTeleportManager(gridEl, handle)` before any teleport-bridge call. Without it `renderToContainer()` falls back to `createApp()` and silently severs `provide`/`inject`, Pinia, Router, i18n. Fallback path reachable by adapter-internal renders (tool panels, master-detail) too.
- INVARIANT: `TbwGrid.vue` MUST call `nextTick(() => { masterDetail.refreshDetailRenderer?.(); responsive.refreshCardRenderer?.(); refreshColumns(); refreshShellHeader(); })` in `onMounted`. Light-DOM children (`<TbwGridToolPanel>`, `<TbwGridResponsiveCard>`) mount AFTER grid's first scan; without these calls they're silently ignored.
- DECIDED (#237): `createToolPanelRenderer` wrapper-detach (inner `<div class="vue-tool-panel">`); cleanup synchronously `wrapper.remove()` BEFORE async teleport-removal microtask. WHY: Vue 3.5 lacks `flushSync`; wrapper-detach makes downstream `container.innerHTML = ''` a no-op so Vue's deferred unmount runs without `NotFoundError`.
- DECIDED (#237): Vue reuses core `createPluginsFromFeatures` from `@toolbox-web/grid/features/registry`. No hand-rolled feature loops.
- DECIDED (#256): `createNodeBridge<TCtx>(vueFn)` in `teleport-bridge.ts` mirrors React. Same `?? createElement('div')` + Node-passthrough rules; `features/filtering.ts` inline.
- DECIDED: `TbwGrid.vue` MUST set `defineOptions({ inheritAttrs: false })` + `v-bind="$attrs"` on inner `<tbw-grid>`. WHY: fragment root (`<TeleportManager/>` + `<tbw-grid>`); without this `class=` etc. trigger "Extraneous non-props attributes" warnings.
- DECIDED: `TbwGridToolPanel.vue` accepts BOTH `title` (canonical, maps to attribute `shell.ts > parseLightDomToolPanels` reads) and `label` (deprecated alias). Pre-fix Vue panels silently TBW070'd because only `label` was forwarded.
- DECIDED: `parseLightDomToolPanels` MUST NOT tear down adapter-rendered panel content on idempotent re-parses. Re-parse of adapter-bound panel only refreshes `render` closure + attributes; runs `panelCleanups` only on (a) first adapter attach (vanilla → adapter) or (b) header attr change (order/icon/tooltip). WHY: every `grid.gridConfig = …` routes through `#applyGridConfigUpdate` → `parseLightDomToolPanels` — unconditional cleanup destroyed local state + `scrollTop` of custom panels. Tracker: `ShellState.adapterBoundToolPanelIds`. Test: `shell.spec.ts` "does not tear down adapter-rendered panel content on idempotent re-parse".
- DECIDED (May 2026, Vue header-slot parity): `FrameworkAdapter` exposes optional `createHeaderRenderer?(el)` / `createHeaderLabelRenderer?(el)`. Wired in `parseLightDomColumns` (`columns.ts`) when adapter `canHandle(el)` AND defines at least one. `mergeColumns` rule: programmatic wins; DOM-found header renderers fill missing programmatic ones. React/Angular don't implement (`gridConfig` column object is their surface). `registerColumnHeaderRenderer` / `registerColumnHeaderLabelRenderer` mirror `renderer`/`editor` (WeakMap + field-name fallback). Slot path reuses `createConfigVNodeHeaderRenderer` / `createConfigVNodeHeaderLabelRenderer`. Tests: `columns.spec.ts > framework adapter header hooks`; `vue-grid-adapter.spec.ts > createHeaderRenderer / createHeaderLabelRenderer`.

## vue-teleport-manager (per-entry error boundary)

- OWNS: `teleports: ShallowRef<Map<string, TeleportEntry>>` keyed by stable id. Rendered: `<Teleport :to="entry.container" :key><TeleportEntryBoundary :entryKey>{{ vnode }}</TeleportEntryBoundary></Teleport>`.
- INVARIANT: `TeleportEntryBoundary.errorCaptured` MUST `return false`. Without it one misbehaving cell renderer propagates to host `app.config.errorHandler`.
- INVARIANT: drop entry MUST replace `teleports.value` with new `Map` (ShallowRef only fires on identity change).
- DECIDED (#250/#251): mirrors React's `PortalBoundary`. ~30 LoC.

## vue-overlay-editors (`useGridOverlay`)

- OWNS: nothing — pure composable. Delegates to `grid.registerExternalFocusContainer(panel)` / `unregisterExternalFocusContainer(panel)`.
- GRID RESOLUTION (in order): 1) explicit `gridElement` option, 2) `panelRef.value.closest('tbw-grid')`, 3) `inject(GRID_ELEMENT_KEY)`.
- INVARIANT: teleported panels can't use path 2 — path 3 is safety net.
- INVARIANT: composable intentionally minimal — no synthetic Tab/Escape/outside-click. ~0.1 kB gz (#251).
- DECIDED (#251): Vue ships no `BaseOverlayEditor` equivalent (composables idiom).
- VUE QUIRK: accepts `MaybeRef<boolean>` for `open` + `MaybeRef<DataGridElement|null|undefined>` for `gridElement`. Watch dep-object pattern (`watch({open, panel, grid, ctx}, ..., {immediate: true, flush: 'post'})`) required — `unref(open)` inside getter must be reactivity-tracked.

## vue-internal-helpers

- `createTeleportContainer(className)` in `vue-grid-adapter.ts`; `makeFlushFocusedInput(container)` (separate impl from React for tree-shake).
- INVARIANT: `createEditor` (slot-path) MUST resolve `gridEl` eagerly via `element.closest('tbw-grid')`, NOT via `attachBeforeEditCloseFlush`'s `queueMicrotask`. WHY: tests/user code dispatch `before-edit-close` synchronously during editor's first render — microtask installs listener too late. `createConfig*Editor` family MUST use microtask path (containers built before DOM attach). Both share `makeFlushFocusedInput`.

## vue-typed-slots

- DECIDED (#289 follow-up): `TbwGridColumn.vue` is `<script setup lang="ts" generic="TRow = unknown, TValue = any">`. `defineSlots` declares typed `cell?` / `editor?`. Adapter callbacks still receive erased `CellRenderContext<unknown, unknown>` — bridged via fresh-object-literal `as CellSlotProps<TRow, TValue>` (object-literal assignability, NOT `as unknown as`).
