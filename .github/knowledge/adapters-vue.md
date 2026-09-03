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

## slot-shell coverage

- INVARIANT: Each `TbwGrid*.vue` shell that runs `onMounted`/`defineProps` logic MUST have a co-located `.spec.ts` that exercises every slot-detection branch and prop-resolution path. The shells are NOT pure templates — `TbwGridColumn.vue` alone has 4 slot-presence branches gating 4 different registry calls; `TbwGridToolPanel.vue` has a 3-way `resolvedTitle` fallback. Excluding them from coverage hides real test debt.
- DECIDED (gh #356 phase 7 follow-up): only `TbwGridToolButtons.vue` (zero script logic — pure `<slot />` passthrough) and `src/index.ts` (barrel) are in `vite.config.mts > test.coverage.exclude`. Specs added: `TbwGridDetailPanel.spec.ts`, `TbwGridResponsiveCard.spec.ts`, `TbwGridToolPanel.spec.ts`, `TbwGridColumn.spec.ts`. WHY: the `vue-grid-adapter.registry-parity.spec.ts` `import * as VueAdapter from '..'` exposed these files to v8 instrumentation for the first time, dropping branch coverage from 73.29% → 68.85%. They were 0%-covered on `main` too; the parity spec just made the pre-existing test debt visible. The fix is to pay it down, not exclude. Post-fix: branches 73.87% (above main baseline).
- INVARIANT: SFC tests follow the established pattern (see `TbwGridShellContent.spec.ts`) — `createApp(defineComponent({ render: () => h(Component, props, slots) })).mount(container)`. No `@vue/test-utils`. Verify behavior through the public registry getters (`getColumnRenderer`, `detailRegistry.get`, etc.), not by reading internal WeakMaps directly.

## vue-only prop aliases

- DECIDED (Jun 2026): `TbwGridToolPanel` — **`title` is canonical**, `label` is a retained Vue-only alias. WHY: `title` matches core (`ToolPanelConfig.title`, `plugins/shell/types.ts`), Angular (`title = input<string>()`), and React (`title?: string`); when adapters disagree, pick the name the core grid uses. `label` keeps working (`props.title ?? props.label ?? ''`) and is NOT `@deprecated` — removing it would be a breaking change with no upside. Docs never use `label`.

## vue SFC gotchas (2026-08 parity sweep)

- SELF-RESOLUTION: when an SFC's template root tag equals the component's own kebab tag (`TbwGridColumn.vue` rendering `<tbw-grid-column>`), vue-tsc resolves it to the COMPONENT, not the custom element — so `:options="serializedString"` typechecks against the rich `ColumnOptions` prop and fails `TS2322`. Bind DOM-only attributes via `v-bind="attrOverrides"` where `attrOverrides` is a `computed<Record<string, string>>` built imperatively (an inline ternary yields a union that fails the annotation).
- `onScopeDispose` is INVALID inside `onMounted` — use a scope-level `let unsub` + `onBeforeUnmount` (hit in `features/selection.ts` and `features/undo-redo.ts`).
- A literal `</script>` inside a JSDoc `@example` terminates the SFC's script block. Write the example as a plain ```ts fence.

## composables outside a component instance

- INVARIANT: Vue's `inject(KEY, defaultValue)` returns `undefined` — NOT the default — when called outside a component instance (it also logs a warning). Any composable reachable via the documented `selector` escape hatch is by definition callable outside `setup()`, so every injected ref MUST be defended: `(inject(GRID_ELEMENT_KEY, ref(null)) ?? ref(null))`. Without the `??` fallback, `useGrid()` threw `Cannot read properties of undefined (reading 'value')` in `getGrid()`. React's `useContext` DOES return its default, so this hazard is Vue-only and will not surface in a parity diff.
- INVARIANT: unwrap optional custom-element methods with `Promise.resolve(el.method?.())`, never `el.method?.().then(...)`. Optional chaining short-circuits the CALL but not the `.then()`, so the latter throws `TypeError` until the element upgrades. Applies to every `ready()` call site. Same rule for `await el.ready?.()` inside an `async` wrapper.
- DECIDED (2026-09): do NOT add `.catch()` to `ready()` chains, in ANY adapter. Core's promise is `new Promise((res) => (this.#readyResolve = res))` (`core/grid.ts` l.883, the ONLY assignment to `#readyPromise`) — the executor never captures `reject`, so rejection is structurally impossible, not merely unlikely. `async ready()` just returns it. A `.catch()` would be permanently-dead, permanently-uncoverable code, and grid-angular sits ~1pp above its 70% coverage gate. Re-raised and re-rejected on PR #473 (4 separate review threads); cite the executor signature when it comes up again.
- INVARIANT: every composable that mutates a ref from an async continuation needs a `let disposed = false` flag set in `onBeforeUnmount`, checked before each `.value =`. `useGridIsReady` and the selection composable both do this; it mirrors React's existing `disposed` guard.
