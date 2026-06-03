/**
 * Tree view feature for @toolbox-web/grid-vue
 *
 * Import this module to enable the `tree` prop on TbwGrid.
 *
 * @example
 * ```vue
 * <script setup>
 * import '@toolbox-web/grid-vue/features/tree';
 * </script>
 *
 * <template>
 *   <TbwGrid :tree="{
 *     childrenField: 'children',
 *     defaultExpanded: true,
 *   }" />
 * </template>
 * ```
 *
 * @packageDocumentation
 */

// Delegate to core feature registration
import '@toolbox-web/grid/features/tree';
// Named type re-export surfaces the core `FeatureConfig` augmentation to dist
// consumers — a bare side-effect import alone is stripped from the emitted
// `.d.ts`. See `.github/knowledge/adapters.md`.
export type { _Augmentation as _TreeAugmentation } from '@toolbox-web/grid/features/tree';
