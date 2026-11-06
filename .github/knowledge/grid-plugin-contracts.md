---
domain: grid-plugin-contracts
related: [grid-plugins, grid-features, adapters, grid-core]
---

# Grid Plugin Contracts

> Scope: cross-cutting plugin configuration, event, locale, ordering, and compatibility contracts.
>
> - Plugin lifecycle and hook mechanics → grid-plugins.md.
> - Feature registration → grid-features.md.
> - Adapter event coverage → adapters.md.
>
> Read order for "a plugin contract is rejected": manifest/dependency rule → owning plugin type → validation.

## localization (`GridConfig.locale`)

- OWNS: `GridConfig.locale?: GridLocale` (flat `Record<string, string>`, `core/types.ts`). `BaseGridPlugin.t(key, fallback)` reads `this.grid?.effectiveConfig?.locale?.[key] ?? fallback`; `BaseGridPlugin.translate` is the bound `Translate` for handing to render modules that have no plugin reference.
- DECIDED (3.5.0, Aug 2026 audit D1): ship **no `DEFAULT_LOCALE` map** — every call site passes its English string inline as the fallback. WHY: a default map would put every plugin's strings in the core bundle regardless of what's loaded, and core is already past the 45 kB gz soft warning; inline fallbacks tree-shake with their plugin and keep the English adjacent to its usage. Measured cost ~0.01 kB gz. Tests: `core/plugin/locale.spec.ts`.
- INVARIANT: lookup uses `??`, not `||` — an intentionally blank translation (`''`) must win over the fallback.
- INVARIANT: `locale` is read live on every call (no snapshot), so swapping `gridConfig.locale` re-localizes on the next render.
- INVARIANT: `locale` is for STATIC labels only. `A11yConfig.messages` stays separate because announcements are functions of runtime values (counts, column names, direction). Do not merge them.
- Render modules with no plugin handle receive the function explicitly: `FilterPanelParams.t` (also makes third-party `filterPanelRenderer`s localizable), `renderPivotPanel(..., t)`, `renderPivotGrandTotalRow(..., t)` — each defaults to `(_key, fallback) => fallback`.
- Keys namespaced by owning plugin: `filter.*` (Filtering), `columns.*` (Visibility), `pinnedColumns.*`, `print.*`, `pivot.*`. Full catalogue: `apps/docs/src/content/docs/grid/guides/i18n.mdx` → "Built-in UI strings".

## event registry (`DataGridEventMap`)

- OWNS: `DataGridEventMap<TRow>` in [core/types.ts](libs/grid/src/lib/core/types.ts) is the SSOT for DOM-visible grid events. Plugins extend it from their own `types.ts`: `declare module '../../core/types' { interface DataGridEventMap { 'foo-bar': FooBarDetail } }`. `keyof DataGridEventMap<TRow>` is the canonical event-name list.
- INVARIANT: emit site and registry MUST agree — an unregistered `_emit('foo-bar')` works at runtime but adapter satisfies-guards reject the prop. NEVER add a synthetic event name just to silence a guard error.
- INVARIANT: register EVERY event the plugin OR its core helpers emit. LESSON (May 2026): `'column-visibility'` is emitted from `config-manager.ts` (`setColumnVisible`/`toggleColumnVisibility`/`showAllColumns`) yet was only registered once added to `plugins/visibility/types.ts`.
- DECIDED (v3): the hand-maintained `DGEvents`/`PluginEvents` string mirrors are REMOVED from `public.ts` (they had drifted — 7 stale `PluginEvents` entries, `CLIPBOARD_COPY` vs `COPY`). Use `keyof DataGridEventMap` + string literals.
- DECIDED (3.4.0): plugin **hook payload** types are public — `public.ts` re-exports `CellClickEvent`, `CellCoords`, `HeaderClickEvent`, `HookName`, `RowClickEvent`, `ScrollEvent` from `./lib/core/plugin`, and they are removed from `libs/grid/typedoc.json > intentionallyNotExported`. WHY: you cannot write a typed `onCellClick`/`onScroll` hook without them. Still internal (in `intentionallyNotExported`): `AggregatorRef, AnyColumn, CellEditor, CellRenderer, DiagnosticCode, FeatureResolverFn, GridElement, HeaderRenderer, PluginConfigRule, PluginIncompatibility, PluginManager, PluginNameMap, PluginPropertyDefinition, RowPosition, ShellState`.

## plugin manifest schema

```
ownedProperties      — property validation rules
hookPriority         — Partial<Record<HookName, number>> (lower = earlier)
configRules          — plugin config validation
incompatibleWith     — warn if both loaded
queries              — query types this plugin handles
events               — event types this plugin emits
modifiesRowStructure — affects the render scheduler
```

