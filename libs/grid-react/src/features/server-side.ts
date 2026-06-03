/**
 * Server-side feature for @toolbox-web/grid-react
 *
 * Import this module to enable the `serverSide` prop on DataGrid.
 *
 * @example
 * ```tsx
 * import '@toolbox-web/grid-react/features/server-side';
 *
 * <DataGrid serverSide={{ dataSource: async (params) => fetchData(params) }} />
 * ```
 *
 * @packageDocumentation
 */

// Delegate to core feature registration
import '@toolbox-web/grid/features/server-side';
// Named type re-export surfaces the core `FeatureConfig` augmentation to dist
// consumers — a bare side-effect import alone is stripped from the emitted
// `.d.ts`. See `.github/knowledge/adapters.md`.
export type { _Augmentation as _ServerSideAugmentation } from '@toolbox-web/grid/features/server-side';
