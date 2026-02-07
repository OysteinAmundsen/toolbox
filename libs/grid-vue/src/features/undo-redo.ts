/**
 * Undo/Redo feature for @toolbox-web/grid-vue
 *
 * Import this module to enable the `undoRedo` prop on TbwGrid.
 * Also exports `useGridUndoRedo()` composable for programmatic undo/redo control.
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
 * @example Using the composable
 * ```vue
 * <script setup>
 * import { useGridUndoRedo } from '@toolbox-web/grid-vue/features/undo-redo';
 *
 * const { undo, redo, canUndo, canRedo } = useGridUndoRedo();
 * </script>
 *
 * <template>
 *   <button @click="undo" :disabled="!canUndo()">Undo</button>
 *   <button @click="redo" :disabled="!canRedo()">Redo</button>
 * </template>
 * ```
 *
 * @packageDocumentation
 */

import type { DataGridElement } from '@toolbox-web/grid';
import { UndoRedoPlugin, type EditAction } from '@toolbox-web/grid/plugins/undo-redo';
import { inject, ref } from 'vue';
import { registerFeature } from '../lib/feature-registry';
import { GRID_ELEMENT_KEY } from '../lib/use-grid';

registerFeature('undoRedo', (config) => {
  if (config === true) {
    return new UndoRedoPlugin();
  }
  return new UndoRedoPlugin(config ?? undefined);
});

/**
 * Undo/Redo methods returned from useGridUndoRedo.
 */
export interface UndoRedoMethods {
  /**
   * Undo the last edit action.
   * @returns The undone action, or null if nothing to undo
   */
  undo: () => EditAction | null;

  /**
   * Redo the last undone action.
   * @returns The redone action, or null if nothing to redo
   */
  redo: () => EditAction | null;

  /**
   * Check if there are any actions that can be undone.
   */
  canUndo: () => boolean;

  /**
   * Check if there are any actions that can be redone.
   */
  canRedo: () => boolean;

  /**
   * Clear all undo/redo history.
   */
  clearHistory: () => void;

  /**
   * Get a copy of the current undo stack.
   */
  getUndoStack: () => EditAction[];

  /**
   * Get a copy of the current redo stack.
   */
  getRedoStack: () => EditAction[];
}

/**
 * Composable for programmatic undo/redo control.
 *
 * Must be used within a component that contains a TbwGrid with undoRedo and editing enabled.
 *
 * @example
 * ```vue
 * <script setup>
 * import { useGridUndoRedo } from '@toolbox-web/grid-vue/features/undo-redo';
 *
 * const { undo, redo, canUndo, canRedo, clearHistory } = useGridUndoRedo();
 * </script>
 *
 * <template>
 *   <div class="toolbar">
 *     <button @click="undo" :disabled="!canUndo()">Undo</button>
 *     <button @click="redo" :disabled="!canRedo()">Redo</button>
 *     <button @click="clearHistory">Clear History</button>
 *   </div>
 * </template>
 * ```
 */
export function useGridUndoRedo(): UndoRedoMethods {
  const gridElement = inject(GRID_ELEMENT_KEY, ref(null));

  const getPlugin = (): UndoRedoPlugin | undefined => {
    const grid = gridElement.value as DataGridElement | null;
    return grid?.getPlugin(UndoRedoPlugin);
  };

  return {
    undo: () => {
      const plugin = getPlugin();
      if (!plugin) {
        console.warn(
          `[tbw-grid:undoRedo] UndoRedoPlugin not found.\n\n` +
            `  → Enable undo/redo on the grid:\n` +
            `    <TbwGrid editing="dblclick" undoRedo />`,
        );
        return null;
      }
      return plugin.undo();
    },

    redo: () => {
      const plugin = getPlugin();
      if (!plugin) {
        console.warn(
          `[tbw-grid:undoRedo] UndoRedoPlugin not found.\n\n` +
            `  → Enable undo/redo on the grid:\n` +
            `    <TbwGrid editing="dblclick" undoRedo />`,
        );
        return null;
      }
      return plugin.redo();
    },

    canUndo: () => getPlugin()?.canUndo() ?? false,

    canRedo: () => getPlugin()?.canRedo() ?? false,

    clearHistory: () => {
      const plugin = getPlugin();
      if (!plugin) {
        console.warn(
          `[tbw-grid:undoRedo] UndoRedoPlugin not found.\n\n` +
            `  → Enable undo/redo on the grid:\n` +
            `    <TbwGrid editing="dblclick" undoRedo />`,
        );
        return;
      }
      plugin.clearHistory();
    },

    getUndoStack: () => getPlugin()?.getUndoStack() ?? [],

    getRedoStack: () => getPlugin()?.getRedoStack() ?? [],
  };
}
