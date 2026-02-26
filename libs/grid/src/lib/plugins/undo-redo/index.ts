/**
 * Undo Redo Plugin Entry Point
 * Re-exports plugin class and types for tree-shakeable imports.
 *
 * @module Plugins/Undo-Redo
 */
export type { CompoundEditAction, EditAction, UndoRedoAction, UndoRedoConfig, UndoRedoDetail } from './types';
export { UndoRedoPlugin } from './UndoRedoPlugin';
