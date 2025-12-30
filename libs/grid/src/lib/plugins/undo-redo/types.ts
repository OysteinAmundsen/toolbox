/**
 * Undo/Redo Plugin Types
 *
 * Type definitions for the undo/redo plugin that tracks
 * cell edits and provides undo/redo functionality.
 */

/** Configuration for the undo/redo plugin */
export interface UndoRedoConfig {
  /** Maximum number of actions to keep in history. Default: 100 */
  maxHistorySize?: number;
}

/** Represents a single edit action that can be undone/redone */
export interface EditAction {
  /** Type of action - currently only 'cell-edit' is supported */
  type: 'cell-edit';
  /** The row index where the edit occurred */
  rowIndex: number;
  /** The field (column key) that was edited */
  field: string;
  /** The value before the edit */
  oldValue: unknown;
  /** The value after the edit */
  newValue: unknown;
  /** Unix timestamp when the edit occurred */
  timestamp: number;
}

/** Internal state maintained by the undo/redo plugin */
export interface UndoRedoState {
  /** Stack of actions that can be undone (most recent last) */
  undoStack: EditAction[];
  /** Stack of actions that can be redone (most recent last) */
  redoStack: EditAction[];
}

/** Event detail emitted when an undo or redo operation is performed */
export interface UndoRedoDetail {
  /** The action that was undone or redone */
  action: EditAction;
  /** Whether this was an undo or redo operation */
  type: 'undo' | 'redo';
}
