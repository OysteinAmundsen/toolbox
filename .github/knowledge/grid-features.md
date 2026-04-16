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

- OWNS: global featureRegistry Map<name, RegistryEntry>, warnedFeatures Set
- READS FROM: user FeatureConfig object, PLUGIN_DEPENDENCIES declarations
- WRITES TO: registry entries on import, console diagnostics in dev
- INVARIANT: each feature name maps to exactly one factory
- INVARIANT: factories only execute if feature module is imported (tree-shaking)
- API: registerFeature(name, factory) | createPluginFromFeature(name, config) | createPluginsFromFeatures(obj) | isFeatureRegistered(name)
- TENSION: no hard validation of dependencies — relies on convention. Circular deps not prevented

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
