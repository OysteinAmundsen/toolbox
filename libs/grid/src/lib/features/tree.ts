/**
 * Tree feature for @toolbox-web/grid
 *
 * @example
 * ```typescript
 * import '@toolbox-web/grid/features/tree';
 *
 * grid.gridConfig = { features: { tree: true } };
 * ```
 */

import { TreePlugin, type TreeConfig } from '../plugins/tree';
import { registerFeature } from './registry';

declare module '../core/types' {
  interface FeatureConfig {
    /** Enable tree (hierarchical) data display with expand/collapse. */
    tree?: boolean | TreeConfig;
  }
}

registerFeature('tree', (config) => {
  const options = typeof config === 'boolean' ? {} : ((config as TreeConfig) ?? {});
  return new TreePlugin(options);
});

/** @internal Type anchor — forces bundlers to preserve this module's FeatureConfig augmentation when re-exported. */
export type _Augmentation = true;
