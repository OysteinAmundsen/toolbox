---
domain: adapters-react
related: [adapters, adapters-vue, adapters-angular, grid-core, grid-features]
---

# React Adapter — Mental Model

> Shared adapter facts (conformance, parity, bridge registries, event/feature wiring, shell-content wrappers) live in [adapters.md](adapters.md).

## react-adapter

- OWNS: `columnRegistries` WeakMap, `fieldRegistries` Map (fallback), portal manager
- BRIDGE: React portal — `createPortal(component, container)` mounts into cell DOM
- KEY FILES: `react-grid-adapter.ts`, `portal-bridge.ts`, `react-column-config.ts`, `use-grid.ts`, `portal-manager.tsx`, `data-grid.tsx`
- DECIDED (#256): `createNodeBridge<TCtx>(reactFn)` in `portal-bridge.ts` = canonical `(ctx) => ReactNode → HTMLElement | null` wrapper (`display:contents` + `renderToContainer`). Used by `features/{pinned-rows,grouping-columns,grouping-rows}`. Non-nullable callers `?? document.createElement('div')`. `features/filtering.ts` stays inline (per-container key tracking shape mismatch).
- INVARIANT: `createNodeBridge` MUST `instanceof Node`-check the user-fn return and passthrough DOM nodes. WHY: vanilla helpers (`rowCountPanel()`, `filteredCountPanel()`) return `HTMLElement`; without check `PortalBoundary` throws "Objects are not valid as a React child". Same rule in Vue `teleport-bridge.ts`.
- DECIDED (#250, Apr 2026): `<tbw-grid>` inline `ref` in `data-grid.tsx` syncs ONCE via `initialSyncDoneRef = useRef(false)`. WHY: React detaches/reattaches refs each render (called with `null` then element); without gate, every parent re-render re-assigned `grid.gridConfig`, rebuilding `effectiveConfig.columns` and wiping runtime `col.hidden`. `if (!previous)` insufficient (detach leaves `previous===null`). Test: `data-grid.spec.tsx > does not re-assign gridConfig on parent re-render`.
- DECIDED (May 2026, employee-management): `detectChildComponentFeatures` (`data-grid.tsx`) auto-derives `responsive: true` / `masterDetail: {showExpandColumn, animation}` from `<GridResponsiveCard>` / `<GridDetailPanel>`. `mergedFeatureProps` MUST strip child-detected entries already keyed in `gridConfig.features` — bare-bones child config wins core's manual-wins dedup (`grid.ts` `#initializePlugins`) and drops the user's full config → TBW110.

## portal-manager (#250, #330, #332)

- OWNS: portal map keyed by container; `PortalBoundary` per portal (class component, `componentDidCatch` drops entry + re-renders).
- DECIDED (#250): `PortalBoundary` wrapping is required. WHY: React 18+/19 routes `flushSync`-commit exceptions to nearest descendant boundary, NOT back to caller — `try/catch` around `flushSync` cannot recover.
- DECIDED (#250): `releaseCell` resolves containers via `cellEl.querySelectorAll('.react-cell-renderer, .react-cell-editor')` + `containerToKey` reverse index → `removeFromContainer(key, {sync:true})` + `untrackPortal(key)` → `cleanupConfigRootsIn(cellEl)`. Defense in depth: `wrapReactRenderer` + `createRenderer` validate `cellEl.contains(cached.container)` before WeakMap reuse.
- DECIDED (#330): `PortalManager.{beginBatch,endBatch}` on handle; `portal-bridge.ts` re-exports `beginPortalBatch`/`endPortalBatch`; `GridAdapter.beginBatch/endBatch` delegate. While batched, `removePortal(key,sync=true)` deletes entry but SKIPS `flushSync`. Kills `flushSync was called from inside a lifecycle method` warning storm on grouping changes.
- INVARIANT (#330): bulk-teardown sites MUST detach every container AFTER per-cell release and BEFORE `endBatch()`, else deferred unmount against wiped container reproduces original `removeChild NotFoundError`. Test: `portal-manager.spec.tsx > beginBatch / endBatch`.
- DECIDED (#332): every deferred path guarded by `unmountedRef` set in `useLayoutEffect` cleanup (NOT `useEffect` — passive runs after commit, leaves window for queued `flushSync`). WHY: host tree unmount (route change) leaves pending `queueMicrotask(scheduleFlush)` / rAF (`schedulePrune`) which re-enter `createPortal` against torn-down providers → context hooks throw per row × column. Cleanup cancels rAF + clears `portalsRef`; methods become no-ops. Mount re-arms for StrictMode double-invoke. NOT MIRRORED in Vue/Angular. Tests: `portal-manager.spec.tsx > host-tree unmount cleanup` (3 cases).
- INVARIANT: render-time filter skips portals with `container.isConnected === false`.
- TESTS: `react-column-config.spec.ts > evicts cache and creates fresh container...`; `react-grid-adapter.spec.ts > evicts stale cache... > also unmounts renderer portals inside the cell`; `rows.spec.ts > releases cells when pool shrinks`; `portal-manager.spec.ts > isolates a crashing portal (#250)`.

## react-overlay-editors (`useGridOverlay`)

- OWNS: nothing — pure hook. Delegates to `grid.registerExternalFocusContainer(panel)` / `unregisterExternalFocusContainer(panel)`.
- GRID RESOLUTION (in order): 1) explicit `gridElement` option, 2) `panelRef.current.closest('tbw-grid')`, 3) `GridElementContext`.
- INVARIANT: portaled panels can't use path 2 — path 3 is safety net (React preserves context across portals).
- INVARIANT: hook is intentionally minimal — no synthetic Tab, Escape, outside-click. ~0.1 kB gz (#251).
- DECIDED (#251): React ships no `BaseOverlayEditor` equivalent (no React class idiom). `ColumnEditorContext.grid` covers class-style editors calling `registerExternalFocusContainer` directly.
- DECIDED (#251): `EditingPlugin` ARIA-expanded fallback (see [grid-plugins.md](grid-plugins.md)) means most combobox/autocomplete editors work WITHOUT the hook — provided trigger sets `aria-expanded="true"` + `aria-controls="<panel-id>"`. Use hook for non-combobox overlays.

## adapter-feature-props (forward-only drift guard, React-only)

- OWNS: `FeatureConfig` (in `@toolbox-web/grid/all`) is augmented by every side-effect feature import. Canonical core registry.
- OWNS: hand-maintained `FeatureProps<TRow>` in `libs/grid-react/src/lib/feature-props.ts`. EOF guard: `type _MissingReactProps = Exclude<keyof FeatureConfig, keyof FeatureProps>; type _AssertFeaturePropsCoverCore = [_MissingReactProps] extends [never] ? true : ['Missing React props for core features:', _MissingReactProps];`
- INVARIANT: forward-only by design. React props intentionally richer (shorthand unions, React-node renderers, React-only options like `SSRProps.ssr`). Reverse direction not checked.
- DECIDED: Vue/Angular don't have this guard yet — same pattern would work. Angular `FeatureProps` deliberately not mirrored (signal-inputs idiom).
- DECIDED: `SSRProps.ssr` is `@deprecated`. React adapter no longer uses dynamic imports (features = synchronous side-effect imports, SSR-safe by construction). Setting `ssr={true}` only skips React-side plugin instantiation; `<tbw-grid>` still needs CE polyfill server-side. Remove in future major. Mirror in Vue's `feature-props.ts`.

## react-internal-helpers

- `createPortalContainer(className)` in `react-column-config.ts`; `makeFlushFocusedInput(container)` (shared shape with Vue, separately implemented). NOT extracted to shared package — keeps each adapter tree-shakeable.
- `FEATURE_KEYS` hoisted to module scope in `data-grid.tsx` (was per-render 24-element alloc).
