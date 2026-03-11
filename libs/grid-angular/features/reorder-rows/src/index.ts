/**
 * Row reorder feature for @toolbox-web/grid-angular
 *
 * Import this module to enable the `reorderRows` input on Grid directive.
 *
 * @example
 * ```typescript
 * import '@toolbox-web/grid-angular/features/reorder-rows';
 *
 * <tbw-grid [reorderRows]="true" />
 * ```
 *
 * @packageDocumentation
 */

import { RowReorderPlugin } from '@toolbox-web/grid/plugins/reorder-rows';
import { registerFeature } from '@toolbox-web/grid-angular';

const factory = (config: unknown) => {
  if (config === true) {
    return new RowReorderPlugin();
  }
  return new RowReorderPlugin(config ?? undefined);
};

// Primary name
registerFeature('reorderRows', factory);
// Deprecated alias
registerFeature('rowReorder', factory);
