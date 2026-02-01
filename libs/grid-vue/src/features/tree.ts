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

import { TreePlugin } from '@toolbox-web/grid/plugins/tree';
import { registerFeature } from '../lib/feature-registry';

registerFeature('tree', (config) => {
  if (config === true) {
    return new TreePlugin();
  }
  return new TreePlugin(config ?? undefined);
});
