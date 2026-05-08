/**
 * Excel Export Benchmarks
 *
 * `buildExcelXml` mirrors `buildCsv` but emits XML with per-cell type
 * resolution and (optionally) per-cell style lookups. The string-concat hot
 * path here is more allocation-heavy than CSV; a regression here was the
 * motivation for the original async-export refactor.
 */

import { randomInt } from 'node:crypto';
import { bench, describe } from 'vitest';
import type { ColumnConfig } from '../../core/types';
import { buildExcelXml } from './excel';
import type { ExportParams } from './types';

// #region Fixtures

function generateRows(count: number) {
  const rows: Record<string, unknown>[] = [];
  for (let i = 0; i < count; i++) {
    rows.push({
      id: i,
      name: `Employee ${i}`,
      department: ['Engineering', 'Sales', 'Marketing'][i % 3],
      salary: randomInt(30_000, 200_001),
      hired: new Date(2020, 0, 1 + (i % 365)),
      active: i % 3 !== 0,
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
  { field: 'active', header: 'Active' },
];

const PARAMS: ExportParams = { format: 'excel', fileName: 'export.xls', includeHeaders: true };

// #endregion

describe('buildExcelXml', () => {
  const rows1k = generateRows(1_000);
  const rows10k = generateRows(10_000);

  bench('1K rows × 6 cols (no styles)', () => {
    buildExcelXml(rows1k, COLUMNS, PARAMS);
  });

  bench('10K rows × 6 cols (no styles)', () => {
    buildExcelXml(rows10k, COLUMNS, PARAMS);
  });
});
