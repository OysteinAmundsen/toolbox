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
  min: (rows, field) => Math.min(...rows.map((r) => Number(r[field]) || Infinity)),
  max: (rows, field) => Math.max(...rows.map((r) => Number(r[field]) || -Infinity)),
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

// Legacy function exports for backward compatibility
export const registerAggregator = aggregatorRegistry.register.bind(aggregatorRegistry);
export const unregisterAggregator = aggregatorRegistry.unregister.bind(aggregatorRegistry);
export const getAggregator = aggregatorRegistry.get.bind(aggregatorRegistry);
export const runAggregator = aggregatorRegistry.run.bind(aggregatorRegistry);
export const listAggregators = aggregatorRegistry.list.bind(aggregatorRegistry);
