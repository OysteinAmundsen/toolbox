/**
 * Undo/Redo History Management
 *
 * Pure functions for managing the undo/redo stacks.
 * These functions are stateless and return new state objects.
 */

import type { EditAction, UndoRedoState } from './types';

/**
 * Push a new action onto the undo stack.
 * Clears the redo stack since new actions invalidate redo history.
 *
 * @param state - Current undo/redo state
 * @param action - The action to add
 * @param maxSize - Maximum history size
 * @returns New state with the action added
 */
export function pushAction(state: UndoRedoState, action: EditAction, maxSize: number): UndoRedoState {
  const undoStack = [...state.undoStack, action];

  // Trim oldest actions if over max size
  while (undoStack.length > maxSize) {
    undoStack.shift();
  }

  return {
    undoStack,
    redoStack: [], // Clear redo on new action
  };
}

/**
 * Undo the most recent action.
 * Moves the action from undo stack to redo stack.
 *
 * @param state - Current undo/redo state
 * @returns New state and the action that was undone (or null if nothing to undo)
 */
export function undo(state: UndoRedoState): {
  newState: UndoRedoState;
  action: EditAction | null;
} {
  if (state.undoStack.length === 0) {
    return { newState: state, action: null };
  }

  const undoStack = [...state.undoStack];
  const action = undoStack.pop();

  // This should never happen due to the length check above,
  // but TypeScript needs the explicit check
  if (!action) {
    return { newState: state, action: null };
  }

  return {
    newState: {
      undoStack,
      redoStack: [...state.redoStack, action],
    },
    action,
  };
}

/**
 * Redo the most recently undone action.
 * Moves the action from redo stack back to undo stack.
 *
 * @param state - Current undo/redo state
 * @returns New state and the action that was redone (or null if nothing to redo)
 */
export function redo(state: UndoRedoState): {
  newState: UndoRedoState;
  action: EditAction | null;
} {
  if (state.redoStack.length === 0) {
    return { newState: state, action: null };
  }

  const redoStack = [...state.redoStack];
  const action = redoStack.pop();

  // This should never happen due to the length check above,
  // but TypeScript needs the explicit check
  if (!action) {
    return { newState: state, action: null };
  }

  return {
    newState: {
      undoStack: [...state.undoStack, action],
      redoStack,
    },
    action,
  };
}

/**
 * Check if there are any actions that can be undone.
 *
 * @param state - Current undo/redo state
 * @returns True if undo is available
 */
export function canUndo(state: UndoRedoState): boolean {
  return state.undoStack.length > 0;
}

/**
 * Check if there are any actions that can be redone.
 *
 * @param state - Current undo/redo state
 * @returns True if redo is available
 */
export function canRedo(state: UndoRedoState): boolean {
  return state.redoStack.length > 0;
}

/**
 * Clear all history, returning an empty state.
 *
 * @returns Fresh empty state
 */
export function clearHistory(): UndoRedoState {
  return { undoStack: [], redoStack: [] };
}

/**
 * Create a new edit action with the current timestamp.
 *
 * @param rowIndex - The row index where the edit occurred
 * @param field - The field (column key) that was edited
 * @param oldValue - The value before the edit
 * @param newValue - The value after the edit
 * @returns A new EditAction object
 */
export function createEditAction(rowIndex: number, field: string, oldValue: unknown, newValue: unknown): EditAction {
  return {
    type: 'cell-edit',
    rowIndex,
    field,
    oldValue,
    newValue,
    timestamp: Date.now(),
  };
}
