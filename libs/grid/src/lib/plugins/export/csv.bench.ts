/**
 * CSV Export Benchmarks
 *
 * `buildCsv` runs synchronously for the entire dataset on user-triggered
 * export. Large tables (10K+ rows × 10+ columns) are common, and the
 * function blocks the main thread — a regression here directly hurts UX.
 */

import { randomInt } from 'node:crypto';
import { bench, describe } from 'vitest';
import type { ColumnConfig } from '../../core/types';
import { buildCsv, formatCsvValue } from './csv';
import type { ExportParams } from './types';

// #region Fixtures

function generateRows(count: number) {
  const rows: Record<string, unknown>[] = [];
  for (let i = 0; i < count; i++) {
    rows.push({
      id: i,
      name: `Employee, ${i}`, // contains comma → triggers quoting path
      department: ['Engineering', 'Sales', 'Marketing'][i % 3],
      salary: randomInt(30_000, 200_001),
      hired: new Date(2020, 0, 1 + (i % 365)),
      notes: i % 5 === 0 ? `Multi\nline\nnote ${i}` : `Note ${i}`, // newlines → quoting
    });
  }
  return rows;
}

const COLUMNS: ColumnConfig[] = [
  { field: 'id', header: 'ID' },
  { field: 'name', header: 'Name' },
  { field: 'department', header: 'Department' },
  { field: 'salary', header: 'Salary' },
  { field: 'hired', header: 'Hired' },
  { field: 'notes', header: 'Notes' },
];

const PARAMS: ExportParams = { format: 'csv', fileName: 'export.csv', includeHeaders: true };

// #endregion

describe('formatCsvValue', () => {
  bench('plain string', () => {
    formatCsvValue('hello world');
  });

  bench('string with comma + quote', () => {
    formatCsvValue('hello, "world"');
  });

  bench('Date', () => {
    formatCsvValue(new Date());
  });

  bench('object → JSON', () => {
    formatCsvValue({ a: 1, b: 'two', c: [1, 2, 3] });
  });
});

describe('buildCsv', () => {
  const rows1k = generateRows(1_000);
  const rows10k = generateRows(10_000);
  const rows50k = generateRows(50_000);

  bench('1K rows × 6 cols', () => {
    buildCsv(rows1k, COLUMNS, PARAMS);
  });

  bench('10K rows × 6 cols', () => {
    buildCsv(rows10k, COLUMNS, PARAMS);
  });

  bench('50K rows × 6 cols', () => {
    buildCsv(rows50k, COLUMNS, PARAMS);
  });
});
