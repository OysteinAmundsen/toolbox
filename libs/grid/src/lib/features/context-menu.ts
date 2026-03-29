/**
 * Context Menu feature for @toolbox-web/grid
 *
 * @example
 * ```typescript
 * import '@toolbox-web/grid/features/context-menu';
 *
 * grid.gridConfig = { features: { contextMenu: true } };
 * ```
 */

import { ContextMenuPlugin, type ContextMenuConfig } from '../plugins/context-menu';
import { registerFeature } from './registry';

declare module '../core/types' {
  interface FeatureConfig {
    /** Enable right-click context menu. */
    contextMenu?: boolean | ContextMenuConfig;
  }
}

registerFeature('contextMenu', (config) => {
  const options = typeof config === 'boolean' ? {} : ((config as ContextMenuConfig) ?? {});
  return new ContextMenuPlugin(options);
});

/** @internal Type anchor — forces bundlers to preserve this module's FeatureConfig augmentation when re-exported. */
export type _Augmentation = true;
