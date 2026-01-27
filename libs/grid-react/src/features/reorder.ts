/**
 * Column Reorder feature for @toolbox-web/grid-react
 *
 * Import this module to enable the `reorder` prop on DataGrid.
 *
 * @example
 * ```tsx
 * import '@toolbox-web/grid-react/features/reorder';
 *
 * <DataGrid reorder />
 * ```
 *
 * @packageDocumentation
 */

import { ReorderPlugin } from '@toolbox-web/grid/plugins/reorder';
import { registerFeature } from '../lib/feature-registry';

registerFeature('reorder', (config) => {
  const options = typeof config === 'boolean' ? {} : ((config as any) ?? {});
  return new ReorderPlugin(options);
});
