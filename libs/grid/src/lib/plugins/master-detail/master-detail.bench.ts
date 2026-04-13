import { bench, describe } from 'vitest';
import { collapseDetailRow, expandDetailRow, isDetailExpanded, toggleDetailRow } from './master-detail';

// #region Data Generators

function generateRows(count: number) {
  const rows: object[] = [];
  for (let i = 0; i < count; i++) {
    rows.push({ id: i, name: `Row ${i}`, value: Math.random() * 10_000 });
  }
  return rows;
}

function buildExpandedSet(rows: object[], expandedRatio: number): Set<object> {
  const expanded = new Set<object>();
  for (const row of rows) {
    if (Math.random() < expandedRatio) expanded.add(row);
  }
  return expanded;
}

// #endregion

// #region toggleDetailRow

describe('toggleDetailRow', () => {
  const rows1K = generateRows(1_000);
  const rows10K = generateRows(10_000);
  const expanded1K = buildExpandedSet(rows1K, 0.5);
  const expanded10K = buildExpandedSet(rows10K, 0.5);

  bench('1K rows — 50% expanded — toggle', () => {
    for (const row of rows1K) {
      toggleDetailRow(expanded1K, row);
    }
  });

  bench('10K rows — 50% expanded — toggle', () => {
    for (const row of rows10K) {
      toggleDetailRow(expanded10K, row);
    }
  });
});

// #endregion

// #region isDetailExpanded — lookup performance

describe('isDetailExpanded', () => {
  const rows10K = generateRows(10_000);
  const expanded10K = buildExpandedSet(rows10K, 0.5);

  bench('10K rows — 50% expanded — check all', () => {
    for (const row of rows10K) {
      isDetailExpanded(expanded10K, row);
    }
  });
});

// #endregion

// #region expandDetailRow + collapseDetailRow at scale

describe('expandDetailRow + collapseDetailRow — bulk operations', () => {
  const rows10K = generateRows(10_000);

  bench('expand 10K rows sequentially', () => {
    let expanded = new Set<object>();
    for (const row of rows10K) {
      expanded = expandDetailRow(expanded, row);
    }
  });

  bench('collapse 10K rows sequentially', () => {
    let expanded = new Set(rows10K);
    for (const row of rows10K) {
      expanded = collapseDetailRow(expanded, row);
    }
  });
});

// #endregion
