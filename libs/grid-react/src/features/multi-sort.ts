/**
 * Multi-sort feature for @toolbox-web/grid-react
 *
 * Import this module to enable the `multiSort` prop on DataGrid.
 * Multi-sort allows sorting by multiple columns simultaneously.
 *
 * For basic single-column sorting, columns with `sortable: true` work without this plugin.
 * Use `sortable={false}` on the grid to disable all sorting.
 *
 * @example
 * ```tsx
 * import '@toolbox-web/grid-react/features/multi-sort';
 *
 * <DataGrid multiSort />
 * <DataGrid multiSort="single" />
 * <DataGrid multiSort={{ maxSortColumns: 3 }} />
 * ```
 *
 * @packageDocumentation
 */

import { MultiSortPlugin } from '@toolbox-web/grid/plugins/multi-sort';
import { registerFeature } from '../lib/feature-registry';

registerFeature('multiSort', (config) => {
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
