/**
 * Tooltip feature for @toolbox-web/grid-react
 *
 * Import this module to enable the `tooltip` prop on DataGrid.
 *
 * @example
 * ```tsx
 * import '@toolbox-web/grid-react/features/tooltip';
 * import { DataGrid } from '@toolbox-web/grid-react';
 *
 * <DataGrid rows={data} columns={columns} tooltip />
 * ```
 *
 * @packageDocumentation
 */

// Delegate to core feature registration
import '@toolbox-web/grid/features/tooltip';
// Named type re-export surfaces the core `FeatureConfig` augmentation to dist
// consumers — a bare side-effect import alone is stripped from the emitted
// `.d.ts`. See `.github/knowledge/adapters.md`.
export type { _Augmentation as _TooltipAugmentation } from '@toolbox-web/grid/features/tooltip';
