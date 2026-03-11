/**
 * Column reorder feature for @toolbox-web/grid-vue
 *
 * Import this module to enable the `reorderColumns` prop on TbwGrid.
 *
 * @example
 * ```vue
 * <script setup>
 * import '@toolbox-web/grid-vue/features/reorder-columns';
 * </script>
 *
 * <template>
 *   <TbwGrid reorder-columns />
 * </template>
 * ```
 *
 * @packageDocumentation
 */

import { ReorderPlugin } from '@toolbox-web/grid/plugins/reorder-columns';
import { registerFeature } from '../lib/feature-registry';

const factory = (config: unknown) => {
  if (config === true) {
    return new ReorderPlugin();
  }
  return new ReorderPlugin(config ?? undefined);
};

// Primary name
registerFeature('reorderColumns', factory);
// Deprecated alias
registerFeature('reorder', factory);
