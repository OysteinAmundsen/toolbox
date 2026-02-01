/**
 * Export feature for @toolbox-web/grid-vue
 *
 * Import this module to enable the `export` prop on TbwGrid.
 *
 * @example
 * ```vue
 * <script setup>
 * import '@toolbox-web/grid-vue/features/export';
 * </script>
 *
 * <template>
 *   <TbwGrid export />
 * </template>
 * ```
 *
 * @packageDocumentation
 */

import { ExportPlugin } from '@toolbox-web/grid/plugins/export';
import { registerFeature } from '../lib/feature-registry';

registerFeature('export', (config) => {
  if (config === true) {
    return new ExportPlugin();
  }
  return new ExportPlugin(config ?? undefined);
});
