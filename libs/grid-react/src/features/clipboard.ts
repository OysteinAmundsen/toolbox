/**
 * Clipboard feature for @toolbox-web/grid-react
 *
 * Import this module to enable the `clipboard` prop on DataGrid.
 * Requires the selection feature to be enabled.
 *
 * @example
 * ```tsx
 * import '@toolbox-web/grid-react/features/selection';
 * import '@toolbox-web/grid-react/features/clipboard';
 *
 * <DataGrid selection="range" clipboard />
 * ```
 *
 * @packageDocumentation
 */

import { ClipboardPlugin } from '@toolbox-web/grid/plugins/clipboard';
import { registerFeature } from '../lib/feature-registry';

registerFeature('clipboard', (config) => {
  const options = typeof config === 'boolean' ? {} : ((config as any) ?? {});
  return new ClipboardPlugin(options);
});
