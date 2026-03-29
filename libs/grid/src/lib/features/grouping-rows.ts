/**
 * Row Grouping feature for @toolbox-web/grid
 *
 * @example
 * ```typescript
 * import '@toolbox-web/grid/features/grouping-rows';
 *
 * grid.gridConfig = { features: { groupingRows: { groupBy: ['department'] } } };
 * ```
 */

import { GroupingRowsPlugin, type GroupingRowsConfig } from '../plugins/grouping-rows';
import { registerFeature } from './registry';

declare module '../core/types' {
  interface FeatureConfig {
    /** Enable row grouping with expand/collapse. */
    groupingRows?: GroupingRowsConfig;
  }
}

registerFeature('groupingRows', (config) => {
  const options = typeof config === 'boolean' ? {} : ((config as GroupingRowsConfig) ?? {});
  return new GroupingRowsPlugin(options);
});

/** @internal Type anchor — forces bundlers to preserve this module's FeatureConfig augmentation when re-exported. */
export type _Augmentation = true;
