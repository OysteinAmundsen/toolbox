/**
 * TypeDoc entry point for @toolbox-web/grid-vue.
 *
 * This file excludes Vue SFC components (which TypeDoc cannot parse) and only
 * exports TypeScript-based APIs: composables, types, registries, and adapters.
 *
 * For component documentation, see the GettingStarted.mdx and AdvancedUsage.mdx guides.
 *
 * @packageDocumentation
 * @module @toolbox-web/grid-vue
 */

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

// Vue-specific config types - unified names (primary)
export type {
  CellEditor,
  CellRenderer,
  ColumnConfig,
  GridConfig,
  // Vue-specific config types - deprecated aliases
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
export type { GridTypeProviderProps, TypeDefault, TypeDefaultsMap, VueTypeDefault } from './lib/grid-type-registry';

// Icon registry for application-wide icon overrides
export { GRID_ICONS, GridIconProvider, useGridIcons } from './lib/grid-icon-registry';
export type { GridIconProviderProps } from './lib/grid-icon-registry';

// Combined provider for type defaults and icons
export { GridProvider } from './lib/grid-provider';
export type { GridProviderProps } from './lib/grid-provider';
