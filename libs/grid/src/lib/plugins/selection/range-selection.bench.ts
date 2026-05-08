/**
 * Range Selection Benchmarks
 *
 * `getCellsInRange` and `isCellInAnyRange` are called when serializing a
 * selection to clipboard or styling visible cells. A 100K-cell range is a
 * realistic stress case (e.g. "select all" on a wide grid before copy).
 */

import { bench, describe } from 'vitest';
import { getAllCellsInRanges, getCellsInRange, isCellInAnyRange, mergeRanges, normalizeRange } from './range-selection';
import type { InternalCellRange } from './types';

// #region Fixtures

const SMALL: InternalCellRange = { startRow: 0, startCol: 0, endRow: 9, endCol: 9 }; // 100 cells
const MEDIUM: InternalCellRange = { startRow: 0, startCol: 0, endRow: 99, endCol: 9 }; // 1K cells
const LARGE: InternalCellRange = { startRow: 0, startCol: 0, endRow: 999, endCol: 99 }; // 100K cells

const MULTI_RANGES: InternalCellRange[] = [
  { startRow: 0, startCol: 0, endRow: 49, endCol: 9 },
  { startRow: 100, startCol: 0, endRow: 149, endCol: 9 },
  { startRow: 200, startCol: 0, endRow: 249, endCol: 9 },
  { startRow: 300, startCol: 0, endRow: 349, endCol: 9 },
];

// #endregion

describe('getCellsInRange', () => {
  bench('100 cells', () => {
    getCellsInRange(SMALL);
  });

  bench('1K cells', () => {
    getCellsInRange(MEDIUM);
  });

  bench('100K cells', () => {
    getCellsInRange(LARGE);
  });
});

describe('isCellInAnyRange', () => {
  bench('hit (4 ranges)', () => {
    isCellInAnyRange(120, 5, MULTI_RANGES);
  });

  bench('miss (4 ranges)', () => {
    isCellInAnyRange(500, 5, MULTI_RANGES);
  });
});

describe('getAllCellsInRanges', () => {
  bench('4 non-overlapping × 500 cells each', () => {
    getAllCellsInRanges(MULTI_RANGES);
  });
});

describe('helpers', () => {
  bench('normalizeRange', () => {
    normalizeRange(MEDIUM);
  });

  bench('mergeRanges (no-op)', () => {
    mergeRanges(MULTI_RANGES);
  });
});
