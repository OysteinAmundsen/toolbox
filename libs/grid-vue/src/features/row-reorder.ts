/**
 * Row reorder feature for @toolbox-web/grid-vue
 *
 * Import this module to enable the `rowReorder` prop on TbwGrid.
 *
 * @example
 * ```vue
 * <script setup>
 * import '@toolbox-web/grid-vue/features/row-reorder';
 * </script>
 *
 * <template>
 *   <TbwGrid rowReorder />
 * </template>
 * ```
 *
 * @packageDocumentation
 */

import { RowReorderPlugin } from '@toolbox-web/grid/plugins/row-reorder';
import { registerFeature } from '../lib/feature-registry';

registerFeature('rowReorder', (config) => {
  if (config === true) {
    return new RowReorderPlugin();
  }
  return new RowReorderPlugin(config ?? undefined);
});
