/**
 * Multi-sort feature for @toolbox-web/grid-vue
 *
 * Import this module to enable the `multiSort` prop on TbwGrid.
 *
 * @example
 * ```vue
 * <script setup>
 * import '@toolbox-web/grid-vue/features/multi-sort';
 * </script>
 *
 * <template>
 *   <TbwGrid multiSort />
 * </template>
 * ```
 *
 * @packageDocumentation
 */

import { MultiSortPlugin } from '@toolbox-web/grid/plugins/multi-sort';
import { registerFeature } from '../lib/feature-registry';

registerFeature('multiSort', (config) => {
  if (config === true || config === 'multi') {
    return new MultiSortPlugin();
  }
  if (config === 'single') {
    return new MultiSortPlugin({ maxSortColumns: 1 });
  }
  return new MultiSortPlugin(config ?? undefined);
});

// Alias for backwards compatibility
registerFeature('sorting', (config) => {
  if (config === true || config === 'multi') {
    return new MultiSortPlugin();
  }
  if (config === 'single') {
    return new MultiSortPlugin({ maxSortColumns: 1 });
  }
  return new MultiSortPlugin(config ?? undefined);
});
