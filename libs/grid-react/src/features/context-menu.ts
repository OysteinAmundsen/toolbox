/**
 * Context Menu feature for @toolbox-web/grid-react
 *
 * Import this module to enable the `contextMenu` prop on DataGrid.
 *
 * @example
 * ```tsx
 * import '@toolbox-web/grid-react/features/context-menu';
 *
 * <DataGrid contextMenu />
 * ```
 *
 * @packageDocumentation
 */

// Delegate to core feature registration
import '@toolbox-web/grid/features/context-menu';
// Named type re-export surfaces the core `FeatureConfig` augmentation to dist
// consumers — a bare side-effect import alone is stripped from the emitted
// `.d.ts`. See `.github/knowledge/adapters.md`.
export type { _Augmentation as _ContextMenuAugmentation } from '@toolbox-web/grid/features/context-menu';
