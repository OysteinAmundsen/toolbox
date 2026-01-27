/**
 * Row Reorder feature for @toolbox-web/grid-react
 *
 * Import this module to enable the `rowReorder` prop on DataGrid.
 *
 * @example
 * ```tsx
 * import '@toolbox-web/grid-react/features/row-reorder';
 *
 * <DataGrid rowReorder />
 * ```
 *
 * @packageDocumentation
 */

import { RowReorderPlugin } from '@toolbox-web/grid/plugins/row-reorder';
import { registerFeature } from '../lib/feature-registry';

registerFeature('rowReorder', (config) => {
  if (config === true) {
    return new RowReorderPlugin();
  }
  return new RowReorderPlugin(config ?? undefined);
});
