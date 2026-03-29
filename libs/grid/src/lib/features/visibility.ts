/**
 * Column Visibility feature for @toolbox-web/grid
 *
 * @example
 * ```typescript
 * import '@toolbox-web/grid/features/visibility';
 *
 * grid.gridConfig = { features: { visibility: true } };
 * ```
 */

import { VisibilityPlugin, type VisibilityConfig } from '../plugins/visibility';
import { registerFeature } from './registry';

declare module '../core/types' {
  interface FeatureConfig {
    /** Enable column visibility toggling. */
    visibility?: boolean | VisibilityConfig;
  }
}

registerFeature('visibility', (config) => {
  const options = typeof config === 'boolean' ? {} : ((config as VisibilityConfig) ?? {});
  return new VisibilityPlugin(options);
});

/** @internal Type anchor — forces bundlers to preserve this module's FeatureConfig augmentation when re-exported. */
export type _Augmentation = true;
