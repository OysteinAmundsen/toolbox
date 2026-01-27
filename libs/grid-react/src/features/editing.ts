/**
 * Editing feature for @toolbox-web/grid-react
 *
 * Import this module to enable the `editing` prop on DataGrid.
 *
 * @example
 * ```tsx
 * import '@toolbox-web/grid-react/features/editing';
 *
 * <DataGrid editing="dblclick" />
 * ```
 *
 * @packageDocumentation
 */

import { EditingPlugin } from '@toolbox-web/grid/plugins/editing';
import { registerFeature } from '../lib/feature-registry';

registerFeature('editing', (config) => {
  // Handle shorthand: true, 'click', 'dblclick', 'manual'
  if (config === true) {
    return new EditingPlugin({ editOn: 'dblclick' });
  }
  if (config === 'click' || config === 'dblclick' || config === 'manual') {
    return new EditingPlugin({ editOn: config });
  }
  // Full config object - never pass null
  return new EditingPlugin(config ?? undefined);
});
