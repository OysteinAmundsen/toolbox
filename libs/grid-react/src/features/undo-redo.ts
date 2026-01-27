/**
 * Undo/Redo feature for @toolbox-web/grid-react
 *
 * Import this module to enable the `undoRedo` prop on DataGrid.
 * Requires the editing feature to be enabled.
 *
 * @example
 * ```tsx
 * import '@toolbox-web/grid-react/features/editing';
 * import '@toolbox-web/grid-react/features/undo-redo';
 *
 * <DataGrid editing="dblclick" undoRedo={{ maxHistorySize: 100 }} />
 * ```
 *
 * @packageDocumentation
 */

import { UndoRedoPlugin } from '@toolbox-web/grid/plugins/undo-redo';
import { registerFeature } from '../lib/feature-registry';

registerFeature('undoRedo', (config) => {
  const options = typeof config === 'boolean' ? {} : ((config as any) ?? {});
  return new UndoRedoPlugin(options);
});
