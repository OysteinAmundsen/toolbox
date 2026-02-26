import { beforeEach, describe, expect, it } from 'vitest';
import { captureBaselines, getOriginalRow, isCellDirty, isRowDirty, markPristine, revertToBaseline } from './dirty-tracking';

interface TestRow {
  id: number;
  name: string;
  age: number;
}

interface ComplexRow {
  id: number;
  name: string;
  address: { city: string; zip: string };
  tags: string[];
  createdAt: Date;
  metadata?: { scores: number[] } | null;
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

  // #region isRowDirty (deep comparison)

  describe('isRowDirty (deep comparison with nested objects)', () => {
    let complexBaselines: Map<string, ComplexRow>;
    const getId = (row: ComplexRow) => String(row.id);

    beforeEach(() => {
      complexBaselines = new Map();
    });

    it('should return false when nested objects are equal (different references)', () => {
      const row: ComplexRow = {
        id: 1,
        name: 'Alice',
        address: { city: 'Oslo', zip: '0150' },
        tags: ['admin', 'user'],
        createdAt: new Date('2025-01-15'),
      };

      // structuredClone creates new references for nested objects
      captureBaselines(complexBaselines, [row], getId);

      // Same row object — nested refs differ from cloned baseline
      expect(isRowDirty(complexBaselines, '1', row)).toBe(false);
    });

    it('should detect nested object property change', () => {
      const row: ComplexRow = {
        id: 1,
        name: 'Alice',
        address: { city: 'Oslo', zip: '0150' },
        tags: ['admin'],
        createdAt: new Date('2025-01-15'),
      };
      captureBaselines(complexBaselines, [row], getId);

      // Mutate nested property
      const modified = { ...row, address: { city: 'Bergen', zip: '0150' } };
      expect(isRowDirty(complexBaselines, '1', modified)).toBe(true);
    });

    it('should detect array element change', () => {
      const row: ComplexRow = {
        id: 1,
        name: 'Alice',
        address: { city: 'Oslo', zip: '0150' },
        tags: ['admin', 'user'],
        createdAt: new Date('2025-01-15'),
      };
      captureBaselines(complexBaselines, [row], getId);

      const modified = { ...row, tags: ['admin', 'editor'] };
      expect(isRowDirty(complexBaselines, '1', modified)).toBe(true);
    });

    it('should detect array length change', () => {
      const row: ComplexRow = {
        id: 1,
        name: 'Alice',
        address: { city: 'Oslo', zip: '0150' },
        tags: ['admin'],
        createdAt: new Date('2025-01-15'),
      };
      captureBaselines(complexBaselines, [row], getId);

      const modified = { ...row, tags: ['admin', 'user'] };
      expect(isRowDirty(complexBaselines, '1', modified)).toBe(true);
    });

    it('should detect Date change', () => {
      const row: ComplexRow = {
        id: 1,
        name: 'Alice',
        address: { city: 'Oslo', zip: '0150' },
        tags: [],
        createdAt: new Date('2025-01-15'),
      };
      captureBaselines(complexBaselines, [row], getId);

      const modified = { ...row, createdAt: new Date('2026-06-01') };
      expect(isRowDirty(complexBaselines, '1', modified)).toBe(true);
    });

    it('should return false for equal Dates with different references', () => {
      const row: ComplexRow = {
        id: 1,
        name: 'Alice',
        address: { city: 'Oslo', zip: '0150' },
        tags: [],
        createdAt: new Date('2025-01-15'),
      };
      captureBaselines(complexBaselines, [row], getId);

      // New Date object with same value
      const same = { ...row, createdAt: new Date('2025-01-15') };
      expect(isRowDirty(complexBaselines, '1', same)).toBe(false);
    });

    it('should handle null vs object', () => {
      const row: ComplexRow = {
        id: 1,
        name: 'Alice',
        address: { city: 'Oslo', zip: '0150' },
        tags: [],
        createdAt: new Date('2025-01-15'),
        metadata: { scores: [1, 2, 3] },
      };
      captureBaselines(complexBaselines, [row], getId);

      const modified = { ...row, metadata: null };
      expect(isRowDirty(complexBaselines, '1', modified)).toBe(true);
    });

    it('should handle deeply nested arrays within objects', () => {
      const row: ComplexRow = {
        id: 1,
        name: 'Alice',
        address: { city: 'Oslo', zip: '0150' },
        tags: [],
        createdAt: new Date('2025-01-15'),
        metadata: { scores: [10, 20, 30] },
      };
      captureBaselines(complexBaselines, [row], getId);

      // Same values, different references
      const same = { ...row, metadata: { scores: [10, 20, 30] } };
      expect(isRowDirty(complexBaselines, '1', same)).toBe(false);

      // Changed nested array value
      const modified = { ...row, metadata: { scores: [10, 20, 99] } };
      expect(isRowDirty(complexBaselines, '1', modified)).toBe(true);
    });
  });

