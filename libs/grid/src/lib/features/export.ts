/**
 * Export feature for @toolbox-web/grid
 *
 * @example
 * ```typescript
 * import '@toolbox-web/grid/features/export';
 *
 * grid.gridConfig = { features: { export: true } };
 * ```
 */

import { ExportPlugin, type ExportConfig } from '../plugins/export';
import { registerFeature } from './registry';

declare module '../core/types' {
  interface FeatureConfig {
    /** Enable data export (CSV, Excel, etc.). */
    export?: boolean | ExportConfig;
  }
}

registerFeature('export', (config) => {
  const options = typeof config === 'boolean' ? {} : ((config as ExportConfig) ?? {});
  return new ExportPlugin(options);
});

/** @internal Type anchor — forces bundlers to preserve this module's FeatureConfig augmentation when re-exported. */
export type _Augmentation = true;
