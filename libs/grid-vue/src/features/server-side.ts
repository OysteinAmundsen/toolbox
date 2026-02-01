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

import { ServerSidePlugin } from '@toolbox-web/grid/plugins/server-side';
import { registerFeature } from '../lib/feature-registry';

registerFeature('serverSide', (config) => {
  return new ServerSidePlugin(config ?? undefined);
});
