import type { PivotConfig } from './types';

export function validatePivotConfig(config: PivotConfig): string[] {
  const errors: string[] = [];

  if (!config.rowGroupFields?.length && !config.columnGroupFields?.length) {
    errors.push('At least one row or column group field is required');
  }

  if (!config.valueFields?.length) {
    errors.push('At least one value field is required');
  }

  return errors;
}

/**
 * Get a value-based aggregator function for pivot operations.
 * This operates on pre-extracted numeric values (different from core row-based aggregators).
 */
export function getPivotAggregator(aggFunc: string): (values: number[]) => number {
  switch (aggFunc) {
    case 'sum':
      return (vals) => vals.reduce((a, b) => a + b, 0);
    case 'avg':
      return (vals) => (vals.length ? vals.reduce((a, b) => a + b, 0) / vals.length : 0);
    case 'count':
      return (vals) => vals.length;
    case 'min':
      return (vals) => (vals.length ? Math.min(...vals) : 0);
    case 'max':
      return (vals) => (vals.length ? Math.max(...vals) : 0);
    case 'first':
      return (vals) => vals[0] ?? 0;
    case 'last':
      return (vals) => vals[vals.length - 1] ?? 0;
    default:
      return (vals) => vals.reduce((a, b) => a + b, 0);
  }
}

export function createValueKey(columnValues: string[], valueField: string): string {
  return [...columnValues, valueField].join('|');
}
