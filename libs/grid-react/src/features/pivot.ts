/**
 * Pivot feature for @toolbox-web/grid-react
 *
 * Import this module to enable the `pivot` prop on DataGrid.
 *
 * @example
 * ```tsx
 * import '@toolbox-web/grid-react/features/pivot';
 *
 * <DataGrid pivot={{ rowFields: ['category'], valueField: 'sales' }} />
 * ```
 *
 * @packageDocumentation
 */

import { PivotPlugin } from '@toolbox-web/grid/plugins/pivot';
import { registerFeature } from '../lib/feature-registry';

registerFeature('pivot', (config) => {
  return new PivotPlugin(config ?? undefined);
});