- DECIDED (#372, conditional/soft dependencies): `PluginDependency` gained `when?: (pluginConfig: unknown) => boolean` and `severity?: 'error'|'warn'|'info'` alongside `name`/`required`/`reason`. `validatePluginDependencies` (`core/internal/validate-config.ts`) evaluates `dep.when(plugin.resolvedConfig)` FIRST, then `severity ?? (required ? 'error' : undefined)`. Dispatch: error → `throwDiagnostic(MISSING_DEPENDENCY/TBW020)`, warn → `warnDiagnostic(OPTIONAL_DEPENDENCY/TBW021)`, info → `debugDiagnostic(TBW021)`. Default reason verb: error → "requires", warn/info → "recommends". Use case: Pivot needs a shell host only when `showToolPanel === true`.
  - INVARIANT: validation runs BEFORE `plugin.attach()`, so `plugin.config` is not merged yet — `when` reads the `@internal` `BaseGridPlugin.resolvedConfig` getter, which returns `this.config` only while ATTACHED (gated on `#abortController`) and otherwise recomputes `{...defaultConfig, ...userConfig}`. `detach()` does NOT clear `this.config`, so trusting it when detached would leak stale config.
  - INVARIANT: omitted `severity` preserves legacy behavior — hard dep throws, `required:false` stays SILENT (not 'info'); warn/info are dev-only (`isDevelopment()`). Tests: `validate-config.spec.ts` (`config-conditional dependencies`, `explicit severity`).
- DECIDED (#504, provided dependencies): `PluginDependency.provide?: () => BaseGridPlugin`. `PluginManager.attachAll(plugins, gate)` runs `provideDependencies` FIRST: a missing dep (by name, `when` honored) is created once and inserted before its first dependent; provided instances are expanded RECURSIVELY (the claimed-names set is the cycle guard); an explicit instance always wins. `grid.ts` passes `#gateFeatureInstance` as `gate`, so the provided instance is cached per grid and survives plugin re-init. WHY: hard deps must not break plugin-API users (`new TreePlugin()` alone) — the provider must be a STATIC import (no `import()`). Core cost ~80 B gz. Tests: `plugin-manager.spec.ts > provided dependencies`.
- DECIDED (contextMenu): `BaseGridPlugin.refreshUserConfigFrom(other)` (used by the FEATURE-INSTANCE-GATE-370 in `grid.ts` `#gateFeatureInstance`) MUST SNAPSHOT `{...other.userConfig}` BEFORE the delete-all-keys loop on `this.userConfig`. WHY: a feature factory stores the consumer's config BY REFERENCE, so when `gridConfig` is a recomputed Angular `computed()` passing the same object, `cached.userConfig === fresh.userConfig` — clearing the target empties the shared object first and `Object.assign` copies back nothing → config silently wiped (context menu fell back to default Copy/Export items on the feature path only). Tests: `base-plugin.spec.ts` shared-object case + `context-menu-feature-path.spec.ts`.

## hook-priority map

INVARIANT: lower priorities run earlier; this table records cross-plugin ordering constraints.

| Plugin        | Hook             | Priority | Reason                                   |
| ------------- | ---------------- | -------- | ---------------------------------------- |
| ServerSide    | `processRows`    | -10      | provides managedNodes first              |
| PinnedColumns | `processColumns` | -10      | reorder before others (Tree) wrap them   |
| Pivot         | `onHeaderClick`  | -10      | intercept before MultiSort               |
| GroupingRows  | `onHeaderClick`  | -1       | intercept group headers before MultiSort |
| Tree          | `processRows`    | 10       | after ServerSide, before others          |
| GroupingRows  | `processRows`    | 10       | after ServerSide                         |
| Editing       | `processRows`    | 50       | final rows → edit index before reconcile |
| Pivot         | `processRows`    | 100      | after MultiSort, apply aggregation       |

## compatibility

- INVARIANT: incompatible pairs are GroupingRows ↔ Pivot, Tree ↔ Pivot, and ServerSide ↔ Pivot (lazy load vs full dataset).
- INVARIANT: supported pairs include GroupingRows + Tree via HierarchyPlugin (#504, grid-plugins-hierarchy.md); ServerSide + GroupingRows only in pre-defined-groups mode (`setGroups()`/`setGroupRows()`); ServerSide + Tree (Tree has its own `dataSource`); MasterDetail + GroupingRows (skips `__isGroupRow`); Responsive + GroupingRows (same); and Pivot + MultiSort (Pivot queries the sort model, `processRows` at priority 100).
