/**
 * Row Reorder feature for @toolbox-web/grid
 *
 * @example
 * ```typescript
 * import '@toolbox-web/grid/features/reorder-rows';
 *
 * grid.gridConfig = { features: { reorderRows: true } };
 * ```
 */

import { RowReorderPlugin, type RowReorderConfig } from '../plugins/reorder-rows';
import { registerFeature } from './registry';

declare module '../core/types' {
  interface FeatureConfig {
    /** Enable row drag-to-reorder. */
    reorderRows?: boolean | RowReorderConfig;
    /** @deprecated Use `reorderRows` instead. Will be removed in v2.*/
    rowReorder?: boolean | RowReorderConfig;
  }
}

const factory = (config: unknown) => {
  if (config === true) {
    return new RowReorderPlugin();
  }
  return new RowReorderPlugin((config as RowReorderConfig) ?? undefined);
};

registerFeature('reorderRows', factory);
registerFeature('rowReorder', factory);

/** @internal Type anchor — forces bundlers to preserve this module's FeatureConfig augmentation when re-exported. */
export type _Augmentation = true;
