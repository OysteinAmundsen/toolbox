/**
 * Editing feature for @toolbox-web/grid-vue
 *
 * Import this module to enable the `editing` prop on TbwGrid.
 *
 * @example
 * ```vue
 * <script setup>
 * import '@toolbox-web/grid-vue/features/editing';
 * </script>
 *
 * <template>
 *   <TbwGrid editing="dblclick" />
 * </template>
 * ```
 *
 * @packageDocumentation
 */

import { EditingPlugin } from '@toolbox-web/grid/plugins/editing';
import { registerFeature } from '../lib/feature-registry';

registerFeature('editing', (config) => {
  // Handle shorthand: true, 'click', 'dblclick', 'manual'
  if (config === true) {
    return new EditingPlugin(); // default trigger
  }
  if (config === 'click' || config === 'dblclick' || config === 'manual') {
    return new EditingPlugin({ editOn: config });
  }
  // Full config object
  return new EditingPlugin(config ?? undefined);
});
