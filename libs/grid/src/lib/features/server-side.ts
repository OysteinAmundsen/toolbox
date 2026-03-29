/**
 * Server-Side feature for @toolbox-web/grid
 *
 * @example
 * ```typescript
 * import '@toolbox-web/grid/features/server-side';
 *
 * grid.gridConfig = { features: { serverSide: { fetchRows: async (params) => ... } } };
 * ```
 */

import { ServerSidePlugin, type ServerSideConfig } from '../plugins/server-side';
import { registerFeature } from './registry';

declare module '../core/types' {
  interface FeatureConfig {
    /** Enable server-side data fetching, sorting, filtering, etc. */
    serverSide?: ServerSideConfig;
  }
}

registerFeature('serverSide', (config) => {
  return new ServerSidePlugin((config as ServerSideConfig) ?? undefined);
});

/** @internal Type anchor — forces bundlers to preserve this module's FeatureConfig augmentation when re-exported. */
export type _Augmentation = true;
