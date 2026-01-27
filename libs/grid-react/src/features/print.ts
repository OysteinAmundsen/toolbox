/**
 * Print feature for @toolbox-web/grid-react
 *
 * Import this module to enable the `print` prop on DataGrid.
 *
 * @example
 * ```tsx
 * import '@toolbox-web/grid-react/features/print';
 *
 * <DataGrid print />
 * ```
 *
 * @packageDocumentation
 */

import { PrintPlugin } from '@toolbox-web/grid/plugins/print';
import { registerFeature } from '../lib/feature-registry';

registerFeature('print', (config) => {
  if (config === true) {
    return new PrintPlugin();
  }
  return new PrintPlugin(config ?? undefined);
});
