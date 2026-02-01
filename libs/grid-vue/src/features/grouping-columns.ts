/**
 * Column grouping feature for @toolbox-web/grid-vue
 *
 * Import this module to enable the `groupingColumns` prop on TbwGrid.
 *
 * @example
 * ```vue
 * <script setup>
 * import '@toolbox-web/grid-vue/features/grouping-columns';
 * </script>
 *
 * <template>
 *   <TbwGrid :groupingColumns="{
 *     columnGroups: [
 *       { header: 'Personal Info', children: ['firstName', 'lastName'] },
 *     ],
 *   }" />
 * </template>
 * ```
 *
 * @packageDocumentation
 */

import { GroupingColumnsPlugin } from '@toolbox-web/grid/plugins/grouping-columns';
import { registerFeature } from '../lib/feature-registry';

registerFeature('groupingColumns', (config) => {
  if (config === true) {
    return new GroupingColumnsPlugin();
  }
  return new GroupingColumnsPlugin(config ?? undefined);
});
