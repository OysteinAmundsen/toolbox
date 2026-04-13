import { bench, describe } from 'vitest';
import type { ColumnConfig } from '../../core/types';
import {
  computeColumnOffsets,
  computeTotalWidth,
  getColumnWidths,
  getVisibleColumnRange,
} from './column-virtualization';

// #region Data Generators

function generateColumns(count: number): ColumnConfig[] {
  const columns: ColumnConfig[] = [];
  for (let i = 0; i < count; i++) {
    columns.push({
      field: `col${i}`,
      header: `Column ${i}`,
      width: 80 + (i % 5) * 20, // widths between 80–160
    });
  }
  return columns;
}

// #endregion

// #region computeColumnOffsets

describe('computeColumnOffsets', () => {
  const cols50 = generateColumns(50);
  const cols200 = generateColumns(200);
  const cols500 = generateColumns(500);

  bench('50 columns', () => {
    computeColumnOffsets(cols50);
  });

  bench('200 columns', () => {
    computeColumnOffsets(cols200);
  });

  bench('500 columns', () => {
    computeColumnOffsets(cols500);
  });
});

// #endregion

// #region getVisibleColumnRange

describe('getVisibleColumnRange', () => {
  const cols100 = generateColumns(100);
  const cols500 = generateColumns(500);

  const offsets100 = computeColumnOffsets(cols100);
  const widths100 = getColumnWidths(cols100);
  const offsets500 = computeColumnOffsets(cols500);
  const widths500 = getColumnWidths(cols500);

  bench('100 cols — start of viewport', () => {
    getVisibleColumnRange(0, 1280, offsets100, widths100, 3);
  });

  bench('100 cols — middle of viewport', () => {
    const midScroll = computeTotalWidth(cols100) / 2;
    getVisibleColumnRange(midScroll, 1280, offsets100, widths100, 3);
  });

  bench('500 cols — start of viewport', () => {
    getVisibleColumnRange(0, 1280, offsets500, widths500, 3);
  });

  bench('500 cols — middle of viewport', () => {
    const midScroll = computeTotalWidth(cols500) / 2;
    getVisibleColumnRange(midScroll, 1280, offsets500, widths500, 3);
  });

  bench('500 cols — end of viewport', () => {
    const endScroll = computeTotalWidth(cols500) - 1280;
    getVisibleColumnRange(endScroll, 1280, offsets500, widths500, 3);
  });
});

// #endregion

// #region getColumnWidths + computeTotalWidth

describe('getColumnWidths + computeTotalWidth', () => {
  const cols200 = generateColumns(200);
  const cols500 = generateColumns(500);

  bench('200 columns — getColumnWidths', () => {
    getColumnWidths(cols200);
  });

  bench('500 columns — getColumnWidths', () => {
    getColumnWidths(cols500);
  });

  bench('200 columns — computeTotalWidth', () => {
    computeTotalWidth(cols200);
  });

  bench('500 columns — computeTotalWidth', () => {
    computeTotalWidth(cols500);
  });
});

// #endregion
