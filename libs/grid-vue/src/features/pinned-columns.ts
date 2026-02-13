/**
 * Pinned columns feature for @toolbox-web/grid-vue
 *
 * Import this module to enable the `pinnedColumns` prop on TbwGrid.
 *
 * @example
 * ```vue
 * <script setup>
 * import '@toolbox-web/grid-vue/features/pinned-columns';
 * </script>
 *
 * <template>
 *   <TbwGrid pinnedColumns :columns="[
 *     { field: 'id', pinned: 'left' },
 *     { field: 'name' },
 *   ]" />
 * </template>
 * ```
 *
 * @packageDocumentation
 */

import { PinnedColumnsPlugin } from '@toolbox-web/grid/plugins/pinned-columns';
import { registerFeature } from '../lib/feature-registry';

registerFeature('pinnedColumns', () => {
  return new PinnedColumnsPlugin();
});
