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

/**
 * A group of edit actions that are undone/redone as a single unit.
 *
 * Created via `beginTransaction()` / `endTransaction()` when multiple
 * field edits should be treated as one logical operation (e.g., a user
 * edit that cascades changes to other fields).
 */
export interface CompoundEditAction {
  /** Discriminant for compound actions */
  type: 'compound';
  /** Individual edit actions in chronological order */
  actions: EditAction[];
  /** Unix timestamp when the compound was finalized */
  timestamp: number;
}

/** A single edit or a compound group of edits on the undo/redo stack */
export type UndoRedoAction = EditAction | CompoundEditAction;

/** Internal state maintained by the undo/redo plugin */
export interface UndoRedoState {
  /** Stack of actions that can be undone (most recent last) */
  undoStack: UndoRedoAction[];
  /** Stack of actions that can be redone (most recent last) */
  redoStack: UndoRedoAction[];
}

/** Event detail emitted when an undo or redo operation is performed */
export interface UndoRedoDetail {
  /** The action that was undone or redone */
  action: UndoRedoAction;
  /** Whether this was an undo or redo operation */
  type: 'undo' | 'redo';
}

// Module Augmentation - Register plugin name for type-safe getPluginByName()
declare module '../../core/types' {
  interface PluginNameMap {
    undoRedo: import('./UndoRedoPlugin').UndoRedoPlugin;
  }
}
