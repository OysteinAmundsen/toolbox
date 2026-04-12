/**
 * Column Reorder feature for @toolbox-web/grid
 *
 * @example
 * ```typescript
 * import '@toolbox-web/grid/features/reorder-columns';
 *
 * grid.gridConfig = { features: { reorderColumns: true } };
 * ```
 */

import { ReorderPlugin, type ReorderConfig } from '../plugins/reorder-columns';
import { registerFeature } from './registry';

declare module '../core/types' {
  interface FeatureConfig {
    /** Enable column drag-to-reorder. */
    reorderColumns?: boolean | ReorderConfig;
  }
}

const factory = (config: unknown) => {
  const options = typeof config === 'boolean' ? {} : ((config as ReorderConfig) ?? {});
  return new ReorderPlugin(options);
};

registerFeature('reorderColumns', factory);

/** @internal Type anchor — forces bundlers to preserve this module's FeatureConfig augmentation when re-exported. */
export type _Augmentation = true;
