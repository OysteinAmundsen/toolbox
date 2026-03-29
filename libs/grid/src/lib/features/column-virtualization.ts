/**
 * Column Virtualization feature for @toolbox-web/grid
 *
 * @example
 * ```typescript
 * import '@toolbox-web/grid/features/column-virtualization';
 *
 * grid.gridConfig = { features: { columnVirtualization: true } };
 * ```
 */

import {
  ColumnVirtualizationPlugin,
  type ColumnVirtualizationConfig,
} from '../plugins/column-virtualization';
import { registerFeature } from './registry';

declare module '../core/types' {
  interface FeatureConfig {
    /** Enable horizontal column virtualization. */
    columnVirtualization?: boolean | ColumnVirtualizationConfig;
  }
}

registerFeature('columnVirtualization', (config) => {
  const options = typeof config === 'boolean' ? {} : ((config as ColumnVirtualizationConfig) ?? {});
  return new ColumnVirtualizationPlugin(options);
});

/** @internal Type anchor — forces bundlers to preserve this module's FeatureConfig augmentation when re-exported. */
export type _Augmentation = true;
