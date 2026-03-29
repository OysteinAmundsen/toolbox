/**
 * Pinned Rows feature for @toolbox-web/grid
 *
 * @example
 * ```typescript
 * import '@toolbox-web/grid/features/pinned-rows';
 *
 * grid.gridConfig = { features: { pinnedRows: true } };
 * ```
 */

import { PinnedRowsPlugin, type PinnedRowsConfig } from '../plugins/pinned-rows';
import { registerFeature } from './registry';

declare module '../core/types' {
  interface FeatureConfig {
    /** Enable pinned (frozen) rows at top/bottom of the grid. */
    pinnedRows?: boolean | PinnedRowsConfig;
  }
}

registerFeature('pinnedRows', (config) => {
  const options = typeof config === 'boolean' ? {} : ((config as PinnedRowsConfig) ?? {});
  return new PinnedRowsPlugin(options);
});

/** @internal Type anchor — forces bundlers to preserve this module's FeatureConfig augmentation when re-exported. */
export type _Augmentation = true;
