/**
 * Master-Detail feature for @toolbox-web/grid
 *
 * @example
 * ```typescript
 * import '@toolbox-web/grid/features/master-detail';
 *
 * grid.gridConfig = { features: { masterDetail: { detailRenderer: (row) => `<div>...</div>` } } };
 * ```
 */

import { MasterDetailPlugin, type MasterDetailConfig } from '../plugins/master-detail';
import { registerFeature } from './registry';

declare module '../core/types' {
  interface FeatureConfig {
    /** Enable master-detail rows with expandable detail panels. */
    masterDetail?: MasterDetailConfig;
  }
}

registerFeature('masterDetail', (config) => {
  const options = typeof config === 'boolean' ? {} : ((config as MasterDetailConfig) ?? {});
  return new MasterDetailPlugin(options);
});

/** @internal Type anchor — forces bundlers to preserve this module's FeatureConfig augmentation when re-exported. */
export type _Augmentation = true;
