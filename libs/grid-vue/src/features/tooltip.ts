/**
 * Tooltip feature for @toolbox-web/grid-vue
 *
 * Import this module to enable the `tooltip` prop on TbwGrid.
 *
 * @example
 * ```vue
 * <script setup>
 * import '@toolbox-web/grid-vue/features/tooltip';
 * </script>
 *
 * <template>
 *   <TbwGrid :tooltip="true" />
 * </template>
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
