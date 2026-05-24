/**
 * Feature Registry for @toolbox-web/grid-angular
 *
 * Delegates to the core registry at `@toolbox-web/grid/features/registry`.
 * This module re-exports core functions so existing feature modules continue
 * to work without changing their import paths.
 *
 * @example
 * ```typescript
 * // Import features you need (side-effect imports)
 * import '@toolbox-web/grid-angular/features/selection';
 * import '@toolbox-web/grid-angular/features/filtering';
 *
 * // Inputs work automatically - no async loading, no HTTP requests
 * <tbw-grid [selection]="'range'" [filtering]="{ debounceMs: 200 }" />
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
 * Feature names supported by the Grid directive.
 *
 * NOTE: This is intentionally still a hand-listed union (rather than
 * `keyof FeatureConfig`) because the Angular adapter does **not** currently
 * side-effect-import any `@toolbox-web/grid/features/*` modules. Without
 * those imports, the `FeatureConfig` augmentations declared by each feature
 * are invisible to ng-packagr's partial-compilation typecheck and
 * `keyof FeatureConfig` collapses to its empty-interface sentinel
 * (`'__brand'`), breaking every directive input that accepts a `FeatureName`.
 *
 * Switching to `keyof FeatureConfig` (gh #356 phase 1, parity with the
 * React/Vue adapters) is therefore deferred until Angular gains either
 * auto-registration of feature modules or a types-only augmentation entry
 * point — tracked as a follow-up on issue #356. The spec file enforces this
 * union is at least a superset of the prior shape.
 *
 * @since 0.6.0
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
  | 'stickyRows'
  | 'tooltip';
