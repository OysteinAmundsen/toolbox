/**
 * Master-detail feature for @toolbox-web/grid-angular
 *
 * Import this module to enable the `masterDetail` input on Grid directive.
 *
 * @example
 * ```typescript
 * import '@toolbox-web/grid-angular/features/master-detail';
 *
 * <tbw-grid [masterDetail]="{ detailRenderer: myRenderer }" />
 * ```
 *
 * @packageDocumentation
 */

import { MasterDetailPlugin } from '@toolbox-web/grid/plugins/master-detail';
import { registerFeature } from '../lib/feature-registry';

registerFeature('masterDetail', (config) => {
  return new MasterDetailPlugin(config ?? undefined);
});
