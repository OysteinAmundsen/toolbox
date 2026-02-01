/**
 * Filtering feature for @toolbox-web/grid-vue
 *
 * Import this module to enable the `filtering` prop on TbwGrid.
 *
 * @example
 * ```vue
 * <script setup>
 * import '@toolbox-web/grid-vue/features/filtering';
 * </script>
 *
 * <template>
 *   <TbwGrid filtering />
 * </template>
 * ```
 *
 * @packageDocumentation
 */

import { FilteringPlugin } from '@toolbox-web/grid/plugins/filtering';
import { registerFeature } from '../lib/feature-registry';

registerFeature('filtering', (config) => {
  if (config === true) {
    return new FilteringPlugin();
  }
  return new FilteringPlugin(config ?? undefined);
});
