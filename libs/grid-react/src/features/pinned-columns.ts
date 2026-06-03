/**
 * Pinned Columns feature for @toolbox-web/grid-react
 *
 * Import this module to enable the `pinnedColumns` prop on DataGrid.
 *
 * @example
 * ```tsx
 * import '@toolbox-web/grid-react/features/pinned-columns';
 *
 * <DataGrid pinnedColumns />
 * ```
 *
 * @packageDocumentation
 */

// Delegate to core feature registration
import '@toolbox-web/grid/features/pinned-columns';
// Named type re-export surfaces the core `FeatureConfig` augmentation to dist
// consumers — a bare side-effect import alone is stripped from the emitted
// `.d.ts`. See `.github/knowledge/adapters.md`.
export type { _Augmentation as _PinnedColumnsAugmentation } from '@toolbox-web/grid/features/pinned-columns';
