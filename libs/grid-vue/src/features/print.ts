/**
 * Print feature for @toolbox-web/grid-vue
 *
 * Import this module to enable the `print` prop on TbwGrid.
 *
 * @example
 * ```vue
 * <script setup>
 * import '@toolbox-web/grid-vue/features/print';
 * </script>
 *
 * <template>
 *   <TbwGrid print />
 * </template>
 * ```
 *
 * @packageDocumentation
 */

import { PrintPlugin } from '@toolbox-web/grid/plugins/print';
import { registerFeature } from '../lib/feature-registry';

registerFeature('print', (config) => {
  if (config === true) {
    return new PrintPlugin();
  }
  return new PrintPlugin(config ?? undefined);
});
