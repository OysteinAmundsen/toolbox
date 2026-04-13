import { bench, describe } from 'vitest';
import { mergeColumns } from './columns';
import { inferColumns } from './inference';

// #region Data Generators

function generateRows(count: number, columnCount: number) {
  const rows: Record<string, unknown>[] = [];
  for (let i = 0; i < count; i++) {
    const row: Record<string, unknown> = {};
    for (let c = 0; c < columnCount; c++) {
      row[`col${c}`] = c % 3 === 0 ? i : c % 3 === 1 ? `value-${i}` : i % 2 === 0;
    }
    rows.push(row);
  }
  return rows;
}

function generateColumns(count: number) {
  const cols = [];
  for (let i = 0; i < count; i++) {
    cols.push({ field: `col${i}`, header: `Column ${i}`, sortable: true });
  }
  return cols;
}

function generateDomColumns(count: number) {
  const cols = [];
  for (let i = 0; i < count; i++) {
    cols.push({
      field: `col${i}`,
      resizable: true,
      width: 100 + i,
    });
  }
  return cols;
}

// #endregion

// #region inferColumns

describe('inferColumns — from data', () => {
  const rows10Col = generateRows(100, 10);
  const rows50Col = generateRows(100, 50);
  const rows200Col = generateRows(100, 200);

  bench('10 columns', () => {
    inferColumns(rows10Col);
  });

  bench('50 columns', () => {
    inferColumns(rows50Col);
  });

  bench('200 columns', () => {
    inferColumns(rows200Col);
  });
});

describe('inferColumns — with provided columns', () => {
  const rows = generateRows(100, 50);
  const provided = generateColumns(50);

  bench('50 provided columns (passthrough)', () => {
    inferColumns(rows, provided);
  });
});

// #endregion

// #region mergeColumns

describe('mergeColumns', () => {
  const prog10 = generateColumns(10);
  const dom10 = generateDomColumns(10);
  const prog50 = generateColumns(50);
  const dom50 = generateDomColumns(50);
  const prog200 = generateColumns(200);
  const dom200 = generateDomColumns(200);

  bench('10 programmatic + 10 DOM', () => {
    mergeColumns(prog10, dom10);
  });

  bench('50 programmatic + 50 DOM', () => {
    mergeColumns(prog50, dom50);
  });

  bench('200 programmatic + 200 DOM', () => {
    mergeColumns(prog200, dom200);
  });

  bench('50 programmatic only', () => {
    mergeColumns(prog50, undefined);
  });

  bench('50 DOM only', () => {
    mergeColumns(undefined, dom50);
  });
});

// #endregion
