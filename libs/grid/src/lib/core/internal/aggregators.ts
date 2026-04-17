/**
 * Aggregators Core Registry
 *
 * Provides a central registry for aggregator functions.
 * Built-in aggregators are provided by default.
 * Plugins can register additional aggregators.
 *
 * The registry is exposed as a singleton object that can be accessed:
 * - By ES module imports: import { aggregatorRegistry } from '@toolbox-web/grid'
 * - By UMD/CDN: TbwGrid.aggregatorRegistry
 * - By plugins via context: ctx.aggregatorRegistry
 */

/* eslint-disable @typescript-eslint/no-explicit-any */

export type AggregatorFn = (rows: any[], field: string, column?: any) => any;
export type AggregatorRef = string | AggregatorFn;

/**
 * Check whether a cell value should be treated as blank and skipped by numeric
 * aggregators. Matches the semantics used by the filter engine:
 * `null` / `undefined` / `''` / `NaN` are all considered absent values.
 *
 * Without this guard, `Number('')` coerces to `0` and `null` coerces to `0`,
 * which silently pulls blank cells into sums, averages, and min/max comparisons
 * (a blank cell would otherwise "win" a min/max against any positive/negative
 * dataset). Skipping blanks mirrors how Excel treats empty cells in SUM/AVG/MIN/MAX.
 */
function isBlankCell(v: unknown): boolean {
  return v == null || v === '' || (typeof v === 'number' && isNaN(v));
}

/** Built-in aggregator functions */
const builtInAggregators: Record<string, AggregatorFn> = {
  sum: (rows, field) => {
    let sum = 0;
    for (let i = 0; i < rows.length; i++) {
      const raw = rows[i][field];
      if (isBlankCell(raw)) continue;
      const n = Number(raw);
      if (!isNaN(n)) sum += n;
    }
    return sum;
  },
  avg: (rows, field) => {
    if (!rows.length) return 0;
    let sum = 0;
    let count = 0;
    for (let i = 0; i < rows.length; i++) {
      const raw = rows[i][field];
      if (isBlankCell(raw)) continue;
      const n = Number(raw);
      if (isNaN(n)) continue;
      sum += n;
      count++;
    }
    return count > 0 ? sum / count : 0;
  },
  count: (rows) => rows.length,
  min: (rows, field) => {
    if (!rows.length) return 0;
    let min = Infinity;
    for (let i = 0; i < rows.length; i++) {
      const raw = rows[i][field];
      if (isBlankCell(raw)) continue;
      const v = Number(raw);
      if (isNaN(v)) continue;
      if (v < min) min = v;
    }
    return min === Infinity ? 0 : min;
  },
  max: (rows, field) => {
    if (!rows.length) return 0;
    let max = -Infinity;
    for (let i = 0; i < rows.length; i++) {
      const raw = rows[i][field];
      if (isBlankCell(raw)) continue;
      const v = Number(raw);
      if (isNaN(v)) continue;
      if (v > max) max = v;
    }
    return max === -Infinity ? 0 : max;
  },
  first: (rows, field) => rows[0]?.[field],
  last: (rows, field) => rows[rows.length - 1]?.[field],
};

/** Custom aggregator registry (for plugins to add to) */
const customAggregators: Map<string, AggregatorFn> = new Map();

/**
 * The aggregator registry singleton.
 * Plugins should access this through context or the global namespace.
 */
export const aggregatorRegistry = {
  /**
   * Register a custom aggregator function.
   */
  register(name: string, fn: AggregatorFn): void {
    customAggregators.set(name, fn);
  },

  /**
   * Unregister a custom aggregator function.
   */
  unregister(name: string): void {
    customAggregators.delete(name);
  },

  /**
   * Get an aggregator function by reference.
   */
  get(ref: AggregatorRef | undefined): AggregatorFn | undefined {
    if (ref === undefined) return undefined;
    if (typeof ref === 'function') return ref;
    // Check custom first, then built-in
    return customAggregators.get(ref) ?? builtInAggregators[ref];
  },

  /**
   * Run an aggregator on a set of rows.
   */
  run(ref: AggregatorRef | undefined, rows: any[], field: string, column?: any): any {
    const fn = this.get(ref);
    return fn ? fn(rows, field, column) : undefined;
  },

  /**
   * Check if an aggregator exists.
   */
  has(name: string): boolean {
    return customAggregators.has(name) || name in builtInAggregators;
  },

  /**
   * List all available aggregator names.
   */
  list(): string[] {
    return [...Object.keys(builtInAggregators), ...customAggregators.keys()];
  },
};

// #region Value-based Aggregators
// Used by plugins like Pivot that work with pre-extracted numeric values

export type ValueAggregatorFn = (values: number[]) => number;

/**
 * Built-in value-based aggregators.
 * These operate on arrays of numbers (unlike row-based aggregators).
 */
const builtInValueAggregators: Record<string, ValueAggregatorFn> = {
  sum: (vals) => {
    let sum = 0;
    for (let i = 0; i < vals.length; i++) sum += vals[i];
    return sum;
  },
  avg: (vals) => {
    if (!vals.length) return 0;
    let sum = 0;
    for (let i = 0; i < vals.length; i++) sum += vals[i];
    return sum / vals.length;
  },
  count: (vals) => vals.length,
  min: (vals) => {
    if (!vals.length) return 0;
    let min = vals[0];
    for (let i = 1; i < vals.length; i++) {
      if (vals[i] < min) min = vals[i];
    }
    return min;
  },
  max: (vals) => {
    if (!vals.length) return 0;
    let max = vals[0];
    for (let i = 1; i < vals.length; i++) {
      if (vals[i] > max) max = vals[i];
    }
    return max;
  },
  first: (vals) => vals[0] ?? 0,
  last: (vals) => vals[vals.length - 1] ?? 0,
};

/**
 * Get a value-based aggregator function.
 * Used by Pivot plugin and other features that aggregate pre-extracted values.
 *
 * @param aggFunc - Aggregation function name ('sum', 'avg', 'count', 'min', 'max', 'first', 'last')
 * @returns Aggregator function that takes number[] and returns number
 */
export function getValueAggregator(aggFunc: string): ValueAggregatorFn {
  return builtInValueAggregators[aggFunc] ?? builtInValueAggregators.sum;
}

/**
 * Run a value-based aggregator on a set of values.
 *
 * @param aggFunc - Aggregation function name
 * @param values - Array of numbers to aggregate
 * @returns Aggregated result
 */
export function runValueAggregator(aggFunc: string, values: number[]): number {
  return getValueAggregator(aggFunc)(values);
}
// #endregion
