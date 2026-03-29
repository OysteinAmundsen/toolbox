/**
 * Multi-sort feature for @toolbox-web/grid
 *
 * @example
 * ```typescript
 * import '@toolbox-web/grid/features/multi-sort';
 *
 * grid.gridConfig = { features: { multiSort: true } };
 * ```
 */

import { MultiSortPlugin, type MultiSortConfig } from '../plugins/multi-sort';
import { registerFeature } from './registry';

declare module '../core/types' {
  interface FeatureConfig {
    /** Enable multi-column sorting. */
    multiSort?: boolean | 'single' | 'multi' | MultiSortConfig;
    /** @deprecated Use `multiSort` instead. Will be removed in v2.*/
    sorting?: boolean | 'single' | 'multi' | MultiSortConfig;
  }
}

registerFeature('multiSort', (config) => {
  if (config === true || config === 'multi') {
    return new MultiSortPlugin();
  }
  if (config === 'single') {
    return new MultiSortPlugin({ maxSortColumns: 1 });
  }
  return new MultiSortPlugin(config as MultiSortConfig);
});

/** @internal Type anchor — forces bundlers to preserve this module's FeatureConfig augmentation when re-exported. */
export type _Augmentation = true;
