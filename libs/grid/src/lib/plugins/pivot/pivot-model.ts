import { getValueAggregator } from '../../core/internal/aggregators';
import type { PivotConfig } from './types';

// Re-export for backward compatibility within pivot plugin
export const getPivotAggregator = getValueAggregator;

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
