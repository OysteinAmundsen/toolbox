/**
 * Server-side feature for @toolbox-web/grid-react
 *
 * Import this module to enable the `serverSide` prop on DataGrid.
 *
 * @example
 * ```tsx
 * import '@toolbox-web/grid-react/features/server-side';
 *
 * <DataGrid serverSide={{ dataSource: async (params) => fetchData(params) }} />
 * ```
 *
 * @packageDocumentation
 */

import { ServerSidePlugin } from '@toolbox-web/grid/plugins/server-side';
import { registerFeature } from '../lib/feature-registry';

registerFeature('serverSide', (config) => {
  return new ServerSidePlugin(config ?? undefined);
});
