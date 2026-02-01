/**
 * Column virtualization feature for @toolbox-web/grid-vue
 *
 * Import this module to enable the `columnVirtualization` prop on TbwGrid.
 *
 * @example
 * ```vue
 * <script setup>
 * import '@toolbox-web/grid-vue/features/column-virtualization';
 * </script>
 *
 * <template>
 *   <TbwGrid columnVirtualization />
 * </template>
 * ```
 *
 * @packageDocumentation
 */

import { ColumnVirtualizationPlugin } from '@toolbox-web/grid/plugins/column-virtualization';
import { registerFeature } from '../lib/feature-registry';

registerFeature('columnVirtualization', (config) => {
  if (config === true) {
    return new ColumnVirtualizationPlugin();
  }
  return new ColumnVirtualizationPlugin(config ?? undefined);
});
