/**
 * Row reorder feature for @toolbox-web/grid-vue
 *
 * Import this module to enable the `reorderRows` prop on TbwGrid.
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

import { RowReorderPlugin } from '@toolbox-web/grid/plugins/reorder-rows';
import { registerFeature } from '../lib/feature-registry';

const factory = (config: unknown) => {
  if (config === true) {
    return new RowReorderPlugin();
  }
  return new RowReorderPlugin(config ?? undefined);
};

// Primary name
registerFeature('reorderRows', factory);
// Deprecated alias
registerFeature('rowReorder', factory);
