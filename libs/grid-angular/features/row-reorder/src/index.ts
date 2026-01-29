/**
 * Row reorder feature for @toolbox-web/grid-angular
 *
 * Import this module to enable the `rowReorder` input on Grid directive.
 *
 * @example
 * ```typescript
 * import '@toolbox-web/grid-angular/features/row-reorder';
 *
 * <tbw-grid [rowReorder]="true" />
 * ```
 *
 * @packageDocumentation
 */

import { RowReorderPlugin } from '@toolbox-web/grid/plugins/row-reorder';
import { registerFeature } from '@toolbox-web/grid-angular';

registerFeature('rowReorder', (config) => {
  if (config === true) {
    return new RowReorderPlugin();
  }
  return new RowReorderPlugin(config ?? undefined);
});
