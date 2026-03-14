/**
 * Tests for CellValidationManager.
 *
 * Covers:
 * - setInvalid / clearInvalid (single cell)
 * - clearRowInvalid / clearAllInvalid (bulk)
 * - Read operations: isCellInvalid, getInvalidMessage, hasInvalidCells, getInvalidFields
 * - DOM sync callback invocations
 */
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { CellValidationManager } from './cell-validation';

describe('CellValidationManager', () => {
  let syncFn: ReturnType<typeof vi.fn>;
  let manager: CellValidationManager;

  beforeEach(() => {
    syncFn = vi.fn();
    manager = new CellValidationManager(syncFn);
  });

  // #region setInvalid

  describe('setInvalid', () => {
    it('should mark a cell as invalid', () => {
      manager.setInvalid('row1', 'name', 'Required');

      expect(manager.isCellInvalid('row1', 'name')).toBe(true);
    });

    it('should store the validation message', () => {
      manager.setInvalid('row1', 'email', 'Invalid email');

      expect(manager.getInvalidMessage('row1', 'email')).toBe('Invalid email');
    });

    it('should default message to empty string', () => {
      manager.setInvalid('row1', 'age');

      expect(manager.getInvalidMessage('row1', 'age')).toBe('');
    });

    it('should call syncAttribute with invalid=true', () => {
      manager.setInvalid('row1', 'name', 'Required');

      expect(syncFn).toHaveBeenCalledWith('row1', 'name', true);
    });

    it('should allow multiple invalid cells on the same row', () => {
      manager.setInvalid('row1', 'name', 'Required');
      manager.setInvalid('row1', 'email', 'Invalid');

      expect(manager.isCellInvalid('row1', 'name')).toBe(true);
      expect(manager.isCellInvalid('row1', 'email')).toBe(true);
    });

    it('should allow invalid cells on different rows', () => {
      manager.setInvalid('row1', 'name', 'Required');
      manager.setInvalid('row2', 'name', 'Too long');

      expect(manager.getInvalidMessage('row1', 'name')).toBe('Required');
      expect(manager.getInvalidMessage('row2', 'name')).toBe('Too long');
    });

    it('should overwrite a previous message for the same cell', () => {
      manager.setInvalid('row1', 'name', 'Required');
      manager.setInvalid('row1', 'name', 'Too short');

      expect(manager.getInvalidMessage('row1', 'name')).toBe('Too short');
      expect(syncFn).toHaveBeenCalledTimes(2);
    });
  });

  // #endregion

  // #region clearInvalid

  describe('clearInvalid', () => {
    it('should clear a single invalid cell', () => {
      manager.setInvalid('row1', 'name', 'Required');
      manager.clearInvalid('row1', 'name');

      expect(manager.isCellInvalid('row1', 'name')).toBe(false);
    });

    it('should call syncAttribute with invalid=false', () => {
      manager.setInvalid('row1', 'name', 'Required');
      syncFn.mockClear();

      manager.clearInvalid('row1', 'name');

      expect(syncFn).toHaveBeenCalledWith('row1', 'name', false);
    });

    it('should remove the row entry when its last field is cleared', () => {
      manager.setInvalid('row1', 'name', 'Required');
      manager.clearInvalid('row1', 'name');

      expect(manager.hasInvalidCells('row1')).toBe(false);
    });

    it('should keep other fields when only one is cleared', () => {
      manager.setInvalid('row1', 'name', 'Required');
      manager.setInvalid('row1', 'email', 'Invalid');
      manager.clearInvalid('row1', 'name');

      expect(manager.isCellInvalid('row1', 'name')).toBe(false);
      expect(manager.isCellInvalid('row1', 'email')).toBe(true);
    });

    it('should not throw when clearing a cell that is not invalid', () => {
      expect(() => manager.clearInvalid('row1', 'name')).not.toThrow();
      expect(syncFn).toHaveBeenCalledWith('row1', 'name', false);
    });
  });

  // #endregion

  // #region clearRowInvalid

  describe('clearRowInvalid', () => {
    it('should clear all invalid cells for a row', () => {
      manager.setInvalid('row1', 'name', 'Required');
      manager.setInvalid('row1', 'email', 'Invalid');
      manager.setInvalid('row1', 'age', 'Too young');

      manager.clearRowInvalid('row1');

      expect(manager.hasInvalidCells('row1')).toBe(false);
      expect(manager.isCellInvalid('row1', 'name')).toBe(false);
      expect(manager.isCellInvalid('row1', 'email')).toBe(false);
      expect(manager.isCellInvalid('row1', 'age')).toBe(false);
    });

    it('should call syncAttribute for each cleared field', () => {
      manager.setInvalid('row1', 'name', 'Required');
      manager.setInvalid('row1', 'email', 'Invalid');
      syncFn.mockClear();

      manager.clearRowInvalid('row1');

      expect(syncFn).toHaveBeenCalledWith('row1', 'name', false);
      expect(syncFn).toHaveBeenCalledWith('row1', 'email', false);
      expect(syncFn).toHaveBeenCalledTimes(2);
    });

    it('should not affect other rows', () => {
      manager.setInvalid('row1', 'name', 'Required');
      manager.setInvalid('row2', 'name', 'Also required');

      manager.clearRowInvalid('row1');

      expect(manager.isCellInvalid('row2', 'name')).toBe(true);
    });

    it('should be a no-op for a row with no invalid cells', () => {
      syncFn.mockClear();
      manager.clearRowInvalid('row99');

      expect(syncFn).not.toHaveBeenCalled();
    });
  });

  // #endregion

  // #region clearAllInvalid

  describe('clearAllInvalid', () => {
    it('should clear all invalid cells across all rows', () => {
      manager.setInvalid('row1', 'name', 'Required');
      manager.setInvalid('row1', 'email', 'Invalid');
      manager.setInvalid('row2', 'age', 'Too young');

      manager.clearAllInvalid();

      expect(manager.hasInvalidCells('row1')).toBe(false);
      expect(manager.hasInvalidCells('row2')).toBe(false);
    });

    it('should call syncAttribute for every cleared field', () => {
      manager.setInvalid('row1', 'name', 'A');
      manager.setInvalid('row2', 'email', 'B');
      syncFn.mockClear();

      manager.clearAllInvalid();

      expect(syncFn).toHaveBeenCalledWith('row1', 'name', false);
      expect(syncFn).toHaveBeenCalledWith('row2', 'email', false);
      expect(syncFn).toHaveBeenCalledTimes(2);
    });

    it('should be a no-op when no cells are invalid', () => {
      syncFn.mockClear();
      manager.clearAllInvalid();

      expect(syncFn).not.toHaveBeenCalled();
    });
  });

  // #endregion

  // #region Read Operations

  describe('isCellInvalid', () => {
    it('should return false for a cell that was never marked', () => {
      expect(manager.isCellInvalid('row1', 'name')).toBe(false);
    });

    it('should return true for a marked cell', () => {
      manager.setInvalid('row1', 'name');
      expect(manager.isCellInvalid('row1', 'name')).toBe(true);
    });

    it('should return false after clearing', () => {
      manager.setInvalid('row1', 'name');
      manager.clearInvalid('row1', 'name');
      expect(manager.isCellInvalid('row1', 'name')).toBe(false);
    });
  });

  describe('getInvalidMessage', () => {
    it('should return undefined for a valid cell', () => {
      expect(manager.getInvalidMessage('row1', 'name')).toBeUndefined();
    });

    it('should return the message for an invalid cell', () => {
      manager.setInvalid('row1', 'name', 'Field is required');
      expect(manager.getInvalidMessage('row1', 'name')).toBe('Field is required');
    });

    it('should return undefined for an unknown row', () => {
      expect(manager.getInvalidMessage('nonexistent', 'name')).toBeUndefined();
    });
  });

  describe('hasInvalidCells', () => {
    it('should return false for a row with no invalid cells', () => {
      expect(manager.hasInvalidCells('row1')).toBe(false);
    });

    it('should return true when a row has at least one invalid cell', () => {
      manager.setInvalid('row1', 'name');
      expect(manager.hasInvalidCells('row1')).toBe(true);
    });

    it('should return false after all cells in the row are cleared', () => {
      manager.setInvalid('row1', 'name');
      manager.clearInvalid('row1', 'name');
      expect(manager.hasInvalidCells('row1')).toBe(false);
    });
  });

  describe('getInvalidFields', () => {
    it('should return an empty map for a row with no invalid cells', () => {
      const fields = manager.getInvalidFields('row1');
      expect(fields.size).toBe(0);
    });

    it('should return all invalid fields with messages', () => {
      manager.setInvalid('row1', 'name', 'Required');
      manager.setInvalid('row1', 'email', 'Invalid format');

      const fields = manager.getInvalidFields('row1');
      expect(fields.size).toBe(2);
      expect(fields.get('name')).toBe('Required');
      expect(fields.get('email')).toBe('Invalid format');
    });

    it('should return a copy (not the internal map)', () => {
      manager.setInvalid('row1', 'name', 'Required');

      const fields = manager.getInvalidFields('row1');
      fields.set('hacked', 'injected');

      // Internal state should be unaffected
      expect(manager.isCellInvalid('row1', 'hacked')).toBe(false);
    });
  });

  // #endregion
});
