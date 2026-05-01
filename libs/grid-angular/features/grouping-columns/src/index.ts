/**
 * Column grouping feature for @toolbox-web/grid-angular
 *
 * Import this module to enable the `groupingColumns` input on Grid directive.
 *
 * @example
 * ```typescript
 * import '@toolbox-web/grid-angular/features/grouping-columns';
 *
 * <tbw-grid [groupingColumns]="{ columnGroups: [...] }" />
 * ```
 *
 * @packageDocumentation
 */

import { registerFeatureConfigPreprocessor } from '@toolbox-web/grid-angular';
import '@toolbox-web/grid/features/grouping-columns';
import type { GroupingColumnsConfig } from '@toolbox-web/grid/plugins/grouping-columns';
export type { _Augmentation as _GroupingColumnsAugmentation } from '@toolbox-web/grid/features/grouping-columns';

// Bridge any Angular component classes embedded in the user-supplied config
// (e.g. group-header renderers) to plain renderer functions before the core
// plugin factory consumes the config. Without this, raw component classes
// would be invoked without `new`, causing runtime errors.
registerFeatureConfigPreprocessor('groupingColumns', (config, adapter) => {
  if (!config || typeof config !== 'object') return config;
  return adapter.processGroupingColumnsConfig(config as GroupingColumnsConfig);
});
