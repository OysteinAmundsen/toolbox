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

/** Built-in aggregator functions */
const builtInAggregators: Record<string, AggregatorFn> = {
  sum: (rows, field) => rows.reduce((acc, row) => acc + (Number(row[field]) || 0), 0),
  avg: (rows, field) => {
    const sum = rows.reduce((acc, row) => acc + (Number(row[field]) || 0), 0);
    return rows.length ? sum / rows.length : 0;
  },
  count: (rows) => rows.length,
  min: (rows, field) => (rows.length ? Math.min(...rows.map((r) => Number(r[field]) || Infinity)) : 0),
  max: (rows, field) => (rows.length ? Math.max(...rows.map((r) => Number(r[field]) || -Infinity)) : 0),
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
  sum: (vals) => vals.reduce((a, b) => a + b, 0),
  avg: (vals) => (vals.length ? vals.reduce((a, b) => a + b, 0) / vals.length : 0),
  count: (vals) => vals.length,
  min: (vals) => (vals.length ? Math.min(...vals) : 0),
  max: (vals) => (vals.length ? Math.max(...vals) : 0),
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

// Legacy function exports for backward compatibility
export const registerAggregator = aggregatorRegistry.register.bind(aggregatorRegistry);
export const unregisterAggregator = aggregatorRegistry.unregister.bind(aggregatorRegistry);
export const getAggregator = aggregatorRegistry.get.bind(aggregatorRegistry);
export const runAggregator = aggregatorRegistry.run.bind(aggregatorRegistry);
export const listAggregators = aggregatorRegistry.list.bind(aggregatorRegistry);
