import { getValueAggregator } from '../../core/internal/aggregators';
import type { AggFunc, PivotConfig, PivotValueField } from './types';

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

export function createValueKeys(columnValues: string[], valueFields: PivotValueField[]): string[] {
  const fieldCounts = new Map<string, number>();
  for (const valueField of valueFields) {
    fieldCounts.set(valueField.field, (fieldCounts.get(valueField.field) ?? 0) + 1);
  }

  // NUL-joined so a `|` inside a field name cannot collide with an aggregate key.
  const seenFieldAggregates = new Set<string>();

  return valueFields.map((valueField, index) => {
    const baseKey = createValueKey(columnValues, valueField.field);
    if ((fieldCounts.get(valueField.field) ?? 0) < 2) return baseKey;

    const aggregateKey = typeof valueField.aggFunc === 'string' ? valueField.aggFunc : 'custom';
    const key = `${baseKey}|${aggregateKey}`;
    const pairKey = `${valueField.field}\u0000${aggregateKey}`;
    if (seenFieldAggregates.has(pairKey)) return `${key}|${index + 1}`;

    seenFieldAggregates.add(pairKey);
    return key;
  });
}
