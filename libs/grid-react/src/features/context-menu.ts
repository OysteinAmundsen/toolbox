/**
 * Context Menu feature for @toolbox-web/grid-react
 *
 * Import this module to enable the `contextMenu` prop on DataGrid.
 *
 * @example
 * ```tsx
 * import '@toolbox-web/grid-react/features/context-menu';
 *
 * <DataGrid contextMenu />
 * ```
 *
 * @packageDocumentation
 */

import { ContextMenuPlugin } from '@toolbox-web/grid/plugins/context-menu';
import { registerFeature } from '../lib/feature-registry';

registerFeature('contextMenu', (config) => {
  const options = typeof config === 'boolean' ? {} : ((config as any) ?? {});
  return new ContextMenuPlugin(options);
});
