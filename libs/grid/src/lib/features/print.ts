/**
 * Print feature for @toolbox-web/grid
 *
 * @example
 * ```typescript
 * import '@toolbox-web/grid/features/print';
 *
 * grid.gridConfig = { features: { print: true } };
 * ```
 */

import { PrintPlugin, type PrintConfig } from '../plugins/print';
import { registerFeature } from './registry';

declare module '../core/types' {
  interface FeatureConfig {
    /** Enable print support with configurable layout. */
    print?: boolean | PrintConfig;
  }
}

registerFeature('print', (config) => {
  if (config === true) return new PrintPlugin();
  return new PrintPlugin((config as PrintConfig) ?? undefined);
});

/** @internal Type anchor — forces bundlers to preserve this module's FeatureConfig augmentation when re-exported. */
export type _Augmentation = true;
