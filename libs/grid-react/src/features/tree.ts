/**
 * Tree Data feature for @toolbox-web/grid-react
 *
 * Import this module to enable the `tree` prop on DataGrid.
 *
 * @example
 * ```tsx
 * import '@toolbox-web/grid-react/features/tree';
 *
 * <DataGrid tree={{ childrenField: 'children' }} />
 * ```
 *
 * @packageDocumentation
 */

import { TreePlugin } from '@toolbox-web/grid/plugins/tree';
import { registerFeature } from '../lib/feature-registry';

registerFeature('tree', (config) => {
  const options = typeof config === 'boolean' ? {} : ((config as any) ?? {});
  return new TreePlugin(options);
});
