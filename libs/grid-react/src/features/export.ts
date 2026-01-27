/**
 * Export feature for @toolbox-web/grid-react
 *
 * Import this module to enable the `export` prop on DataGrid.
 *
 * @example
 * ```tsx
 * import '@toolbox-web/grid-react/features/export';
 *
 * <DataGrid export />
 * ```
 *
 * @packageDocumentation
 */

import { ExportPlugin } from '@toolbox-web/grid/plugins/export';
import { registerFeature } from '../lib/feature-registry';

registerFeature('export', (config) => {
  const options = typeof config === 'boolean' ? {} : (config as any) ?? {};
  return new ExportPlugin(options);
});
