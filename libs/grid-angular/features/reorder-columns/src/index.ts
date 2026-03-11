/**
 * Column reorder feature for @toolbox-web/grid-angular
 *
 * Import this module to enable the `reorderColumns` input on Grid directive.
 *
 * @example
 * ```typescript
 * import '@toolbox-web/grid-angular/features/reorder-columns';
 *
 * <tbw-grid [reorderColumns]="true" />
 * ```
 *
 * @packageDocumentation
 */

import { ReorderPlugin } from '@toolbox-web/grid/plugins/reorder-columns';
import { registerFeature } from '@toolbox-web/grid-angular';

const factory = (config: unknown) => {
  if (config === true) {
    return new ReorderPlugin();
  }
  return new ReorderPlugin(config ?? undefined);
};

// Primary name
registerFeature('reorderColumns', factory);
// Deprecated alias
registerFeature('reorder', factory);
