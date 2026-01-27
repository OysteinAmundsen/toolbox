/**
 * Pinned Rows feature for @toolbox-web/grid-react
 *
 * Import this module to enable the `pinnedRows` prop on DataGrid.
 *
 * @example
 * ```tsx
 * import '@toolbox-web/grid-react/features/pinned-rows';
 *
 * <DataGrid pinnedRows={{ position: 'bottom', showRowCount: true }} />
 * ```
 *
 * @packageDocumentation
 */

import { PinnedRowsPlugin } from '@toolbox-web/grid/plugins/pinned-rows';
import { registerFeature } from '../lib/feature-registry';

registerFeature('pinnedRows', (config) => {
  const options = typeof config === 'boolean' ? {} : ((config as any) ?? {});
  return new PinnedRowsPlugin(options);
});
