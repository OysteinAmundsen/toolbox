/**
 * Filtering feature for @toolbox-web/grid
 *
 * @example
 * ```typescript
 * import '@toolbox-web/grid/features/filtering';
 *
 * grid.gridConfig = { features: { filtering: { debounceMs: 200 } } };
 * ```
 */

import { FilteringPlugin, type FilterConfig } from '../plugins/filtering';
import { registerFeature } from './registry';

declare module '../core/types' {
  interface FeatureConfig<TRow> {
    /** Enable column filtering. */
    filtering?: boolean | FilterConfig<TRow>;
  }
}

registerFeature('filtering', (config) => {
  if (typeof config === 'boolean') return new FilteringPlugin();
  return new FilteringPlugin((config as FilterConfig) ?? undefined);
});

/** @internal Type anchor — forces bundlers to preserve this module's FeatureConfig augmentation when re-exported. */
export type _Augmentation = true;
