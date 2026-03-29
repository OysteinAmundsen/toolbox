/**
 * Pinned Columns feature for @toolbox-web/grid
 *
 * @example
 * ```typescript
 * import '@toolbox-web/grid/features/pinned-columns';
 *
 * grid.gridConfig = { features: { pinnedColumns: true } };
 * ```
 */

import { PinnedColumnsPlugin } from '../plugins/pinned-columns';
import { registerFeature } from './registry';

declare module '../core/types' {
  interface FeatureConfig {
    /** Enable column pinning (left/right). */
    pinnedColumns?: boolean;
  }
}

registerFeature('pinnedColumns', (config) => {
  return new PinnedColumnsPlugin();
});

/** @internal Type anchor — forces bundlers to preserve this module's FeatureConfig augmentation when re-exported. */
export type _Augmentation = true;
