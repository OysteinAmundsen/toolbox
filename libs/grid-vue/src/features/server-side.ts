/**
 * Server-side feature for @toolbox-web/grid-vue
 *
 * Import this module to enable the `serverSide` prop on TbwGrid.
 *
 * @example
 * ```vue
 * <script setup>
 * import '@toolbox-web/grid-vue/features/server-side';
 * </script>
 *
 * <template>
 *   <TbwGrid :serverSide="{
 *     dataSource: async (params) => fetchData(params),
 *   }" />
 * </template>
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
