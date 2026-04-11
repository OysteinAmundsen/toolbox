import { getValueAggregator } from '../../core/internal/aggregators';
import type { AggFunc, PivotConfig } from './types';

/**
 * Resolve an AggFunc to an executable function.
 * Supports both built-in string names and custom functions.
 */
export function getPivotAggregator(aggFunc: AggFunc): (values: number[]) => number {
  if (typeof aggFunc === 'function') return aggFunc;
  return getValueAggregator(aggFunc);
}

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

export function createValueKey(columnValues: string[], valueField: string): string {
  return [...columnValues, valueField].join('|');
}
