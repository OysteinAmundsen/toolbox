/**
 * Sticky Rows feature for @toolbox-web/grid-react
 *
 * Import this module to enable the `stickyRows` prop on DataGrid.
 *
 * @example
 * ```tsx
 * import '@toolbox-web/grid-react/features/sticky-rows';
 *
 * <DataGrid stickyRows={{ isSticky: 'isSection' }} />
 * ```
 *
 * @packageDocumentation
 */

// Delegate to core feature registration
import '@toolbox-web/grid/features/sticky-rows';
// Named type re-export surfaces the core `FeatureConfig` augmentation to dist
// consumers — a bare side-effect import alone is stripped from the emitted
// `.d.ts`. See `.github/knowledge/adapters.md`.
export type { _Augmentation as _StickyRowsAugmentation } from '@toolbox-web/grid/features/sticky-rows';
