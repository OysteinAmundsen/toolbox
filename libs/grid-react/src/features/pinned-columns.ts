/**
 * Pinned Columns feature for @toolbox-web/grid-react
 *
 * Import this module to enable the `pinnedColumns` prop on DataGrid.
 *
 * @example
 * ```tsx
 * import '@toolbox-web/grid-react/features/pinned-columns';
 *
 * <DataGrid pinnedColumns />
 * ```
 *
 * @packageDocumentation
 */

import { PinnedColumnsPlugin } from '@toolbox-web/grid/plugins/pinned-columns';
import { registerFeature } from '../lib/feature-registry';

registerFeature('pinnedColumns', (config) => {
  const options = typeof config === 'boolean' ? {} : ((config as any) ?? {});
  return new PinnedColumnsPlugin(options);
});
