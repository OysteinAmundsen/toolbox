/**
 * Responsive feature for @toolbox-web/grid
 *
 * @example
 * ```typescript
 * import '@toolbox-web/grid/features/responsive';
 *
 * grid.gridConfig = { features: { responsive: true } };
 * ```
 */

import { ResponsivePlugin, type ResponsivePluginConfig } from '../plugins/responsive';
import { registerFeature } from './registry';

declare module '../core/types' {
  interface FeatureConfig {
    /** Enable responsive column hiding based on breakpoints. */
    responsive?: boolean | ResponsivePluginConfig;
  }
}

registerFeature('responsive', (config) => {
  const options = typeof config === 'boolean' ? {} : ((config as ResponsivePluginConfig) ?? {});
  return new ResponsivePlugin(options);
});

/** @internal Type anchor — forces bundlers to preserve this module's FeatureConfig augmentation when re-exported. */
export type _Augmentation = true;
