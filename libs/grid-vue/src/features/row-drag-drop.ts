/**
 * Row Drag & Drop feature for @toolbox-web/grid-vue
 *
 * Import this module to enable the `rowDragDrop` prop on TbwGrid and the
 * associated emits (`@row-drag-start`, `@row-drag-end`, `@row-drop`,
 * `@row-transfer`). Supports both intra-grid reorder and cross-grid transfer.
 *
 * @example
 * ```ts
 * import '@toolbox-web/grid-vue/features/row-drag-drop';
 * ```
 *
 * ```vue
 * <TbwGrid :row-drag-drop="{ dropZone: 'employees' }" />
 * ```
 *
 * @packageDocumentation
 */

// Delegate to core feature registration
import '@toolbox-web/grid/features/row-drag-drop';
// Named type re-export surfaces the core `FeatureConfig` augmentation to dist
// consumers — a bare side-effect import alone is stripped from the emitted
// `.d.ts`. See `.github/knowledge/adapters.md`.
export type { _Augmentation as _RowDragDropAugmentation } from '@toolbox-web/grid/features/row-drag-drop';
