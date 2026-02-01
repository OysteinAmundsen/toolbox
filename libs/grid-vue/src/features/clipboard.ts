/**
 * Clipboard feature for @toolbox-web/grid-vue
 *
 * Import this module to enable the `clipboard` prop on TbwGrid.
 *
 * @example
 * ```vue
 * <script setup>
 * import '@toolbox-web/grid-vue/features/clipboard';
 * </script>
 *
 * <template>
 *   <TbwGrid selection="range" clipboard />
 * </template>
 * ```
 *
 * @packageDocumentation
 */

import { ClipboardPlugin } from '@toolbox-web/grid/plugins/clipboard';
import { registerFeature } from '../lib/feature-registry';

registerFeature('clipboard', (config) => {
  if (config === true) {
    return new ClipboardPlugin();
  }
  return new ClipboardPlugin(config ?? undefined);
});
