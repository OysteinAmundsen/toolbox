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

import { GroupingColumnsPlugin } from '@toolbox-web/grid/plugins/grouping-columns';
import { registerFeature } from '../lib/feature-registry';

registerFeature('groupingColumns', (config) => {
  if (config === true) {
    return new GroupingColumnsPlugin();
  }
  return new GroupingColumnsPlugin(config ?? undefined);
});
