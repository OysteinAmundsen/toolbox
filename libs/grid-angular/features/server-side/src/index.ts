/**
 * Server-side feature for @toolbox-web/grid-angular
 *
 * Import this module to enable the `serverSide` input on Grid directive.
 *
 * @example
 * ```typescript
 * import '@toolbox-web/grid-angular/features/server-side';
 *
 * <tbw-grid [serverSide]="{ dataSource: fetchDataFn }" />
 * ```
 *
 * @packageDocumentation
 */

import { ServerSidePlugin } from '@toolbox-web/grid/plugins/server-side';
import { registerFeature } from '@toolbox-web/grid-angular';

registerFeature('serverSide', (config) => {
  return new ServerSidePlugin(config ?? undefined);
});
