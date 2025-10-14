import { describe, it, expect, beforeEach } from 'vitest';
import { pushAction, undo, redo, canUndo, canRedo, clearHistory, createEditAction } from './history';
import type { UndoRedoState } from './types';

describe('undo-redo history', () => {
  let emptyState: UndoRedoState;

  beforeEach(() => {
    emptyState = { undoStack: [], redoStack: [] };
  });

  describe('createEditAction', () => {
    it('should create a valid action with all properties', () => {
      const before = Date.now();
      const action = createEditAction(0, 'name', 'old', 'new');
      const after = Date.now();

      expect(action.type).toBe('cell-edit');
      expect(action.rowIndex).toBe(0);
      expect(action.field).toBe('name');
      expect(action.oldValue).toBe('old');
      expect(action.newValue).toBe('new');
      expect(action.timestamp).toBeGreaterThanOrEqual(before);
      expect(action.timestamp).toBeLessThanOrEqual(after);
    });

    it('should handle different value types', () => {
      const actionNumber = createEditAction(1, 'age', 25, 30);
      expect(actionNumber.oldValue).toBe(25);
      expect(actionNumber.newValue).toBe(30);

      const actionNull = createEditAction(2, 'status', null, 'active');
      expect(actionNull.oldValue).toBe(null);
      expect(actionNull.newValue).toBe('active');

      const actionObject = createEditAction(3, 'data', { a: 1 }, { b: 2 });
      expect(actionObject.oldValue).toEqual({ a: 1 });
      expect(actionObject.newValue).toEqual({ b: 2 });
    });
  });

  describe('pushAction', () => {
    it('should add action to undo stack', () => {
      const action = createEditAction(0, 'name', 'old', 'new');
      const newState = pushAction(emptyState, action, 100);

      expect(newState.undoStack).toHaveLength(1);
      expect(newState.undoStack[0]).toBe(action);
    });

    it('should clear redo stack when pushing new action', () => {
      const action1 = createEditAction(0, 'name', 'a', 'b');
      const action2 = createEditAction(1, 'age', 20, 30);

      // First push
      let state = pushAction(emptyState, action1, 100);
      // Simulate undo to populate redo stack
      const undoResult = undo(state);
      state = undoResult.newState;
      expect(state.redoStack).toHaveLength(1);

      // Push new action should clear redo
      state = pushAction(state, action2, 100);
      expect(state.redoStack).toHaveLength(0);
    });

    it('should trim oldest actions when exceeding max size', () => {
      let state = emptyState;
      const maxSize = 3;

      // Add 5 actions
      for (let i = 0; i < 5; i++) {
        const action = createEditAction(i, 'field', i, i + 1);
        state = pushAction(state, action, maxSize);
      }

      expect(state.undoStack).toHaveLength(3);
      // First two actions should be trimmed, remaining should be 2, 3, 4
      expect(state.undoStack[0].rowIndex).toBe(2);
      expect(state.undoStack[1].rowIndex).toBe(3);
      expect(state.undoStack[2].rowIndex).toBe(4);
    });

    it('should handle maxSize of 1', () => {
      let state = emptyState;
      const action1 = createEditAction(0, 'a', 1, 2);
      const action2 = createEditAction(1, 'b', 3, 4);

      state = pushAction(state, action1, 1);
      state = pushAction(state, action2, 1);

      expect(state.undoStack).toHaveLength(1);
      expect(state.undoStack[0].rowIndex).toBe(1);
    });
  });

  describe('undo', () => {
    it('should move action from undo stack to redo stack', () => {
      const action = createEditAction(0, 'name', 'old', 'new');
      const state = pushAction(emptyState, action, 100);

      const result = undo(state);

      expect(result.action).toBe(action);
      expect(result.newState.undoStack).toHaveLength(0);
      expect(result.newState.redoStack).toHaveLength(1);
      expect(result.newState.redoStack[0]).toBe(action);
    });

    it('should return null action when undo stack is empty', () => {
      const result = undo(emptyState);

      expect(result.action).toBeNull();
      expect(result.newState).toBe(emptyState);
    });

    it('should undo actions in LIFO order', () => {
      const action1 = createEditAction(0, 'name', 'a', 'b');
      const action2 = createEditAction(1, 'age', 20, 30);

      let state = pushAction(emptyState, action1, 100);
      state = pushAction(state, action2, 100);

      // First undo returns most recent action
      let result = undo(state);
      expect(result.action).toBe(action2);

      // Second undo returns first action
      result = undo(result.newState);
      expect(result.action).toBe(action1);
    });

    it('should not mutate original state', () => {
      const action = createEditAction(0, 'name', 'old', 'new');
      const state = pushAction(emptyState, action, 100);
      const originalLength = state.undoStack.length;

      undo(state);

      expect(state.undoStack.length).toBe(originalLength);
    });
  });

  describe('redo', () => {
    it('should move action from redo stack to undo stack', () => {
      const action = createEditAction(0, 'name', 'old', 'new');
      let state = pushAction(emptyState, action, 100);
      const undoResult = undo(state);
      state = undoResult.newState;

      const result = redo(state);

      expect(result.action).toBe(action);
      expect(result.newState.redoStack).toHaveLength(0);
      expect(result.newState.undoStack).toHaveLength(1);
      expect(result.newState.undoStack[0]).toBe(action);
    });

    it('should return null action when redo stack is empty', () => {
      const result = redo(emptyState);

      expect(result.action).toBeNull();
      expect(result.newState).toBe(emptyState);
    });

    it('should redo actions in LIFO order', () => {
      const action1 = createEditAction(0, 'name', 'a', 'b');
      const action2 = createEditAction(1, 'age', 20, 30);

      let state = pushAction(emptyState, action1, 100);
      state = pushAction(state, action2, 100);

      // Undo both (action2 first, then action1)
      let result = undo(state);
      result = undo(result.newState);
      state = result.newState;

      // Redo returns action1 first (last pushed to redo stack)
      result = redo(state);
      expect(result.action).toBe(action1);

      // Redo returns action2 second
      result = redo(result.newState);
      expect(result.action).toBe(action2);
    });

    it('should not mutate original state', () => {
      const action = createEditAction(0, 'name', 'old', 'new');
      let state = pushAction(emptyState, action, 100);
      state = undo(state).newState;
      const originalLength = state.redoStack.length;

      redo(state);

      expect(state.redoStack.length).toBe(originalLength);
    });
  });

  describe('canUndo', () => {
    it('should return false for empty undo stack', () => {
      expect(canUndo(emptyState)).toBe(false);
    });

    it('should return true when undo stack has actions', () => {
      const action = createEditAction(0, 'name', 'old', 'new');
      const state = pushAction(emptyState, action, 100);

      expect(canUndo(state)).toBe(true);
    });

    it('should return false after all actions are undone', () => {
      const action = createEditAction(0, 'name', 'old', 'new');
      let state = pushAction(emptyState, action, 100);
      state = undo(state).newState;

      expect(canUndo(state)).toBe(false);
    });
  });

  describe('canRedo', () => {
    it('should return false for empty redo stack', () => {
      expect(canRedo(emptyState)).toBe(false);
    });

    it('should return true when redo stack has actions', () => {
      const action = createEditAction(0, 'name', 'old', 'new');
      let state = pushAction(emptyState, action, 100);
      state = undo(state).newState;

      expect(canRedo(state)).toBe(true);
    });

    it('should return false after new action is pushed', () => {
      const action1 = createEditAction(0, 'name', 'old', 'new');
      const action2 = createEditAction(1, 'age', 20, 30);

      let state = pushAction(emptyState, action1, 100);
      state = undo(state).newState;
      expect(canRedo(state)).toBe(true);

      state = pushAction(state, action2, 100);
      expect(canRedo(state)).toBe(false);
    });
  });

  describe('clearHistory', () => {
    it('should return empty state', () => {
      const state = clearHistory();

      expect(state.undoStack).toEqual([]);
      expect(state.redoStack).toEqual([]);
    });

    it('should be usable to reset state with actions', () => {
      const action = createEditAction(0, 'name', 'old', 'new');
      const state = pushAction(emptyState, action, 100);
      expect(state.undoStack).toHaveLength(1);

      const cleared = clearHistory();
      expect(cleared.undoStack).toHaveLength(0);
      expect(cleared.redoStack).toHaveLength(0);
    });
  });

  describe('undo/redo cycle', () => {
    it('should correctly cycle through multiple undo/redo operations', () => {
      const actions = [createEditAction(0, 'a', 1, 2), createEditAction(1, 'b', 3, 4), createEditAction(2, 'c', 5, 6)];

      // Push all actions
      let state = emptyState;
      for (const action of actions) {
        state = pushAction(state, action, 100);
      }
      expect(state.undoStack).toHaveLength(3);

      // Undo all
      for (let i = 0; i < 3; i++) {
        state = undo(state).newState;
      }
      expect(state.undoStack).toHaveLength(0);
      expect(state.redoStack).toHaveLength(3);

      // Redo all
      for (let i = 0; i < 3; i++) {
        state = redo(state).newState;
      }
      expect(state.undoStack).toHaveLength(3);
      expect(state.redoStack).toHaveLength(0);
    });

    it('should handle partial undo with new action correctly', () => {
      const action1 = createEditAction(0, 'a', 1, 2);
      const action2 = createEditAction(1, 'b', 3, 4);
      const action3 = createEditAction(2, 'c', 5, 6);

      // Push two actions
      let state = pushAction(emptyState, action1, 100);
      state = pushAction(state, action2, 100);

      // Undo one
      state = undo(state).newState;
      expect(state.undoStack).toHaveLength(1);
      expect(state.redoStack).toHaveLength(1);

      // Push new action (should clear redo)
      state = pushAction(state, action3, 100);
      expect(state.undoStack).toHaveLength(2);
      expect(state.redoStack).toHaveLength(0);

      // Verify stack contents
      expect(state.undoStack[0]).toBe(action1);
      expect(state.undoStack[1]).toBe(action3);
    });
  });
});
