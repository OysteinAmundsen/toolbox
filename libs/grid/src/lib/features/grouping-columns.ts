/**
 * Column Grouping feature for @toolbox-web/grid
 *
 * @example
 * ```typescript
 * import '@toolbox-web/grid/features/grouping-columns';
 *
 * grid.gridConfig = { features: { groupingColumns: true } };
 * ```
 */

import { GroupingColumnsPlugin, type GroupingColumnsConfig } from '../plugins/grouping-columns';
import { registerFeature } from './registry';

declare module '../core/types' {
  interface FeatureConfig {
    /** Enable column grouping headers. */
    groupingColumns?: boolean | GroupingColumnsConfig;
  }
}

registerFeature('groupingColumns', (config) => {
  const options = typeof config === 'boolean' ? {} : ((config as GroupingColumnsConfig) ?? {});
  return new GroupingColumnsPlugin(options);
});

/** @internal Type anchor — forces bundlers to preserve this module's FeatureConfig augmentation when re-exported. */
export type _Augmentation = true;
