/**
 * Column reorder feature for @toolbox-web/grid-vue
 *
 * Import this module to enable the `reorder` prop on TbwGrid.
 *
 * @example
 * ```vue
 * <script setup>
 * import '@toolbox-web/grid-vue/features/reorder';
 * </script>
 *
 * <template>
 *   <TbwGrid reorder />
 * </template>
 * ```
 *
 * @packageDocumentation
 */

import { ReorderPlugin } from '@toolbox-web/grid/plugins/reorder';
import { registerFeature } from '../lib/feature-registry';

registerFeature('reorder', (config) => {
  if (config === true) {
    return new ReorderPlugin();
  }
  return new ReorderPlugin(config ?? undefined);
});
