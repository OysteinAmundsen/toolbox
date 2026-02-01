/**
 * Pinned rows feature for @toolbox-web/grid-vue
 *
 * Import this module to enable the `pinnedRows` prop on TbwGrid.
 *
 * @example
 * ```vue
 * <script setup>
 * import '@toolbox-web/grid-vue/features/pinned-rows';
 * </script>
 *
 * <template>
 *   <TbwGrid :pinnedRows="{
 *     bottom: [{ type: 'aggregation', aggregator: 'sum' }],
 *   }" />
 * </template>
 * ```
 *
 * @packageDocumentation
 */

import { PinnedRowsPlugin } from '@toolbox-web/grid/plugins/pinned-rows';
import { registerFeature } from '../lib/feature-registry';

registerFeature('pinnedRows', (config) => {
  if (config === true) {
    return new PinnedRowsPlugin();
  }
  return new PinnedRowsPlugin(config ?? undefined);
});
