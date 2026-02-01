/**
 * Column visibility feature for @toolbox-web/grid-vue
 *
 * Import this module to enable the `visibility` prop on TbwGrid.
 *
 * @example
 * ```vue
 * <script setup>
 * import '@toolbox-web/grid-vue/features/visibility';
 * </script>
 *
 * <template>
 *   <TbwGrid visibility />
 * </template>
 * ```
 *
 * @packageDocumentation
 */

import { VisibilityPlugin } from '@toolbox-web/grid/plugins/visibility';
import { registerFeature } from '../lib/feature-registry';

registerFeature('visibility', (config) => {
  if (config === true) {
    return new VisibilityPlugin();
  }
  return new VisibilityPlugin(config ?? undefined);
});
