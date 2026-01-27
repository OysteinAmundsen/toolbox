/**
 * Pinned rows feature for @toolbox-web/grid-angular
 *
 * Import this module to enable the `pinnedRows` input on Grid directive.
 *
 * @example
 * ```typescript
 * import '@toolbox-web/grid-angular/features/pinned-rows';
 *
 * <tbw-grid [pinnedRows]="{ bottom: [{ type: 'aggregation' }] }" />
 * ```
 *
 * @packageDocumentation
 */

import { PinnedRowsPlugin } from '@toolbox-web/grid/plugins/pinned-rows';
import { registerFeature } from '../lib/feature-registry';

registerFeature('pinnedRows', (config) => {
  if (config === true) {
    return new PinnedRowsPlugin();
  }
  return new PinnedRowsPlugin(config ?? undefined);
});
