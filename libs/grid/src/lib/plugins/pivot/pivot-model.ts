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
  return valueFields.map((valueField, index) => {
    const baseKey = createValueKey(columnValues, valueField.field);
    let duplicateField = false;
    for (let otherIndex = 0; otherIndex < valueFields.length; otherIndex++) {
      if (otherIndex !== index && valueFields[otherIndex].field === valueField.field) {
        duplicateField = true;
        break;
      }
    }
    if (!duplicateField) return baseKey;

    const aggregateKey = typeof valueField.aggFunc === 'string' ? valueField.aggFunc : 'custom';
    const key = `${baseKey}|${aggregateKey}`;
    for (let previousIndex = 0; previousIndex < index; previousIndex++) {
      const previous = valueFields[previousIndex];
      const previousAggregateKey = typeof previous.aggFunc === 'string' ? previous.aggFunc : 'custom';
      if (previous.field === valueField.field && previousAggregateKey === aggregateKey) {
        return `${key}|${index + 1}`;
      }
    }
    return key;
  });
}
