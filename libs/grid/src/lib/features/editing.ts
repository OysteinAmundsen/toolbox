/**
 * Editing feature for @toolbox-web/grid
 *
 * @example
 * ```typescript
 * import '@toolbox-web/grid/features/editing';
 *
 * grid.gridConfig = { features: { editing: 'dblclick' } };
 * ```
 */

import { EditingPlugin, type EditingConfig } from '../plugins/editing';
import { registerFeature } from './registry';

declare module '../core/types' {
  interface FeatureConfig {
    /** Enable inline cell editing. */
    editing?: boolean | 'click' | 'dblclick' | 'manual' | EditingConfig;
  }
}

registerFeature('editing', (config) => {
  if (config === true) {
    return new EditingPlugin({ editOn: 'dblclick' });
  }
  if (config === 'click' || config === 'dblclick' || config === 'manual') {
    return new EditingPlugin({ editOn: config });
  }
  return new EditingPlugin((config as EditingConfig) ?? undefined);
});

/** @internal Type anchor — forces bundlers to preserve this module's FeatureConfig augmentation when re-exported. */
export type _Augmentation = true;
