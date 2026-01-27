/**
 * Column Virtualization feature for @toolbox-web/grid-react
 *
 * Import this module to enable the `columnVirtualization` prop on DataGrid.
 *
 * @example
 * ```tsx
 * import '@toolbox-web/grid-react/features/column-virtualization';
 *
 * <DataGrid columnVirtualization />
 * ```
 *
 * @packageDocumentation
 */

import { ColumnVirtualizationPlugin } from '@toolbox-web/grid/plugins/column-virtualization';
import { registerFeature } from '../lib/feature-registry';

registerFeature('columnVirtualization', (config) => {
  const options = typeof config === 'boolean' ? {} : ((config as any) ?? {});
  return new ColumnVirtualizationPlugin(options);
});
