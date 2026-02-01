/**
 * Row grouping feature for @toolbox-web/grid-vue
 *
 * Import this module to enable the `groupingRows` prop on TbwGrid.
 *
 * @example
 * ```vue
 * <script setup>
 * import '@toolbox-web/grid-vue/features/grouping-rows';
 * </script>
 *
 * <template>
 *   <TbwGrid :groupingRows="{
 *     groupBy: ['department', 'team'],
 *     defaultExpanded: true,
 *   }" />
 * </template>
 * ```
 *
 * @packageDocumentation
 */

import { GroupingRowsPlugin } from '@toolbox-web/grid/plugins/grouping-rows';
import { registerFeature } from '../lib/feature-registry';

registerFeature('groupingRows', (config) => {
  return new GroupingRowsPlugin(config ?? undefined);
});
