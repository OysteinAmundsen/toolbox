/**
 * Column Grouping feature for @toolbox-web/grid-react
 *
 * Import this module to enable the `groupingColumns` prop on DataGrid.
 *
 * @example
 * ```tsx
 * import '@toolbox-web/grid-react/features/grouping-columns';
 *
 * <DataGrid groupingColumns />
 * ```
 *
 * @packageDocumentation
 */

import { GroupingColumnsPlugin } from '@toolbox-web/grid/plugins/grouping-columns';
import { registerFeature } from '../lib/feature-registry';

registerFeature('groupingColumns', (config) => {
  const options = typeof config === 'boolean' ? {} : ((config as any) ?? {});
  return new GroupingColumnsPlugin(options);
});
