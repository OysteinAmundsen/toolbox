/**
 * Responsive feature for @toolbox-web/grid-react
 *
 * Import this module to enable the `responsive` prop on DataGrid.
 *
 * @example
 * ```tsx
 * import '@toolbox-web/grid-react/features/responsive';
 *
 * <DataGrid responsive={{ breakpoint: 700 }} />
 * ```
 *
 * @packageDocumentation
 */

import { ResponsivePlugin } from '@toolbox-web/grid/plugins/responsive';
import { registerFeature } from '../lib/feature-registry';

registerFeature('responsive', (config) => {
  const options = typeof config === 'boolean' ? {} : ((config as any) ?? {});
  return new ResponsivePlugin(options);
});
