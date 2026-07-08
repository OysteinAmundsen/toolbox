/**
 * @packageDocumentation
 * @toolbox-web/grid-vue - Vue 3 adapter for @toolbox-web/grid.
 *
 * Vue 3 adapter library providing:
 * - TbwGrid wrapper component with reactive props and feature props
 * - TbwGridColumn for declarative column definitions with slots
 * - Slot-based renderers: `<template #cell="{ value, row }">`
 * - Slot-based editors: `<template #editor="{ value, commit, cancel }">`
 * - TbwGridDetailPanel for master-detail layouts
 * - TbwGridToolPanel for custom sidebar panels
 * - TbwGridResponsiveCard for responsive card layouts
 * - GridTypeProvider for application-wide type defaults
 * - GridIconProvider for application-wide icon overrides
 * - Feature props: selection, editing, filtering, etc. (tree-shakeable)
 * - Composables: useGrid()
 * - TypeScript generics for row type safety
 *
 * @example
 * ```vue
 * <script setup lang="ts">
 * import { TbwGrid, TbwGridColumn } from '@toolbox-web/grid-vue';
 * import '@toolbox-web/grid-vue/features/selection';
 * import { ref } from 'vue';
 *
 * interface Employee { id: number; name: string; status: string; }
 * const employees = ref<Employee[]>([...]);
 * </script>
 *
 * <template>
 *   <TbwGrid :rows="employees" selection="range">
 *     <TbwGridColumn field="name" header="Name" />
 *     <TbwGridColumn field="status" header="Status">
 *       <template #cell="{ value }">
 *         <StatusBadge :value="value" />
 *       </template>
 *     </TbwGridColumn>
 *   </TbwGrid>
 * </template>
 * ```
 */

// Main components
export { default as TbwGrid } from './lib/TbwGrid.vue';
export { default as TbwGridColumn } from './lib/TbwGridColumn.vue';
export { default as TbwGridDetailPanel } from './lib/TbwGridDetailPanel.vue';
export { default as TbwGridHeaderContent } from './lib/TbwGridHeaderContent.vue';
export { default as TbwGridResponsiveCard } from './lib/TbwGridResponsiveCard.vue';
export { default as TbwGridToolbarContent } from './lib/TbwGridToolbarContent.vue';
export { default as TbwGridToolButtons } from './lib/TbwGridToolButtons.vue';
export { default as TbwGridToolPanel } from './lib/TbwGridToolPanel.vue';
export { default as TbwGridType } from './lib/TbwGridType.vue';

// Context types for slots
export type { DetailPanelContext } from './lib/detail-panel-registry';
export type { ResponsiveCardContext } from './lib/responsive-card-registry';
export type {
  CellSlotProps,
  EditorSlotProps,
  GridCellContext,
  GridEditorContext,
  HeaderLabelSlotProps,
  HeaderSlotProps,
} from './lib/slot-types';
export type { ToolPanelContext } from './lib/tool-panel-registry';

// Vue grid adapter
export { GridAdapter, isVueComponent } from './lib/vue-grid-adapter';

// Composables
export { GRID_ELEMENT_KEY, useGrid } from './lib/use-grid';
export type { UseGridReturn } from './lib/use-grid';
export { useGridOverlay } from './lib/use-grid-overlay';
export type { UseGridOverlayOptions } from './lib/use-grid-overlay';

// Column shorthand utilities
export {
  applyColumnDefaults,
  hasColumnShorthands,
  normalizeColumns,
  parseColumnShorthand,
} from './lib/column-shorthand';
export type { ColumnShorthand } from './lib/column-shorthand';

// Configuration types
export type { CellEditor, CellRenderer, ColumnConfig, GridConfig } from './lib/vue-column-config';

// Feature props types for declarative plugin configuration
export type {
  AllFeatureProps,
  // Canonical (unprefixed) adapter-widened config types. Same names as the
  // core types from `@toolbox-web/grid` — these accept Vue render functions
  // in addition to the vanilla `HTMLElement`-returning ones.
  ColumnGroupDefinition,
  FeatureProps,
  FilterConfig,
  GroupingColumnsConfig,
  GroupingRowsConfig,
  MasterDetailConfig,
  PanelRender,
  PanelSlot,
  PinnedRowSlot,
  PinnedRowsConfig,
  ResponsivePluginConfig,
  // Deprecated framework-prefixed aliases — kept for backwards compatibility.
  VueColumnGroupDefinition,
  VueFilterConfig,
  VueGroupingColumnsConfig,
  VueGroupingRowsConfig,
  VuePanelRender,
  VuePanelSlot,
  VuePinnedRowSlot,
  VuePinnedRowsConfig,
  VueZonedPanelRender,
  ZonedPanelRender,
} from './lib/feature-props';

// Feature registry for tree-shakeable plugin registration
export {
  clearFeatureRegistry,
  createPluginFromFeature,
  getFeatureFactory,
  getRegisteredFeatures,
  isFeatureRegistered,
  registerFeature,
} from './lib/feature-registry';
export type { FeatureName, PluginFactory } from './lib/feature-registry';

// Type registry for application-wide type defaults
export { GRID_TYPE_DEFAULTS, GridTypeProvider, useGridTypeDefaults, useTypeDefault } from './lib/grid-type-registry';
export type { GridTypeProviderProps, TypeDefault, TypeDefaultsMap } from './lib/grid-type-registry';

// Icon registry for application-wide icon overrides
export { GRID_ICONS, GridIconProvider, useGridIcons } from './lib/grid-icon-registry';
export type { GridIconProviderProps } from './lib/grid-icon-registry';

// Combined provider for type defaults and icons
export { GridProvider } from './lib/grid-provider';
export type { GridProviderProps } from './lib/grid-provider';

// Cross-adapter registry surface (gh #356 §8). Each adapter ships only the
// registries its shell actually invokes — same export names exist on
// `@toolbox-web/grid-react` and `@toolbox-web/grid-angular` where applicable.
// Asserted by `vue-grid-adapter.registry-parity.spec.ts`.
export { registerEditorMountHook, registerFeaturePropKey, registerPostMountRefresh } from './lib/vue-grid-adapter';
export type { EditorMountHook, PostMountRefreshHook } from './lib/vue-grid-adapter';
