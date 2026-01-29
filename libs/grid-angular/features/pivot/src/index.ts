/**
 * Pivot feature for @toolbox-web/grid-angular
 *
 * Import this module to enable the `pivot` input on Grid directive.
 *
 * @example
 * ```typescript
 * import '@toolbox-web/grid-angular/features/pivot';
 *
 * <tbw-grid [pivot]="{ rowFields: ['category'], valueField: 'sales' }" />
 * ```
 *
 * @packageDocumentation
 */

import { PivotPlugin } from '@toolbox-web/grid/plugins/pivot';
import { registerFeature } from '@toolbox-web/grid-angular';

registerFeature('pivot', (config) => {
  return new PivotPlugin(config ?? undefined);
});
