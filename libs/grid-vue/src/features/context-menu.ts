/**
 * Context menu feature for @toolbox-web/grid-vue
 *
 * Import this module to enable the `contextMenu` prop on TbwGrid.
 *
 * @example
 * ```vue
 * <script setup>
 * import '@toolbox-web/grid-vue/features/context-menu';
 * </script>
 *
 * <template>
 *   <TbwGrid contextMenu />
 * </template>
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
