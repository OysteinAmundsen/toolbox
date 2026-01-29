/**
 * Column virtualization feature for @toolbox-web/grid-angular
 *
 * Import this module to enable the `columnVirtualization` input on Grid directive.
 *
 * @example
 * ```typescript
 * import '@toolbox-web/grid-angular/features/column-virtualization';
 *
 * <tbw-grid [columnVirtualization]="true" />
 * ```
 *
 * @packageDocumentation
 */

import { ColumnVirtualizationPlugin } from '@toolbox-web/grid/plugins/column-virtualization';
import { registerFeature } from '@toolbox-web/grid-angular';

registerFeature('columnVirtualization', (config) => {
  if (config === true) {
    return new ColumnVirtualizationPlugin();
  }
  return new ColumnVirtualizationPlugin(config ?? undefined);
});
