/**
 * Master-detail feature for @toolbox-web/grid-vue
 *
 * Import this module to enable the `masterDetail` prop on TbwGrid.
 *
 * @example
 * ```vue
 * <script setup>
 * import '@toolbox-web/grid-vue/features/master-detail';
 * import { h } from 'vue';
 * </script>
 *
 * <template>
 *   <TbwGrid :masterDetail="{
 *     renderer: (row) => h(OrderDetails, { order: row }),
 *   }" />
 * </template>
 * ```
 *
 * @packageDocumentation
 */

import { MasterDetailPlugin } from '@toolbox-web/grid/plugins/master-detail';
import { registerFeature } from '../lib/feature-registry';

registerFeature('masterDetail', (config) => {
  return new MasterDetailPlugin(config ?? undefined);
});
