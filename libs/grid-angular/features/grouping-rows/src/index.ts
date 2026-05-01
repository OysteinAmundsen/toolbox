/**
 * Row grouping feature for @toolbox-web/grid-angular
 *
 * Import this module to enable the `groupingRows` input on Grid directive.
 *
 * @example
 * ```typescript
 * import '@toolbox-web/grid-angular/features/grouping-rows';
 *
 * <tbw-grid [groupingRows]="{ groupBy: ['department'] }" />
 * ```
 *
 * @packageDocumentation
 */

import { registerFeatureConfigPreprocessor } from '@toolbox-web/grid-angular';
import '@toolbox-web/grid/features/grouping-rows';
import type { GroupingRowsConfig } from '@toolbox-web/grid/plugins/grouping-rows';
export type { _Augmentation as _GroupingRowsAugmentation } from '@toolbox-web/grid/features/grouping-rows';

// Bridge any Angular component classes embedded in the user-supplied config
// (e.g. group-header renderers) to plain renderer functions before the core
// plugin factory consumes the config.
registerFeatureConfigPreprocessor('groupingRows', (config, adapter) => {
  if (!config || typeof config !== 'object') return config;
  return adapter.processGroupingRowsConfig(config as GroupingRowsConfig);
});
