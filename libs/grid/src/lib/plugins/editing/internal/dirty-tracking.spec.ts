import { beforeEach, describe, expect, it } from 'vitest';
import { captureBaselines, getOriginalRow, isRowDirty, markPristine, revertToBaseline } from './dirty-tracking';

interface TestRow {
  id: number;
  name: string;
  age: number;
}

describe('dirty-tracking pure functions', () => {
  let baselines: Map<string, TestRow>;
  const getRowId = (row: TestRow) => String(row.id);

  beforeEach(() => {
    baselines = new Map();
  });

  // #region captureBaselines

  describe('captureBaselines', () => {
    it('should capture baselines for new rows', () => {
      const rows: TestRow[] = [
        { id: 1, name: 'Alice', age: 30 },
        { id: 2, name: 'Bob', age: 25 },
      ];

      captureBaselines(baselines, rows, getRowId);

      expect(baselines.size).toBe(2);
      expect(baselines.get('1')).toEqual({ id: 1, name: 'Alice', age: 30 });
      expect(baselines.get('2')).toEqual({ id: 2, name: 'Bob', age: 25 });
    });

    it('should deep clone rows (structuredClone)', () => {
      const rows: TestRow[] = [{ id: 1, name: 'Alice', age: 30 }];

      captureBaselines(baselines, rows, getRowId);

      // Mutating the original should not affect the baseline
      rows[0].name = 'Modified';
      expect(baselines.get('1')!.name).toBe('Alice');
    });

    it('should not overwrite existing baselines (first-write-wins)', () => {
      const rows1: TestRow[] = [{ id: 1, name: 'Alice', age: 30 }];
      captureBaselines(baselines, rows1, getRowId);

      // Now re-capture with modified data (simulates Angular feedback loop)
      const rows2: TestRow[] = [{ id: 1, name: 'Bob', age: 25 }];
      captureBaselines(baselines, rows2, getRowId);

      // Baseline should still be the first capture
      expect(baselines.get('1')!.name).toBe('Alice');
      expect(baselines.get('1')!.age).toBe(30);
    });

    it('should skip rows with no resolvable ID', () => {
      const badGetId = () => undefined;
      const rows: TestRow[] = [{ id: 1, name: 'Alice', age: 30 }];

      captureBaselines(baselines, rows, badGetId);

      expect(baselines.size).toBe(0);
    });

    it('should handle getRowId throwing', () => {
      const throwingGetId = () => {
        throw new Error('no id');
      };
      const rows: TestRow[] = [{ id: 1, name: 'Alice', age: 30 }];

      captureBaselines(baselines, rows, throwingGetId);

      expect(baselines.size).toBe(0);
    });
  });

  // #endregion

  // #region isRowDirty

  describe('isRowDirty', () => {
    it('should return false when row matches baseline', () => {
      baselines.set('1', { id: 1, name: 'Alice', age: 30 });
      const current = { id: 1, name: 'Alice', age: 30 };

      expect(isRowDirty(baselines, '1', current)).toBe(false);
    });

    it('should return true when a property changed', () => {
      baselines.set('1', { id: 1, name: 'Alice', age: 30 });
      const current = { id: 1, name: 'Bob', age: 30 };

      expect(isRowDirty(baselines, '1', current)).toBe(true);
    });

    it('should return true when multiple properties changed', () => {
      baselines.set('1', { id: 1, name: 'Alice', age: 30 });
      const current = { id: 1, name: 'Bob', age: 25 };

      expect(isRowDirty(baselines, '1', current)).toBe(true);
    });

    it('should return false when no baseline exists', () => {
      const current = { id: 1, name: 'Alice', age: 30 };

      expect(isRowDirty(baselines, '99', current)).toBe(false);
    });

    it('should detect added properties as dirty', () => {
      baselines.set('1', { id: 1, name: 'Alice', age: 30 });
      const current = { id: 1, name: 'Alice', age: 30, extra: 'value' } as TestRow & {
        extra: string;
      };

      // Different key count = different
      expect(isRowDirty(baselines, '1', current as unknown as TestRow)).toBe(true);
    });
  });

  // #endregion

  // #region markPristine

  describe('markPristine', () => {
    it('should update baseline to current data', () => {
      baselines.set('1', { id: 1, name: 'Alice', age: 30 });
      const current = { id: 1, name: 'Bob', age: 25 };

      markPristine(baselines, '1', current);

      expect(baselines.get('1')).toEqual({ id: 1, name: 'Bob', age: 25 });
      expect(isRowDirty(baselines, '1', current)).toBe(false);
    });

    it('should deep clone when marking pristine', () => {
      const current = { id: 1, name: 'Bob', age: 25 };
      markPristine(baselines, '1', current);

      current.name = 'Modified';
      expect(baselines.get('1')!.name).toBe('Bob');
    });

    it('should create a baseline if none existed', () => {
      const current = { id: 1, name: 'Alice', age: 30 };
      markPristine(baselines, '1', current);

      expect(baselines.has('1')).toBe(true);
      expect(isRowDirty(baselines, '1', current)).toBe(false);
    });
  });

  // #endregion

  // #region getOriginalRow

  describe('getOriginalRow', () => {
    it('should return a deep clone of the baseline', () => {
      baselines.set('1', { id: 1, name: 'Alice', age: 30 });

      const original = getOriginalRow(baselines, '1');
      expect(original).toEqual({ id: 1, name: 'Alice', age: 30 });

      // Should be a clone, not the same reference
      original!.name = 'Modified';
      expect(baselines.get('1')!.name).toBe('Alice');
    });

    it('should return undefined for non-existent row', () => {
      expect(getOriginalRow(baselines, '99')).toBeUndefined();
    });
  });

  // #endregion

  // #region revertToBaseline

  describe('revertToBaseline', () => {
    it('should restore baseline values in-place', () => {
      baselines.set('1', { id: 1, name: 'Alice', age: 30 });
      const current = { id: 1, name: 'Bob', age: 99 };

      const result = revertToBaseline(baselines, '1', current);

      expect(result).toBe(true);
      expect(current.name).toBe('Alice');
      expect(current.age).toBe(30);
    });

    it('should return false when no baseline exists', () => {
      const current = { id: 1, name: 'Alice', age: 30 };

      const result = revertToBaseline(baselines, '99', current);

      expect(result).toBe(false);
    });

    it('should make the row pristine after revert', () => {
      baselines.set('1', { id: 1, name: 'Alice', age: 30 });
      const current = { id: 1, name: 'Bob', age: 99 };

      revertToBaseline(baselines, '1', current);

      expect(isRowDirty(baselines, '1', current)).toBe(false);
    });
  });

  // #endregion
});
