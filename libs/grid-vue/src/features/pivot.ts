/**
 * Pivot feature for @toolbox-web/grid-vue
 *
 * Import this module to enable the `pivot` prop on TbwGrid.
 *
 * @example
 * ```vue
 * <script setup>
 * import '@toolbox-web/grid-vue/features/pivot';
 * </script>
 *
 * <template>
 *   <TbwGrid :pivot="{
 *     rowFields: ['category'],
 *     columnFields: ['year'],
 *     valueField: 'sales',
 *   }" />
 * </template>
 * ```
 *
 * @packageDocumentation
 */

// Delegate to core feature registration
import '@toolbox-web/grid/features/pivot';
// Named type re-export surfaces the core `FeatureConfig` augmentation to dist
// consumers — a bare side-effect import alone is stripped from the emitted
// `.d.ts`. See `.github/knowledge/adapters.md`.
export type { _Augmentation as _PivotAugmentation } from '@toolbox-web/grid/features/pivot';
