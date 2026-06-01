/**
 * Server-Side feature for @toolbox-web/grid
 *
 * @example
 * ```typescript
 * import '@toolbox-web/grid/features/server-side';
 *
 * grid.gridConfig = { features: { serverSide: { dataSource: { getRows: async (params) => ... } } } };
 * ```
 */

import { ServerSidePlugin, type ServerSideConfig } from '../plugins/server-side';
import { registerFeature } from './registry';

declare module '../core/types' {
  interface FeatureConfig {
    /**
     * Enable server-side data fetching, sorting, filtering, etc.
     *
     * Pass `true` to enable with defaults (e.g. for the zero-JS
     * `<tbw-grid data-src="...">` shorthand) or a {@link ServerSideConfig}
     * object to supply a `dataSource` and other options.
     */
    serverSide?: boolean | ServerSideConfig;
  }
}

registerFeature('serverSide', (config) => {
  if (config === true) return new ServerSidePlugin();
  return new ServerSidePlugin((config as ServerSideConfig) ?? undefined);
});

/** @internal Type anchor — forces bundlers to preserve this module's FeatureConfig augmentation when re-exported. */
export type _Augmentation = true;
