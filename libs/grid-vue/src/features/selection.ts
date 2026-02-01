/**
 * Selection feature for @toolbox-web/grid-vue
 *
 * Import this module to enable the `selection` prop on TbwGrid.
 *
 * @example
 * ```vue
 * <script setup>
 * import '@toolbox-web/grid-vue/features/selection';
 * </script>
 *
 * <template>
 *   <TbwGrid selection="range" />
 * </template>
 * ```
 *
 * @packageDocumentation
 */

import { SelectionPlugin } from '@toolbox-web/grid/plugins/selection';
import { registerFeature } from '../lib/feature-registry';

registerFeature('selection', (config) => {
  // Handle shorthand: 'cell', 'row', 'range'
  if (config === 'cell' || config === 'row' || config === 'range') {
    return new SelectionPlugin({ mode: config });
  }
  // Full config object
  return new SelectionPlugin(config ?? undefined);
});
