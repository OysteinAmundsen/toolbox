/**
 * Clipboard feature for @toolbox-web/grid
 *
 * Requires the selection feature to be enabled.
 *
 * @example
 * ```typescript
 * import '@toolbox-web/grid/features/selection';
 * import '@toolbox-web/grid/features/clipboard';
 *
 * grid.gridConfig = { features: { selection: 'range', clipboard: true } };
 * ```
 */

import { ClipboardPlugin, type ClipboardConfig } from '../plugins/clipboard';
import { registerFeature } from './registry';

declare module '../core/types' {
  interface FeatureConfig {
    /** Enable clipboard copy/paste. Requires selection. */
    clipboard?: boolean | ClipboardConfig;
  }
}

registerFeature('clipboard', (config) => {
  const options = typeof config === 'boolean' ? {} : ((config as ClipboardConfig) ?? {});
  return new ClipboardPlugin(options);
});

/** @internal Type anchor — forces bundlers to preserve this module's FeatureConfig augmentation when re-exported. */
export type _Augmentation = true;
