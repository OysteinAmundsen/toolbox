---
domain: grid-features
related: [grid-plugins, grid-plugins-catalog-data, grid-plugins-catalog-ui, grid-core]
---

# Grid Features — Mental Model

## feature vs plugin

- FEATURE = declarative config wrapper: a thin module in `libs/grid/src/lib/features/` that registers a factory, giving tree-shakeable opt-in loading.
- PLUGIN = runtime behavior (`extends BaseGridPlugin`) in `libs/grid/src/lib/plugins/`.
- 1:1 mapping — each feature creates exactly one plugin.
- FLOW: `{ features: { selection: 'range' } }` → registry checks the import → factory `SelectionPlugin({ mode: 'range' })` → plugin appended to `gridConfig.plugins`.

## registry ([features/registry.ts](libs/grid/src/lib/features/registry.ts))

- OWNS: `featureRegistry: Map<name, RegistryEntry>` + `warnedFeatures: Set`, persisted on `globalThis` under `Symbol.for('@toolbox-web/grid:feature-registry@<__GRID_VERSION__>/v1')` (and `…-warned@<version>/v1`).
- API: `registerFeature(name, factory, options?)` · `createPluginFromFeature(name, config)` · `createPluginsFromFeatures(obj)` · `isFeatureRegistered(name)`.
- INVARIANT: one factory per feature name; factories run only if the feature module is imported (tree-shaking).
- INVARIANT: the registry is realm-global **per grid version**. Two micro-frontends bundling their own copy at the SAME version share one Map (a side-effect `import '@toolbox-web/grid/features/tree'` from bundle B is visible to the grid class from bundle A); different versions get separate Maps — mirroring the version-suffixed tag isolation in `registerDataGrid()` so v2.14's grid cannot call v2.15's factory.
- DECIDED (planning #9): the registry lives on `globalThis`, not module-local. WHY: the custom-element class is realm-global (first-wins per version) so the running class comes from ONE bundle while feature side-effect imports run in EVERY bundle; module-local Maps fragmented the registry → spurious "Tree-plugin not available!" / TBW031. The key embeds `__GRID_VERSION__`; trailing `/v1` is the slot-shape schema version. Test: `features/registry.spec.ts` → "cross-bundle singleton".
- DECIDED (Jun 2026): the `__GRID_VERSION__` define MUST be applied to EVERY nested programmatic `build()` in [vite.config.ts](libs/grid/vite.config.ts), not just the top-level `defineConfig` — `build({ configFile: false })` does NOT inherit `define`. Before the fix, `features/registry.js` and `plugins/*/index.js` shipped the LITERAL `__GRID_VERSION__` → fell back to `'dev'` → ALL versions collapsed onto one shared `@dev` registry symbol (TBW030 "pinnedColumns re-registered", cross-version factory attach). Fix: a shared `const gridDefine = { __GRID_VERSION__: JSON.stringify(gridVersion) }` referenced by the main config, all nested builds and the `libBuild` helper. VERIFY after build: `grep 'const t=' dist/libs/grid/lib/features/registry.js` shows the real version, never `"dev"`. `version='dev'` is legitimate ONLY when running from source, never in a published artifact.
- DECIDED (May 2026): `registerFeature(name, factory, { override: true })` suppresses the dev-mode TBW030 "re-registered" warning. WHY: adapters (`grid-{vue,react}/src/features/<name>.ts`) intentionally re-register `pinnedRows`, `filtering`, `groupingColumns`, `groupingRows` to wrap the vanilla factory with framework bridging — they side-effect-import the vanilla module first, then re-register with the flag. Muting the warning unconditionally would hide real accidental re-registrations.
- DECIDED (May 2026, manual wins): when `gridConfig.features.<name>` and a manually-instantiated plugin in `gridConfig.plugins` resolve to the same plugin name, the **manual instance wins** and the feature-derived one is dropped before `PluginManager.attachAll` (previously both attached → TBW023 "multiple instances"). Surfaced by the React adapter's `detectChildComponentFeatures` (`libs/grid-react/src/lib/data-grid.tsx`) converting `<GridDetailPanel>`/`<GridResponsiveCard>` children into manual plugins while the user also lists `masterDetail`/`responsive` under `features`. Dedup lives in `Grid.#initializePlugins` ([grid.ts](libs/grid/src/lib/core/grid.ts)). Test: `src/__tests__/integration/features.spec.ts`.
- DECIDED (#400): `createPluginsFromFeatures` orders plugins via a programmatic topological sort (`orderPluginsByDependencies`) reading each plugin's `static dependencies` off `plugin.constructor` — the same metadata `validatePluginDependencies` reads at attach time. Replaces a hardcoded `HOISTED = ['shell','selection','editing']` list that ignored third-party plugins. `features` key order is now irrelevant for any plugin declaring `static dependencies`. DFS post-order, cycle-safe via an `onStack` guard, independents keep config order, edges to non-enabled plugins ignored. Graph keyed by `plugin.name`. GOTCHA: ordering happens AFTER instantiation, so factory CALL order is still config order — tests must assert on the RETURNED array, not factory side-effects. The React adapter delegates to core (`grid-react/src/lib/use-sync-plugins.ts`). Tests: `features/registry.spec.ts`, `feature-registry.spec.ts` "dependency order".
- TENSION: dependencies are convention-driven; the topological sort is cycle-TOLERANT but does not error on a cycle.

## feature-module pattern

```typescript
import { SelectionPlugin, type SelectionConfig } from '../plugins/selection';
import { registerFeature } from './registry';

declare module '../core/types' {
  interface FeatureConfig<TRow> {
    selection?: 'cell' | 'row' | 'range' | SelectionConfig<TRow>;
  }
}

registerFeature('selection', (config) => {
  /* string shortcut → config object */
});

export type _Augmentation = true; // type anchor
```

## enable / disable lifecycle

1. IMPORT-TIME — feature registered only if the module is imported (`import '@toolbox-web/grid/features/selection'`).
2. CONFIG-TIME — enabled via `gridConfig.features`.
3. RUNTIME — plugins cannot be disabled after grid creation (limitation).

- TENSION: users must remember the side-effect import; there are no IDE hints for which imports are needed.

## feature catalog (config shortcuts)

| Feature                | Config shortcut                     | Deps      |
| ---------------------- | ----------------------------------- | --------- |
| `selection`            | `'cell' \| 'row' \| 'range'`        | —         |
| `editing`              | `'click' \| 'dblclick' \| 'manual'` | —         |
| `clipboard`            | `ClipboardConfig`                   | selection |
| `contextMenu`          | `ContextMenuConfig`                 | —         |
| `multiSort`            | `MultiSortConfig`                   | —         |
| `filtering`            | `boolean \| FilterConfig`           | —         |
| `reorderColumns`       | `ReorderConfig`                     | —         |
| `visibility`           | `boolean \| VisibilityConfig`       | shell     |
| `pinnedColumns`        | `boolean`                           | —         |
| `groupingColumns`      | `GroupingColumnsConfig`             | —         |
| `columnVirtualization` | `ColumnVirtualizationConfig`        | —         |
| `reorderRows`          | `RowReorderConfig` (deprecated)     | —         |
| `groupingRows`         | `GroupingRowsConfig`                | —         |
| `pinnedRows`           | `PinnedRowsConfig`                  | —         |
| `tree`                 | `TreeConfig`                        | —         |
| `masterDetail`         | `MasterDetailConfig`                | —         |
| `responsive`           | `ResponsivePluginConfig`            | —         |
| `undoRedo`             | `boolean \| UndoRedoConfig`         | editing   |
| `export`               | `ExportConfig`                      | —         |
| `print`                | `PrintConfig`                       | —         |
| `pivot`                | `PivotConfig`                       | —         |
| `serverSide`           | `ServerSideConfig`                  | —         |
| `tooltip`              | `TooltipConfig`                     | —         |
| `shell`                | `boolean \| ShellConfig`            | —         |

> Full plugin list (incl. `rowDragDrop`, `stickyRows`) → grid-plugins-catalog-data.md / grid-plugins-catalog-ui.md. Shell specifics → grid-plugins-shell.md.

## explicit feature opt-out (validator)

- DECIDED: when `gridConfig.features[name] === false` (**explicit**, not merely absent), `validatePluginProperties` skips all "missing plugin" diagnostics for that plugin's owned properties (`editor`/`editable`/`editorParams` for `editing`, `group` for `groupingColumns`, `pinned` for `pinnedColumns`, …). Lets users keep plugin-owned column properties while toggling the feature off (e.g. read-only mode). An ABSENT feature still throws — only explicit `false` is an informed opt-out.
- INVARIANT: feature name matches plugin `name` 1:1 (the validator relies on it). When adding a plugin-owned property to `KNOWN_COLUMN_PROPERTIES` / `KNOWN_CONFIG_PROPERTIES`, its `pluginName` MUST equal the registered feature key.
- LOCATION: `core/internal/validate-config.ts` → `validatePluginProperties` → `isExplicitlyDisabled()`.
