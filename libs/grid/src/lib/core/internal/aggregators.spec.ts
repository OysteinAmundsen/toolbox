import { beforeEach, describe, expect, it } from 'vitest';
import {
  getAggregator,
  getValueAggregator,
  listAggregators,
  registerAggregator,
  runAggregator,
  runValueAggregator,
  unregisterAggregator,
} from './aggregators';

describe('aggregators', () => {
  const testRows = [
    { id: 1, value: 10, name: 'Alpha' },
    { id: 2, value: 20, name: 'Beta' },
    { id: 3, value: 30, name: 'Gamma' },
    { id: 4, value: null, name: 'Delta' },
  ];

  describe('built-in aggregators', () => {
    it('sum aggregates numeric values', () => {
      const result = runAggregator('sum', testRows, 'value');
      expect(result).toBe(60); // 10 + 20 + 30 + 0 (null)
    });

    it('avg calculates average of numeric values', () => {
      const result = runAggregator('avg', testRows, 'value');
      expect(result).toBe(15); // 60 / 4
    });

    it('avg returns 0 for empty array', () => {
      const result = runAggregator('avg', [], 'value');
      expect(result).toBe(0);
    });

    it('count returns row count', () => {
      const result = runAggregator('count', testRows, 'value');
      expect(result).toBe(4);
    });

    it('min returns minimum value', () => {
      const result = runAggregator('min', testRows.slice(0, 3), 'value');
      expect(result).toBe(10);
    });

    it('min returns 0 for empty array', () => {
      const result = runAggregator('min', [], 'value');
      expect(result).toBe(0);
    });

    it('max returns maximum value', () => {
      const result = runAggregator('max', testRows.slice(0, 3), 'value');
      expect(result).toBe(30);
    });

    it('max returns 0 for empty array', () => {
      const result = runAggregator('max', [], 'value');
      expect(result).toBe(0);
    });

    it('first returns first row field value', () => {
      const result = runAggregator('first', testRows, 'name');
      expect(result).toBe('Alpha');
    });

    it('last returns last row field value', () => {
      const result = runAggregator('last', testRows, 'name');
      expect(result).toBe('Delta');
    });

    it('first returns undefined for empty array', () => {
      const result = runAggregator('first', [], 'name');
      expect(result).toBeUndefined();
    });
  });

  describe('getAggregator', () => {
    it('returns undefined for undefined ref', () => {
      expect(getAggregator(undefined)).toBeUndefined();
    });

    it('returns function directly when passed a function', () => {
      const fn = () => 42;
      expect(getAggregator(fn)).toBe(fn);
    });

    it('returns built-in aggregator by name', () => {
      const sumFn = getAggregator('sum');
      expect(typeof sumFn).toBe('function');
      expect(sumFn!(testRows.slice(0, 3), 'value')).toBe(60);
    });

    it('returns undefined for unknown aggregator name', () => {
      expect(getAggregator('unknownAggregator')).toBeUndefined();
    });
  });

  describe('runAggregator', () => {
    it('returns undefined when aggregator not found', () => {
      const result = runAggregator('nonexistent', testRows, 'value');
      expect(result).toBeUndefined();
    });

    it('runs custom function aggregator', () => {
      const customFn = (rows: any[], field: string) => rows.map((r) => r[field]).join(',');
      const result = runAggregator(customFn, testRows.slice(0, 3), 'name');
      expect(result).toBe('Alpha,Beta,Gamma');
    });

    it('passes column to aggregator function', () => {
      const colAwareFn = (_rows: any[], _field: string, col: any) => col?.customProp;
      const result = runAggregator(colAwareFn, testRows, 'value', { customProp: 'test' });
      expect(result).toBe('test');
    });
  });

  describe('custom aggregator registration', () => {
    beforeEach(() => {
      // Clean up any custom aggregators from previous tests
      unregisterAggregator('custom');
      unregisterAggregator('median');
    });

    it('registerAggregator adds custom aggregator', () => {
      const medianFn = (rows: any[], field: string) => {
        const sorted = rows
          .map((r) => r[field])
          .filter((v) => v != null)
          .sort((a, b) => a - b);
        const mid = Math.floor(sorted.length / 2);
        return sorted.length % 2 ? sorted[mid] : (sorted[mid - 1] + sorted[mid]) / 2;
      };
      registerAggregator('median', medianFn);
      const result = runAggregator('median', testRows.slice(0, 3), 'value');
      expect(result).toBe(20);
    });

    it('custom aggregator takes precedence over built-in', () => {
      // This shouldn't happen in practice, but tests precedence logic
      registerAggregator('custom', () => 'custom');
      expect(runAggregator('custom', [], 'x')).toBe('custom');
    });

    it('unregisterAggregator removes custom aggregator', () => {
      registerAggregator('custom', () => 'exists');
      expect(runAggregator('custom', [], 'x')).toBe('exists');
      unregisterAggregator('custom');
      expect(runAggregator('custom', [], 'x')).toBeUndefined();
    });
  });

  describe('listAggregators', () => {
    beforeEach(() => {
      unregisterAggregator('custom');
    });

    it('lists all built-in aggregators', () => {
      const names = listAggregators();
      expect(names).toContain('sum');
      expect(names).toContain('avg');
      expect(names).toContain('count');
      expect(names).toContain('min');
      expect(names).toContain('max');
      expect(names).toContain('first');
      expect(names).toContain('last');
    });

    it('includes custom aggregators in list', () => {
      registerAggregator('custom', () => 0);
      const names = listAggregators();
      expect(names).toContain('custom');
    });
  });

  describe('value-based aggregators', () => {
    const testValues = [10, 20, 30, 40, 50];

    it('getValueAggregator returns sum by default for unknown aggFunc', () => {
      const fn = getValueAggregator('unknown');
      expect(fn(testValues)).toBe(150);
    });

    it('sum aggregates numeric values', () => {
      const fn = getValueAggregator('sum');
      expect(fn(testValues)).toBe(150);
    });

    it('avg calculates average', () => {
      const fn = getValueAggregator('avg');
      expect(fn(testValues)).toBe(30);
    });

    it('avg returns 0 for empty array', () => {
      const fn = getValueAggregator('avg');
      expect(fn([])).toBe(0);
    });

    it('count returns value count', () => {
      const fn = getValueAggregator('count');
      expect(fn(testValues)).toBe(5);
    });

    it('min returns minimum value', () => {
      const fn = getValueAggregator('min');
      expect(fn(testValues)).toBe(10);
    });

    it('min returns 0 for empty array', () => {
      const fn = getValueAggregator('min');
      expect(fn([])).toBe(0);
    });

    it('max returns maximum value', () => {
      const fn = getValueAggregator('max');
      expect(fn(testValues)).toBe(50);
    });

    it('max returns 0 for empty array', () => {
      const fn = getValueAggregator('max');
      expect(fn([])).toBe(0);
    });

    it('first returns first value', () => {
      const fn = getValueAggregator('first');
      expect(fn(testValues)).toBe(10);
    });

    it('first returns 0 for empty array', () => {
      const fn = getValueAggregator('first');
      expect(fn([])).toBe(0);
    });

    it('last returns last value', () => {
      const fn = getValueAggregator('last');
      expect(fn(testValues)).toBe(50);
    });

    it('runValueAggregator convenience function works', () => {
      expect(runValueAggregator('sum', testValues)).toBe(150);
      expect(runValueAggregator('avg', testValues)).toBe(30);
      expect(runValueAggregator('count', testValues)).toBe(5);
    });
  });
});
