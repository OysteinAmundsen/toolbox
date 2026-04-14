import { randomInt } from 'node:crypto';
import { bench, describe } from 'vitest';
import { aggregatorRegistry, runValueAggregator } from './aggregators';

// #region Data Generators

function generateRows(count: number) {
  const rows: Record<string, unknown>[] = [];
  for (let i = 0; i < count; i++) {
    rows.push({
      id: i,
      salary: randomInt(30_000, 200_001),
      bonus: randomInt(0, 20_001),
    });
  }
  return rows;
}

function generateValues(count: number) {
  const values: number[] = [];
  for (let i = 0; i < count; i++) {
    values.push(randomInt(0, 200_001));
  }
  return values;
}

// #endregion

// #region Row-based aggregators

describe('aggregatorRegistry.run — row-based', () => {
  const rows1K = generateRows(1_000);
  const rows10K = generateRows(10_000);
  const rows100K = generateRows(100_000);

  bench('sum — 1K rows', () => {
    aggregatorRegistry.run('sum', rows1K, 'salary');
  });

  bench('sum — 10K rows', () => {
    aggregatorRegistry.run('sum', rows10K, 'salary');
  });

  bench('sum — 100K rows', () => {
    aggregatorRegistry.run('sum', rows100K, 'salary');
  });

  bench('avg — 10K rows', () => {
    aggregatorRegistry.run('avg', rows10K, 'salary');
  });

  bench('min — 10K rows', () => {
    aggregatorRegistry.run('min', rows10K, 'salary');
  });

  bench('max — 10K rows', () => {
    aggregatorRegistry.run('max', rows10K, 'salary');
  });

  bench('count — 10K rows', () => {
    aggregatorRegistry.run('count', rows10K, 'salary');
  });

  bench('min — 100K rows', () => {
    aggregatorRegistry.run('min', rows100K, 'salary');
  });

  bench('max — 100K rows', () => {
    aggregatorRegistry.run('max', rows100K, 'salary');
  });
});

// #endregion

// #region Value-based aggregators

describe('runValueAggregator — value-based', () => {
  const vals1K = generateValues(1_000);
  const vals10K = generateValues(10_000);
  const vals100K = generateValues(100_000);

  bench('sum — 1K values', () => {
    runValueAggregator('sum', vals1K);
  });

  bench('sum — 10K values', () => {
    runValueAggregator('sum', vals10K);
  });

  bench('sum — 100K values', () => {
    runValueAggregator('sum', vals100K);
  });

  bench('min — 100K values', () => {
    runValueAggregator('min', vals100K);
  });

  bench('max — 100K values', () => {
    runValueAggregator('max', vals100K);
  });

  bench('avg — 100K values', () => {
    runValueAggregator('avg', vals100K);
  });
});

// #endregion
