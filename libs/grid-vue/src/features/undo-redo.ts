/**
 * Undo/Redo feature for @toolbox-web/grid-vue
 *
 * Import this module to enable the `undoRedo` prop on TbwGrid.
 *
 * @example
 * ```vue
 * <script setup>
 * import '@toolbox-web/grid-vue/features/undo-redo';
 * </script>
 *
 * <template>
 *   <TbwGrid editing="dblclick" undoRedo />
 * </template>
 * ```
 *
 * @packageDocumentation
 */

import { UndoRedoPlugin } from '@toolbox-web/grid/plugins/undo-redo';
import { registerFeature } from '../lib/feature-registry';

registerFeature('undoRedo', (config) => {
  if (config === true) {
    return new UndoRedoPlugin();
  }
  return new UndoRedoPlugin(config ?? undefined);
});
