/**
 * Feature Registry for @toolbox-web/grid-vue
 *
 * Delegates to the core registry at `@toolbox-web/grid/features/registry`.
 * This module re-exports core functions so existing feature modules continue
 * to work without changing their import paths.
 *
 * @example
 * ```typescript
 * // Import features you need (side-effect imports)
 * import '@toolbox-web/grid-vue/features/selection';
 * import '@toolbox-web/grid-vue/features/filtering';
 *
 * // Props work automatically - no async loading, no HTTP requests
 * <TbwGrid :selection="'range'" :filtering="{ debounceMs: 200 }" />
 * ```
 */

// Re-export core registry — all adapters share the same registry Map
export {
  clearFeatureRegistry,
  createPluginFromFeature,
  getFeatureFactory,
  getRegisteredFeatures,
  isFeatureRegistered,
  registerFeature,
} from '@toolbox-web/grid/features/registry';

export type { PluginFactory } from '@toolbox-web/grid/features/registry';

/**
 * Feature names supported by the TbwGrid component.
 */
export type FeatureName =
  | 'selection'
  | 'editing'
  | 'clipboard'
  | 'contextMenu'
  | 'multiSort'
  | 'filtering'
  | 'reorderColumns'
  | 'visibility'
  | 'pinnedColumns'
  | 'groupingColumns'
  | 'columnVirtualization'
  | 'reorderRows'
  | 'rowDragDrop'
  | 'groupingRows'
  | 'pinnedRows'
  | 'tree'
  | 'masterDetail'
  | 'responsive'
  | 'undoRedo'
  | 'export'
  | 'print'
  | 'pivot'
  | 'serverSide'
  | 'tooltip';
