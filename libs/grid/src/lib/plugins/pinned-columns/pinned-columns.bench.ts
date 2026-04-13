import { bench, describe } from 'vitest';
import {
  getLeftStickyColumns,
  getRightStickyColumns,
  hasStickyColumns,
  reorderColumnsForPinning,
} from './pinned-columns';

// #region Data Generators

function generateColumns(count: number, pinnedRatio = 0.1) {
  const columns: any[] = [];
  const pinnedLeftCount = Math.floor(count * pinnedRatio);
  const pinnedRightCount = Math.floor(count * pinnedRatio);

  for (let i = 0; i < count; i++) {
    const col: any = { field: `col${i}`, header: `Column ${i}`, width: 120 };
    if (i < pinnedLeftCount) {
      col.pinned = 'left';
    } else if (i >= count - pinnedRightCount) {
      col.pinned = 'right';
    }
    columns.push(col);
  }
  return columns;
}

// #endregion

// #region reorderColumnsForPinning

describe('reorderColumnsForPinning', () => {
  const cols10 = generateColumns(10);
  const cols50 = generateColumns(50);
  const cols200 = generateColumns(200);
  const cols200_20pct = generateColumns(200, 0.2);

  bench('10 columns — 10% pinned', () => {
    reorderColumnsForPinning(cols10);
  });

  bench('50 columns — 10% pinned', () => {
    reorderColumnsForPinning(cols50);
  });

  bench('200 columns — 10% pinned', () => {
    reorderColumnsForPinning(cols200);
  });

  bench('200 columns — 20% pinned', () => {
    reorderColumnsForPinning(cols200_20pct);
  });
});

// #endregion

// #region hasStickyColumns + getLeftStickyColumns + getRightStickyColumns

describe('sticky column queries', () => {
  const cols50 = generateColumns(50);
  const cols200 = generateColumns(200);
  const noPinned = generateColumns(200, 0);

  bench('50 columns — hasStickyColumns', () => {
    hasStickyColumns(cols50);
  });

  bench('200 columns — hasStickyColumns', () => {
    hasStickyColumns(cols200);
  });

  bench('200 columns (none pinned) — hasStickyColumns', () => {
    hasStickyColumns(noPinned);
  });

  bench('200 columns — getLeftStickyColumns', () => {
    getLeftStickyColumns(cols200);
  });

  bench('200 columns — getRightStickyColumns', () => {
    getRightStickyColumns(cols200);
  });
});

// #endregion
