/**
 * Pivot feature for @toolbox-web/grid
 *
 * @example
 * ```typescript
 * import '@toolbox-web/grid/features/pivot';
 *
 * grid.gridConfig = { features: { pivot: { rowFields: ['region'], colFields: ['year'] } } };
 * ```
 */

import { PivotPlugin, type PivotConfig } from '../plugins/pivot';
import { registerFeature } from './registry';

declare module '../core/types' {
  interface FeatureConfig {
    /** Enable pivot table mode. */
    pivot?: PivotConfig;
  }
}

registerFeature('pivot', (config) => {
  return new PivotPlugin((config as PivotConfig) ?? undefined);
});

/** @internal Type anchor — forces bundlers to preserve this module's FeatureConfig augmentation when re-exported. */
export type _Augmentation = true;