  // #endregion

  // #region isCellDirty

  describe('isCellDirty', () => {
    it('should return false when cell value matches baseline', () => {
      baselines.set('1', { id: 1, name: 'Alice', age: 30 });
      const current = { id: 1, name: 'Alice', age: 30 };

      expect(isCellDirty(baselines, '1', current, 'name')).toBe(false);
      expect(isCellDirty(baselines, '1', current, 'age')).toBe(false);
    });

    it('should return true when cell value differs from baseline', () => {
      baselines.set('1', { id: 1, name: 'Alice', age: 30 });
      const current = { id: 1, name: 'Bob', age: 30 };

      expect(isCellDirty(baselines, '1', current, 'name')).toBe(true);
      expect(isCellDirty(baselines, '1', current, 'age')).toBe(false);
    });

    it('should return false when no baseline exists', () => {
      const current = { id: 1, name: 'Alice', age: 30 };

      expect(isCellDirty(baselines, '99', current, 'name')).toBe(false);
    });

    it('should detect nested object property changes per cell', () => {
      const complexBaselines = new Map<string, ComplexRow>();
      complexBaselines.set('1', {
        id: 1,
        name: 'Alice',
        address: { city: 'Oslo', zip: '0150' },
        tags: ['admin'],
        createdAt: new Date('2025-01-15'),
      });
      const current: ComplexRow = {
        id: 1,
        name: 'Alice',
        address: { city: 'Bergen', zip: '0150' },
        tags: ['admin'],
        createdAt: new Date('2025-01-15'),
      };

      expect(isCellDirty(complexBaselines, '1', current, 'name')).toBe(false);
      expect(isCellDirty(complexBaselines, '1', current, 'address')).toBe(true);
      expect(isCellDirty(complexBaselines, '1', current, 'tags')).toBe(false);
    });

    it('should handle Date comparisons per cell', () => {
      const complexBaselines = new Map<string, ComplexRow>();
      complexBaselines.set('1', {
        id: 1,
        name: 'Alice',
        address: { city: 'Oslo', zip: '0150' },
        tags: [],
        createdAt: new Date('2025-01-15'),
      });
      const current: ComplexRow = {
        id: 1,
        name: 'Alice',
        address: { city: 'Oslo', zip: '0150' },
        tags: [],
        createdAt: new Date('2026-06-01'),
      };

      expect(isCellDirty(complexBaselines, '1', current, 'createdAt')).toBe(true);
      expect(isCellDirty(complexBaselines, '1', current, 'name')).toBe(false);
    });

    it('should handle null-to-value transitions per cell', () => {
      const complexBaselines = new Map<string, ComplexRow>();
      complexBaselines.set('1', {
        id: 1,
        name: 'Alice',
        address: { city: 'Oslo', zip: '0150' },
        tags: [],
        createdAt: new Date('2025-01-15'),
        metadata: null,
      });
      const current: ComplexRow = {
        id: 1,
        name: 'Alice',
        address: { city: 'Oslo', zip: '0150' },
        tags: [],
        createdAt: new Date('2025-01-15'),
        metadata: { scores: [1, 2, 3] },
      };

      expect(isCellDirty(complexBaselines, '1', current, 'metadata')).toBe(true);
      expect(isCellDirty(complexBaselines, '1', current, 'name')).toBe(false);
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
