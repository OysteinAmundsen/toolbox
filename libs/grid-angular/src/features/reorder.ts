/**
 * Column reorder feature for @toolbox-web/grid-angular
 *
 * Import this module to enable the `reorder` input on Grid directive.
 *
 * @example
 * ```typescript
 * import '@toolbox-web/grid-angular/features/reorder';
 *
 * <tbw-grid [reorder]="true" />
 * ```
 *
 * @packageDocumentation
 */

import { ReorderPlugin } from '@toolbox-web/grid/plugins/reorder';
import { registerFeature } from '../lib/feature-registry';

registerFeature('reorder', (config) => {
  if (config === true) {
    return new ReorderPlugin();
  }
  return new ReorderPlugin(config ?? undefined);
});
