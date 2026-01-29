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

// eslint-disable-next-line @nx/enforce-module-boundaries -- Intentional: feature files must statically import their plugin
import { GroupingRowsPlugin } from '@toolbox-web/grid/plugins/grouping-rows';
import { registerFeature } from '@toolbox-web/grid-angular';

registerFeature('groupingRows', (config) => {
  return new GroupingRowsPlugin(config ?? undefined);
});
