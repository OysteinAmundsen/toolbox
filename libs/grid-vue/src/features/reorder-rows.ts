/**
 * Row reorder feature for @toolbox-web/grid-vue
 *
 * Import this module to enable the `reorderRows` prop on TbwGrid.
 *
 * @deprecated v1.x — slated for removal in `@toolbox-web/grid-vue` 2.0.0
 * (coordinated v3.0.0 release, see gh #262 / #263). Use the `rowDragDrop`
 * prop and import `@toolbox-web/grid-vue/features/row-drag-drop` instead.
 *
 * @example
 * ```vue
 * <script setup>
 * import '@toolbox-web/grid-vue/features/reorder-rows';
 * </script>
 *
 * <template>
 *   <TbwGrid reorder-rows />
 * </template>
 * ```
 *
 * @packageDocumentation
 */

// Delegate to core feature registration
import '@toolbox-web/grid/features/reorder-rows';
// Named type re-export surfaces the core `FeatureConfig` augmentation to dist
// consumers — a bare side-effect import alone is stripped from the emitted
// `.d.ts`. See `.github/knowledge/adapters.md`.
export type { _Augmentation as _ReorderRowsAugmentation } from '@toolbox-web/grid/features/reorder-rows';
