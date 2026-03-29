/**
 * Undo/Redo feature for @toolbox-web/grid
 *
 * Requires the `editing` feature to be enabled.
 *
 * @example
 * ```typescript
 * import '@toolbox-web/grid/features/undo-redo';
 *
 * grid.gridConfig = { features: { editing: true, undoRedo: true } };
 * ```
 */

import { UndoRedoPlugin, type UndoRedoConfig } from '../plugins/undo-redo';
import { registerFeature } from './registry';

declare module '../core/types' {
  interface FeatureConfig {
    /** Enable undo/redo for cell edits. Requires `editing`. */
    undoRedo?: boolean | UndoRedoConfig;
  }
}

registerFeature('undoRedo', (config) => {
  const options = typeof config === 'boolean' ? {} : ((config as UndoRedoConfig) ?? {});
  return new UndoRedoPlugin(options);
});

/** @internal Type anchor — forces bundlers to preserve this module's FeatureConfig augmentation when re-exported. */
export type _Augmentation = true;
