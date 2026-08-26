import { describe, expect, it } from 'vitest';

import { assertBenchmark, markReplacement, shuffleRows, summarizeMacroResults, trimmedMean } from './shared.js';
import type { BenchmarkRow, MetricName, ScaleResult } from './types.js';

function resultWith(
  baseline: Partial<Record<MetricName, number>>,
  competitor: Partial<Record<MetricName, number>>,
): ScaleResult {
  return {
    rowCount: 5_000,
    tbw: new Map(Object.entries(baseline) as [MetricName, number][]),
    competitor: new Map(Object.entries(competitor) as [MetricName, number][]),
  };
}

describe('benchmark methodology helpers', () => {
  it('produces identical sort inputs for the same seed', () => {
    const rows = Array.from({ length: 20 }, (_, index) => ({ id: index + 1 })) as BenchmarkRow[];

    expect(shuffleRows([...rows], 42)).toEqual(shuffleRows([...rows], 42));
    expect(shuffleRows([...rows], 42)).not.toEqual(shuffleRows([...rows], 43));
  });

  it('drops the fastest and slowest samples from a five-sample mean', () => {
    expect(trimmedMean([1, 10, 11, 12, 100])).toBe(11);
  });

  it('marks replacement data with a visible sentinel', () => {
    const rows = [{ id: 1, col1: 'before' }] as BenchmarkRow[];

    expect(markReplacement(rows)[0].col1).toBe('REPLACED');
  });

  it('rejects a timing when its semantic postcondition fails', () => {
    expect(() => assertBenchmark('Example Grid', 'Sort', 5_000, false, 'wrong first row')).toThrow(
      '[benchmark:Example Grid] Sort validation failed at 5K rows: wrong first row',
    );
  });

  it('keeps geometric-mean direction independent from win count', () => {
    const summary = summarizeMacroResults([
      resultWith(
        {
          'Cold mount to painted viewport': 100,
          Sort: 100,
          Filter: 100,
          'Replace data to painted viewport': 1_000,
        },
        {
          'Cold mount to painted viewport': 110,
          Sort: 110,
          Filter: 110,
          'Replace data to painted viewport': 100,
        },
      ),
    ]);

    expect(summary.baselineWins).toBe(3);
    expect(summary.competitorWins).toBe(1);
    expect(summary.geometricMean).toBeLessThan(1);
  });

  it('excludes paired frame-floor observations from the geometric mean', () => {
    const summary = summarizeMacroResults([resultWith({ Sort: 5, Filter: 100 }, { Sort: 15, Filter: 200 })]);

    expect(summary.ties).toBe(1);
    expect(summary.geometricMean).toBe(2);
  });
});
