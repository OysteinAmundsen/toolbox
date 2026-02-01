/**
 * Context menu feature for @toolbox-web/grid-vue
 *
 * Import this module to enable the `contextMenu` prop on TbwGrid.
 *
 * @example
 * ```vue
 * <script setup>
 * import '@toolbox-web/grid-vue/features/context-menu';
 * </script>
 *
 * <template>
 *   <TbwGrid contextMenu />
 * </template>
 * ```
 *
 * @packageDocumentation
 */

import { ContextMenuPlugin } from '@toolbox-web/grid/plugins/context-menu';
import { registerFeature } from '../lib/feature-registry';

registerFeature('contextMenu', (config) => {
  if (config === true) {
    return new ContextMenuPlugin();
  }
  return new ContextMenuPlugin(config ?? undefined);
});
