/**
 * Row Grouping feature for @toolbox-web/grid-react
 *
 * Import this module to enable the `groupingRows` prop on DataGrid.
 *
 * @example
 * ```tsx
 * import '@toolbox-web/grid-react/features/grouping-rows';
 *
 * <DataGrid groupingRows={{ groupBy: ['department'] }} />
 * ```
 *
 * @packageDocumentation
 */

import { GroupingRowsPlugin } from '@toolbox-web/grid/plugins/grouping-rows';
import { registerFeature } from '../lib/feature-registry';

registerFeature('groupingRows', (config) => {
  const options = typeof config === 'boolean' ? {} : ((config as any) ?? {});
  return new GroupingRowsPlugin(options);
});
