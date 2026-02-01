/**
 * Responsive feature for @toolbox-web/grid-vue
 *
 * Import this module to enable the `responsive` prop on TbwGrid.
 *
 * @example
 * ```vue
 * <script setup>
 * import '@toolbox-web/grid-vue/features/responsive';
 * import { h } from 'vue';
 * </script>
 *
 * <template>
 *   <TbwGrid :responsive="{
 *     breakpoint: 768,
 *     cardRenderer: (row) => h(EmployeeCard, { employee: row }),
 *   }" />
 * </template>
 * ```
 *
 * @packageDocumentation
 */

import { ResponsivePlugin } from '@toolbox-web/grid/plugins/responsive';
import { registerFeature } from '../lib/feature-registry';

registerFeature('responsive', (config) => {
  if (config === true) {
    return new ResponsivePlugin();
  }
  return new ResponsivePlugin(config ?? undefined);
});
