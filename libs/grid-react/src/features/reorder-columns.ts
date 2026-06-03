/**
 * Column Reorder feature for @toolbox-web/grid-react
 *
 * Import this module to enable the `reorderColumns` prop on DataGrid.
 *
 * @example
 * ```tsx
 * import '@toolbox-web/grid-react/features/reorder-columns';
 *
 * <DataGrid reorderColumns />
 * ```
 *
 * @packageDocumentation
 */

// Delegate to core feature registration
import '@toolbox-web/grid/features/reorder-columns';
// Named type re-export surfaces the core `FeatureConfig` augmentation to dist
// consumers — a bare side-effect import alone is stripped from the emitted
// `.d.ts`. See `.github/knowledge/adapters.md`.
export type { _Augmentation as _ReorderColumnsAugmentation } from '@toolbox-web/grid/features/reorder-columns';
