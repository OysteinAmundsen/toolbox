/**
 * Filtering feature for @toolbox-web/grid-react
 *
 * Import this module to enable the `filtering` prop on DataGrid.
 *
 * @example
 * ```tsx
 * import '@toolbox-web/grid-react/features/filtering';
 *
 * <DataGrid filtering={{ debounceMs: 200 }} />
 * ```
 *
 * @packageDocumentation
 */

import { FilteringPlugin } from '@toolbox-web/grid/plugins/filtering';
import { registerFeature } from '../lib/feature-registry';

registerFeature('filtering', (config) => {
  const options = typeof config === 'boolean' ? {} : ((config as any) ?? {});
  return new FilteringPlugin(options);
});
