/**
 * Undo/Redo feature for @toolbox-web/grid-react
 *
 * Import this module to enable the `undoRedo` prop on DataGrid.
 * Also exports `useGridUndoRedo()` hook for programmatic undo/redo control.
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
 * @example Using the hook
 * ```tsx
 * import { useGridUndoRedo } from '@toolbox-web/grid-react/features/undo-redo';
 *
 * function UndoRedoToolbar() {
 *   const { undo, redo, canUndo, canRedo } = useGridUndoRedo();
 *
 *   return (
 *     <div>
 *       <button onClick={undo} disabled={!canUndo()}>Undo</button>
 *       <button onClick={redo} disabled={!canRedo()}>Redo</button>
 *     </div>
 *   );
 * }
 * ```
 *
 * @packageDocumentation
 */

import type { DataGridElement } from '@toolbox-web/grid';
import { UndoRedoPlugin, type UndoRedoAction } from '@toolbox-web/grid/plugins/undo-redo';
import { useCallback, useContext } from 'react';
import { GridElementContext } from '../lib/data-grid';
import { registerFeature } from '../lib/feature-registry';

registerFeature('undoRedo', (config) => {
  const options = typeof config === 'boolean' ? {} : ((config as any) ?? {});
  return new UndoRedoPlugin(options);
});

/**
 * Undo/Redo methods returned from useGridUndoRedo.
 */
export interface UndoRedoMethods {
  /**
   * Undo the last edit action.
   * @returns The undone action (or compound action), or null if nothing to undo
   */
  undo: () => UndoRedoAction | null;

  /**
   * Redo the last undone action.
   * @returns The redone action (or compound action), or null if nothing to redo
   */
  redo: () => UndoRedoAction | null;

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
  getUndoStack: () => UndoRedoAction[];

  /**
   * Get a copy of the current redo stack.
   */
  getRedoStack: () => UndoRedoAction[];

  /**
   * Manually record an edit action.
   * If a transaction is active, the action is buffered; otherwise it's pushed to the undo stack.
   */
  recordEdit: (rowIndex: number, field: string, oldValue: unknown, newValue: unknown) => void;

  /**
   * Begin a transaction. All edits recorded until `endTransaction()` are grouped
   * into a single compound action for undo/redo.
   * @throws If a transaction is already active
   */
  beginTransaction: () => void;

  /**
   * End the active transaction and push the compound action to the undo stack.
   * If only one edit was recorded, it's pushed as a plain EditAction.
   * If no edits were recorded, the transaction is discarded.
   * @throws If no transaction is active
   */
  endTransaction: () => void;
}

/**
 * Hook for programmatic undo/redo control.
 *
 * Must be used within a DataGrid component tree with undoRedo and editing enabled.
 *
 * @example
 * ```tsx
 * import { useGridUndoRedo } from '@toolbox-web/grid-react/features/undo-redo';
 *
 * function UndoRedoControls() {
 *   const { undo, redo, canUndo, canRedo, clearHistory } = useGridUndoRedo();
 *
 *   return (
 *     <div>
 *       <button onClick={undo} disabled={!canUndo()}>Undo</button>
 *       <button onClick={redo} disabled={!canRedo()}>Redo</button>
 *       <button onClick={clearHistory}>Clear History</button>
 *     </div>
 *   );
 * }
 * ```
 */
export function useGridUndoRedo(): UndoRedoMethods {
  const gridRef = useContext(GridElementContext);

  const getPlugin = useCallback((): UndoRedoPlugin | undefined => {
    const grid = gridRef?.current as DataGridElement | null;
    return grid?.getPlugin(UndoRedoPlugin);
  }, [gridRef]);

  const undo = useCallback(() => {
    const plugin = getPlugin();
    if (!plugin) {
      console.warn(
        `[tbw-grid:undoRedo] UndoRedoPlugin not found.\n\n` +
          `  → Enable undo/redo on the grid:\n` +
          `    <DataGrid editing="dblclick" undoRedo />`,
      );
      return null;
    }
    return plugin.undo();
  }, [getPlugin]);

  const redo = useCallback(() => {
    const plugin = getPlugin();
    if (!plugin) {
      console.warn(
        `[tbw-grid:undoRedo] UndoRedoPlugin not found.\n\n` +
          `  → Enable undo/redo on the grid:\n` +
          `    <DataGrid editing="dblclick" undoRedo />`,
      );
      return null;
    }
    return plugin.redo();
  }, [getPlugin]);

  const canUndo = useCallback(() => getPlugin()?.canUndo() ?? false, [getPlugin]);

  const canRedo = useCallback(() => getPlugin()?.canRedo() ?? false, [getPlugin]);

  const clearHistory = useCallback(() => {
    const plugin = getPlugin();
    if (!plugin) {
      console.warn(
        `[tbw-grid:undoRedo] UndoRedoPlugin not found.\n\n` +
          `  → Enable undo/redo on the grid:\n` +
          `    <DataGrid editing="dblclick" undoRedo />`,
      );
      return;
    }
    plugin.clearHistory();
  }, [getPlugin]);

  const getUndoStack = useCallback(() => getPlugin()?.getUndoStack() ?? [], [getPlugin]);

  const getRedoStack = useCallback(() => getPlugin()?.getRedoStack() ?? [], [getPlugin]);

  const recordEdit = useCallback(
    (rowIndex: number, field: string, oldValue: unknown, newValue: unknown) => {
      const plugin = getPlugin();
      if (!plugin) {
        console.warn(
          `[tbw-grid:undoRedo] UndoRedoPlugin not found.\n\n` +
            `  → Enable undo/redo on the grid:\n` +
            `    <DataGrid editing="dblclick" undoRedo />`,
        );
        return;
      }
      plugin.recordEdit(rowIndex, field, oldValue, newValue);
    },
    [getPlugin],
  );

  const beginTransaction = useCallback(() => {
    const plugin = getPlugin();
    if (!plugin) {
      console.warn(
        `[tbw-grid:undoRedo] UndoRedoPlugin not found.\n\n` +
          `  → Enable undo/redo on the grid:\n` +
          `    <DataGrid editing="dblclick" undoRedo />`,
      );
      return;
    }
    plugin.beginTransaction();
  }, [getPlugin]);

  const endTransaction = useCallback(() => {
    const plugin = getPlugin();
    if (!plugin) {
      console.warn(
        `[tbw-grid:undoRedo] UndoRedoPlugin not found.\n\n` +
          `  → Enable undo/redo on the grid:\n` +
          `    <DataGrid editing="dblclick" undoRedo />`,
      );
      return;
    }
    plugin.endTransaction();
  }, [getPlugin]);

  return {
    undo,
    redo,
    canUndo,
    canRedo,
    clearHistory,
    getUndoStack,
    getRedoStack,
    recordEdit,
    beginTransaction,
    endTransaction,
  };
}
