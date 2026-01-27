/**
 * Sorting feature for @toolbox-web/grid-react
 *
 * Import this module to enable the `sorting` prop on DataGrid.
 *
 * @example
 * ```tsx
 * import '@toolbox-web/grid-react/features/sorting';
 *
 * <DataGrid sorting="multi" />
 * ```
 *
 * @packageDocumentation
 */

import { MultiSortPlugin } from '@toolbox-web/grid/plugins/multi-sort';
import { registerFeature } from '../lib/feature-registry';

registerFeature('sorting', (config) => {
  // Handle shorthand: true, 'single', 'multi'
  if (config === true || config === 'multi') {
    return new MultiSortPlugin();
  }
  if (config === 'single') {
    return new MultiSortPlugin({ maxSortColumns: 1 });
  }
  // Full config object
  return new MultiSortPlugin(config as any);
});
