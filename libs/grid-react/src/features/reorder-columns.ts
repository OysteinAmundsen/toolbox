/**
 * Column Reorder feature for @toolbox-web/grid-react
 *
 * Import this module to enable the `reorderColumns` prop on DataGrid.
 *
 * @example
 * ```tsx
 * import '@toolbox-web/grid-react/features/reorder-columns';
 *
 * <DataGrid reorderColumns />
 * ```
 *
 * @packageDocumentation
 */

import { ReorderPlugin } from '@toolbox-web/grid/plugins/reorder-columns';
import { registerFeature } from '../lib/feature-registry';

const factory = (config: unknown) => {
  const options = typeof config === 'boolean' ? {} : ((config as any) ?? {});
  return new ReorderPlugin(options);
};

// Primary name
registerFeature('reorderColumns', factory);
// Deprecated alias
registerFeature('reorder', factory);
