---
domain: grid-features
related: [grid-plugins, grid-core]
---

# Grid Features — Mental Model

## feature-vs-plugin distinction

- FEATURE: declarative config wrapper. Thin module that registers a factory function. Provides tree-shakeable opt-in loading. Lives in `libs/grid/src/lib/features/`
- PLUGIN: runtime behavior implementation (extends BaseGridPlugin). Hooks into grid lifecycle. Lives in `libs/grid/src/lib/plugins/`
- RELATIONSHIP: 1:1 mapping. Each feature creates exactly one plugin via factory function
- FLOW: user config `{ features: { selection: 'range' } }` → registry checks import → factory: `SelectionPlugin({ mode: 'range' })` → plugin added to gridConfig.plugins

## registry (features/registry.ts)

- OWNS: featureRegistry Map<name, RegistryEntry>, warnedFeatures Set — persisted on `globalThis` under `Symbol.for('@toolbox-web/grid:feature-registry@<__GRID_VERSION__>/v1')` / `…-warned@<version>/v1` so every same-version bundled copy shares one instance; different versions stay isolated
- READS FROM: user FeatureConfig object, PLUGIN_DEPENDENCIES declarations
- WRITES TO: registry entries on import, console diagnostics in dev
- INVARIANT: each feature name maps to exactly one factory
- INVARIANT: factories only execute if feature module is imported (tree-shaking)
- INVARIANT: registry is realm-global per grid version. Two micro-frontends each bundling their own copy of `@toolbox-web/grid` **at the same version** see one Map (`import '@toolbox-web/grid/features/tree'` from bundle B is visible to the running grid class from bundle A). Bundles at **different** versions get separate Maps — mirrors the version-suffixed tag isolation in `registerDataGrid()` so v2.14's grid can't end up calling v2.15's plugin factory.
- API: registerFeature(name, factory, options?) | createPluginFromFeature(name, config) | createPluginsFromFeatures(obj) | isFeatureRegistered(name)
- DECIDED (May 2026): `registerFeature(name, factory, { override: true })` suppresses the dev-mode TBW030 "re-registered" warning. WHY: framework adapters (`grid-{vue,react}/src/features/<name>.ts`) intentionally re-register `pinnedRows`, `filtering`, `groupingColumns`, `groupingRows` to wrap the vanilla factory with framework bridging. They side-effect-import the vanilla module first (so types/transitive deps land), then call `registerFeature(..., { override: true })`. Without the flag, the demo always tripped TBW030; muting the warn unconditionally would hide real accidental re-registrations.
- DECIDED (planning #9): featureRegistry stored on `globalThis[Symbol.for('@toolbox-web/grid:feature-registry@<__GRID_VERSION__>/v1')]`, not module-local. WHY: Roma micro-frontends bundle their own `node_modules` copy of the grid. The custom-element class is realm-global (first-wins for same version, version-suffixed tag for different versions, via `registerDataGrid()` in `core/grid.ts`), so the running class came from one bundle but `import '…/features/<name>'` side-effects ran in every bundle. Module-local Maps fragmented the registry → spurious "Tree-plugin not available!" / TBW031. The key embeds `__GRID_VERSION__` so different versions stay isolated (same isolation `registerDataGrid()` enforces at the tag layer) — otherwise the last-loaded bundle's factories would overwrite earlier versions' entries and attach cross-version plugin instances. Trailing `/v1` is the slot-shape schema version. Tests: `features/registry.spec.ts` → "cross-bundle singleton".
- DECIDED (planning, Jun 2026): `__GRID_VERSION__` define MUST be applied to EVERY nested programmatic `build()` in [vite.config.ts](libs/grid/vite.config.ts), not just the top-level `defineConfig`. WHY: secondary entries (`features/registry.ts`, `features/*.ts`, `plugins/*/index.ts`, UMD plugins) are built via `build({ configFile: false, … })` inside `writeBundle` hooks; `configFile: false` does NOT inherit the top-level `define`. Before the fix, the main `index.js` got the version baked (element `version`/tag correct) but `features/registry.js` + `plugins/*/index.js` shipped the LITERAL `__GRID_VERSION__` → `typeof __GRID_VERSION__ === 'undefined'` → fell back to `'dev'`. Result: ALL grid versions collapsed onto ONE shared `@dev` feature-registry symbol, defeating the per-version isolation above — two coexisting versions (e.g. 2.16.1 + 2.16.2 in split-view Roma) tripped TBW030 "pinnedColumns re-registered" and could cross-attach factories. Fix: shared `const gridDefine = { __GRID_VERSION__: JSON.stringify(gridVersion) }` referenced by the main config AND all nested builds + the `libBuild` helper. Verify after build: `grep 'const t=' dist/libs/grid/lib/features/registry.js` must show the real version, never `"dev"`. NOTE: `version='dev'` is the legitimate fallback ONLY when running from source (no define, e.g. consumer bundling `src/`), never in a published artifact.
- DECIDED (May 2026, employee-management refactor): when both `gridConfig.features.<name>` and a manually-instantiated plugin in `gridConfig.plugins` resolve to the same plugin name, the **manual instance wins** and the feature-derived instance is dropped before `PluginManager.attachAll`. WHY: previously both were attached, tripping TBW023 "multiple instances" warnings — surfaced by the React adapter's `<GridDetailPanel>` / `<GridResponsiveCard>` auto-detection (`detectChildComponentFeatures` in `libs/grid-react/src/lib/data-grid.tsx`) which converts those children into feature props, then into manual plugins appended to `gridConfig.plugins`, while the user also lists `masterDetail` / `responsive` under `gridConfig.features`. Dedup lives in `Grid.#initializePlugins` (`libs/grid/src/lib/core/grid.ts`). Test: `src/__tests__/integration/features.spec.ts` "dedups when same plugin appears in both features and plugins (manual wins)".
- DECIDED (#400, Jun 2026): `createPluginsFromFeatures` orders plugins via a programmatic topological sort (`orderPluginsByDependencies` in [registry.ts](libs/grid/src/lib/features/registry.ts)) reading each plugin's `static dependencies` off `plugin.constructor` — the SAME metadata `validatePluginDependencies` reads at attach time. WHY: replaces a hardcoded `HOISTED = ['shell','selection','editing']` list that didn't help third-party/custom plugins. Now `features` key order is irrelevant for ANY plugin that declares `static dependencies` (e.g. visibility→shell required = TBW020 if shell attaches second). DFS post-order, cycle-safe via `onStack` guard, independents keep config order, edges to non-enabled plugins ignored (validator handles missing required). Graph keyed by `plugin.name` (deps reference plugin names). Tests: `features/registry.spec.ts` → "orders selection/editing/shell before dependent plugins".
- TENSION: no hard validation of dependencies — relies on convention. Circular deps not prevented (ordering is cycle-tolerant but won't error)

## feature-module-pattern (every feature file follows this)

```typescript
// 1. Import plugin + config type
import { SelectionPlugin, type SelectionConfig } from '../plugins/selection';
import { registerFeature } from './registry';
// 2. Module augmentation (TypeScript knows feature exists on FeatureConfig)
declare module '../core/types' {
  interface FeatureConfig<TRow> { selection?: 'cell' | 'row' | 'range' | SelectionConfig<TRow>; }
}
// 3. Register factory (handles string shortcuts → config objects)
registerFeature('selection', (config) => { ... });
// 4. Type anchor export
export type _Augmentation = true;
```

## dependency-ordering

- Hard-coded order ensures dependencies load first: `['selection', 'editing', ...rest]`
- clipboard depends on selection; undoRedo depends on editing
- Validated at creation time, not enforced at import time

## enable/disable lifecycle

1. IMPORT-TIME: feature registered only if module imported (`import '@toolbox-web/grid/features/selection'`)
2. CONFIG-TIME: feature enabled via gridConfig (`{ features: { selection: 'range' } }`)
3. RUNTIME: cannot disable plugins after grid creation (limitation)

- TENSION: user must remember to import features; no IDE hints for which imports are needed

## all-features (25 total)

| Feature              | Config shortcuts                | Dependencies |
| -------------------- | ------------------------------- | ------------ |
| selection            | 'cell' / 'row' / 'range'        | —            |
| editing              | 'click' / 'dblclick' / 'manual' | —            |
| clipboard            | ClipboardConfig                 | selection    |
| contextMenu          | ContextMenuConfig               | —            |
| multiSort            | MultiSortConfig                 | —            |
| filtering            | boolean / FilterConfig          | —            |
| reorderColumns       | ReorderConfig                   | —            |
| visibility           | boolean / VisibilityConfig      | —            |
| pinnedColumns        | boolean                         | —            |
| groupingColumns      | GroupingColumnsConfig           | —            |
| columnVirtualization | ColumnVirtualizationConfig      | —            |
| reorderRows          | RowReorderConfig                | —            |
| groupingRows         | GroupingRowsConfig              | —            |
| pinnedRows           | PinnedRowsConfig                | —            |
| tree                 | TreeConfig                      | —            |
| masterDetail         | MasterDetailConfig              | —            |
| responsive           | ResponsivePluginConfig          | —            |
| undoRedo             | boolean / UndoRedoConfig        | editing      |
| export               | ExportConfig                    | —            |
| print                | PrintConfig                     | —            |
| pivot                | PivotConfig                     | —            |
| serverSide           | ServerSideConfig                | —            |
| tooltip              | TooltipConfig                   | —            |

## shell-feature (extraction #370, in progress)

- DECIDED (Jun 2026, #370 Phase 0): the shell ships `libs/grid/src/lib/features/shell.ts` mirroring `features/clipboard.ts` — augments `FeatureConfig.shell?: boolean | ShellConfig`, calls `registerFeature('shell', cfg => new ShellPlugin(typeof cfg === 'boolean' ? {} : (cfg ?? {})))`, exports `_Augmentation` anchor, exposed at `@toolbox-web/grid/features/shell` via the existing `./features/*` wildcard. `features: { shell }` is the **taught best-practice API** — every demo/doc uses it (plan invariant 10).
- INVARIANT (#370): exactly **one** `shell` plugin instance must attach. Two registration channels coexist in v2.x: (1) `features.shell` / explicit `plugins[]` (user), (2) a static auto-register prepend in `Grid.#initializePlugins` (default-on fallback, marker `// SHELL-AUTOREGISTER-V3-370`). The auto-register MUST skip when a `shell`-named plugin already resolved (else TBW023 double-attach). Channel (2) is the single v3-deletion point; at v3 the feature (or explicit plugin) is the only path.
- DECIDED (#370): shell config TYPES (`ShellConfig`, `ToolPanelConfig`, etc.) move to `plugins/shell/types.ts` and augment core (`FeatureConfig.shell`, `GridConfig.shell`) — same plugin-augmentation pattern as every other feature. The `GridConfig.shell` FIELD is **not** deprecated: it is the plugin's augmented config surface (present whenever the shell is in the type graph; auto-registered in v2, opt-in at v3). Only the old `core/types.ts`/`public.ts` TYPE re-exports become `@deprecated` re-export aliases (non-breaking, dropped at v3), so deep importers should import shell types from `@toolbox-web/grid/plugins/shell`.

## explicit-feature-opt-out (validator behavior)

- DECIDED: when `gridConfig.features[name] === false` (explicit, not just absent), `validatePluginProperties` skips all "missing plugin" diagnostics for that plugin's owned properties (e.g. `editor`, `editable`, `editorParams` for `editing`; `group` for `groupingColumns`; `pinned` for `pinnedColumns`).
- RATIONALE: lets users keep plugin-owned column properties in place while toggling the feature off (e.g. read-only mode), without rewriting column configs each time. Absent feature still throws — only explicit `false` is treated as informed opt-out.
- INVARIANT: feature name in `features` matches plugin `name` 1:1 (relied upon by validator). When adding a new plugin-owned property to `KNOWN_COLUMN_PROPERTIES` / `KNOWN_CONFIG_PROPERTIES`, ensure its `pluginName` equals the registered feature key.
- LOCATION: `libs/grid/src/lib/core/internal/validate-config.ts` → `validatePluginProperties` → `isExplicitlyDisabled()` helper.
