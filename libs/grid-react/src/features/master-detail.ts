/**
 * Master-Detail feature for @toolbox-web/grid-react
 *
 * Import this module to enable the `masterDetail` prop on DataGrid.
 *
 * @example
 * ```tsx
 * import '@toolbox-web/grid-react/features/master-detail';
 *
 * <DataGrid masterDetail={{ showExpandColumn: true }}>
 *   <GridDetailPanel>{({ row }) => <DetailView row={row} />}</GridDetailPanel>
 * </DataGrid>
 * ```
 *
 * @packageDocumentation
 */

import { MasterDetailPlugin } from '@toolbox-web/grid/plugins/master-detail';
import { registerFeature } from '../lib/feature-registry';

registerFeature('masterDetail', (config) => {
  const options = typeof config === 'boolean' ? {} : ((config as any) ?? {});
  return new MasterDetailPlugin(options);
});
