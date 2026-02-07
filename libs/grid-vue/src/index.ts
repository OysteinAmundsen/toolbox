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
 * - Composables: useGrid(), useGridEvent()
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
export { default as TbwGridResponsiveCard } from './lib/TbwGridResponsiveCard.vue';
export { default as TbwGridToolButtons } from './lib/TbwGridToolButtons.vue';
export { default as TbwGridToolPanel } from './lib/TbwGridToolPanel.vue';

// Context types for slots
export type { DetailPanelContext } from './lib/detail-panel-registry';
export type { ResponsiveCardContext } from './lib/responsive-card-registry';
export type { CellSlotProps, EditorSlotProps } from './lib/slot-types';
export type { ToolPanelContext } from './lib/tool-panel-registry';

// Vue grid adapter
export { GridAdapter } from './lib/vue-grid-adapter';
/** @deprecated Use `GridAdapter` instead */
export { VueGridAdapter } from './lib/vue-grid-adapter';

// Composables
export { GRID_ELEMENT_KEY, useGrid } from './lib/use-grid';
export type { UseGridReturn } from './lib/use-grid';

export { useGridEvent } from './lib/use-grid-event';
export type { GridEventMap } from './lib/use-grid-event';

// Configuration types - use unified names (GridConfig, ColumnConfig, CellRenderer, etc.)
export type {
  // Primary exports - use these
  CellEditor,
  CellRenderer,
  ColumnConfig,
  GridConfig,
  // Deprecated names - use unified names instead
  /** @deprecated Use `CellEditor` instead */
  VueCellEditor,
  /** @deprecated Use `CellRenderer` instead */
  VueCellRenderer,
  /** @deprecated Use `ColumnConfig` instead */
  VueColumnConfig,
  /** @deprecated Use `GridConfig` instead */
  VueGridConfig,
} from './lib/vue-column-config';

// Feature props types for declarative plugin configuration
export type { AllFeatureProps, FeatureProps } from './lib/feature-props';

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
export type {
  GridTypeProviderProps,
  // Primary export
  TypeDefault,
  TypeDefaultsMap,
  // Deprecated - use TypeDefault instead
  /** @deprecated Use `TypeDefault` instead */
  VueTypeDefault,
} from './lib/grid-type-registry';

// Icon registry for application-wide icon overrides
export { GRID_ICONS, GridIconProvider, useGridIcons } from './lib/grid-icon-registry';
export type { GridIconProviderProps } from './lib/grid-icon-registry';

// Combined provider for type defaults and icons
export { GridProvider } from './lib/grid-provider';
export type { GridProviderProps } from './lib/grid-provider';
