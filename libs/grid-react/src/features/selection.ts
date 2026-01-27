/**
 * Selection feature for @toolbox-web/grid-react
 *
 * Import this module to enable the `selection` prop on DataGrid.
 *
 * @example
 * ```tsx
 * import '@toolbox-web/grid-react/features/selection';
 *
 * <DataGrid selection="range" />
 * ```
 *
 * @packageDocumentation
 */

import { SelectionPlugin } from '@toolbox-web/grid/plugins/selection';
import { registerFeature } from '../lib/feature-registry';

registerFeature('selection', (config) => {
  // Handle shorthand: 'cell', 'row', 'range'
  if (config === 'cell' || config === 'row' || config === 'range') {
    return new SelectionPlugin({ mode: config });
  }
  // Full config object
  return new SelectionPlugin(config ?? undefined);
});
