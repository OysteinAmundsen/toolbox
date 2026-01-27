/**
 * Column Visibility feature for @toolbox-web/grid-react
 *
 * Import this module to enable the `visibility` prop on DataGrid.
 *
 * @example
 * ```tsx
 * import '@toolbox-web/grid-react/features/visibility';
 *
 * <DataGrid visibility />
 * ```
 *
 * @packageDocumentation
 */

import { VisibilityPlugin } from '@toolbox-web/grid/plugins/visibility';
import { registerFeature } from '../lib/feature-registry';

registerFeature('visibility', (config) => {
  const options = typeof config === 'boolean' ? {} : ((config as any) ?? {});
  return new VisibilityPlugin(options);
});
