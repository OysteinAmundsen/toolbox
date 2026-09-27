/**
 * Selection feature for @toolbox-web/grid
 *
 * @example
 * ```typescript
 * import '@toolbox-web/grid/features/selection';
 *
 * grid.gridConfig = { features: { selection: 'range' } };
 * ```
 */

import { SelectionPlugin, type SelectionConfig } from '../plugins/selection';
import { registerFeature } from './registry';

declare module '../core/types' {
  interface FeatureConfig<TRow> {
    /** Enable cell/row/range selection. */
    selection?: 'cell' | 'row' | 'range' | SelectionConfig<TRow>;
  }
}

registerFeature('selection', (config) => {
  if (config === 'cell' || config === 'row' || config === 'range') {
    return new SelectionPlugin({ mode: config });
  }
  return new SelectionPlugin(config ?? undefined);
});

/** @internal Type anchor — forces bundlers to preserve this module's FeatureConfig augmentation when re-exported. */
export type _Augmentation = true;
