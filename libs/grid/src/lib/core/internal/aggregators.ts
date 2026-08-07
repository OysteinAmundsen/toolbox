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

import { readCellField, resolveCellValue } from './value-accessor';

/**
 * Aggregation function as stored in the core registry.
 *
 * Loosely typed (`any`) on purpose: the registry holds aggregators contributed
 * by any plugin for any row shape. `plugins/pinned-rows/types.ts` declares a
 * same-named but *stricter* public alias (`unknown[]` / `ColumnConfig`) for
 * users authoring an aggregator. The two must stay separate — tightening this
 * one breaks registry storage, loosening that one loses user-facing type
 * safety.
 */
export type AggregatorFn = (rows: any[], field: string, column?: any) => any;

/**
 * Reference to an aggregation function for footer/group summaries.
 *
 * Can be either:
 * - A built-in aggregator name: `'sum'`, `'avg'`, `'min'`, `'max'`, `'count'`
 * - A plugin-registered aggregator name
 * - A custom {@link AggregatorFn}
 *
 * Aggregators are not declared on a column directly — they are configured per
 * field on the consumer (e.g. `RowGroupRenderConfig.aggregators` for group
 * rows, keyed by column field name).
 *
 * @example
 * ```typescript
 * // Built-in aggregator on a group row config
 * { aggregators: { amount: 'sum' } }
 *
 * // Custom aggregator function
 * {
 *   aggregators: {
 *     price: (rows, field) => {
 *       const values = rows.map((r) => (r as any)[field]).filter((v) => v != null);
 *       return values.length ? Math.max(...(values as number[])) : null;
 *     },
 *   },
 * }
 * ```
 *
 * @since 0.1.1
 */
export type AggregatorRef = string | AggregatorFn;

/**
 * Read a cell for an aggregator. When the column has a `valueAccessor`,
 * route through it (single source of truth — see issue #230); otherwise
 * fall back to a direct field read for the fast path.
 */
function readCell(row: any, field: string, column?: any): unknown {
  if (column?.valueAccessor) return resolveCellValue(row, column);
  return readCellField(row, field);
}

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
  sum: (rows, field, column) => {
    let sum = 0;
    for (let i = 0; i < rows.length; i++) {
      const raw = readCell(rows[i], field, column);
      if (isBlankCell(raw)) continue;
      const n = Number(raw);
      if (!isNaN(n)) sum += n;
    }
    return sum;
  },
  avg: (rows, field, column) => {
    if (!rows.length) return 0;
    let sum = 0;
    let count = 0;
    for (let i = 0; i < rows.length; i++) {
      const raw = readCell(rows[i], field, column);
      if (isBlankCell(raw)) continue;
      const n = Number(raw);
      if (isNaN(n)) continue;
      sum += n;
      count++;
    }
    return count > 0 ? sum / count : 0;
  },
  count: (rows) => rows.length,
  min: (rows, field, column) => {
    if (!rows.length) return 0;
    let min = Infinity;
    for (let i = 0; i < rows.length; i++) {
      const raw = readCell(rows[i], field, column);
      if (isBlankCell(raw)) continue;
      const v = Number(raw);
      if (isNaN(v)) continue;
      if (v < min) min = v;
    }
    return min === Infinity ? 0 : min;
  },
  max: (rows, field, column) => {
    if (!rows.length) return 0;
    let max = -Infinity;
    for (let i = 0; i < rows.length; i++) {
      const raw = readCell(rows[i], field, column);
      if (isBlankCell(raw)) continue;
      const v = Number(raw);
      if (isNaN(v)) continue;
      if (v > max) max = v;
    }
    return max === -Infinity ? 0 : max;
  },
  first: (rows, field, column) => (rows[0] ? readCell(rows[0], field, column) : undefined),
  last: (rows, field, column) => (rows.length ? readCell(rows[rows.length - 1], field, column) : undefined),
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
