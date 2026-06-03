/**
 * Pinned columns feature for @toolbox-web/grid-vue
 *
 * Import this module to enable the `pinnedColumns` prop on TbwGrid.
 *
 * @example
 * ```vue
 * <script setup>
 * import '@toolbox-web/grid-vue/features/pinned-columns';
 * </script>
 *
 * <template>
 *   <TbwGrid pinnedColumns :columns="[
 *     { field: 'id', pinned: 'left' },
 *     { field: 'name' },
 *   ]" />
 * </template>
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
