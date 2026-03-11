/**
 * Row Reorder feature for @toolbox-web/grid-react
 *
 * Import this module to enable the `reorderRows` prop on DataGrid.
 *
 * @example
 * ```tsx
 * import '@toolbox-web/grid-react/features/reorder-rows';
 *
 * <DataGrid reorderRows />
 * ```
 *
 * @packageDocumentation
 */

import { RowReorderPlugin } from '@toolbox-web/grid/plugins/reorder-rows';
import { registerFeature } from '../lib/feature-registry';

const factory = (config: unknown) => {
  if (config === true) {
    return new RowReorderPlugin();
  }
  return new RowReorderPlugin(config ?? undefined);
};

// Primary name
registerFeature('reorderRows', factory);
// Deprecated alias
registerFeature('rowReorder', factory);
