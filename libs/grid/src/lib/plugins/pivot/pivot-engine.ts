import { createValueKey, getPivotAggregator } from './pivot-model';
import type { PivotConfig, PivotResult, PivotRow, PivotValueField } from './types';

export type PivotDataRow = Record<string, unknown>;

/**
 * Build a hierarchical pivot result from flat data.
 * Supports multiple row group fields for nested hierarchy.
 */
export function buildPivot(rows: PivotDataRow[], config: PivotConfig): PivotResult {
  const rowGroupFields = config.rowGroupFields ?? [];
  const columnGroupFields = config.columnGroupFields ?? [];
  const valueFields = config.valueFields ?? [];

  // Get unique column combinations
  const columnKeys = getUniqueColumnKeys(rows, columnGroupFields);

  // Build hierarchical pivot rows
  const pivotRows = buildHierarchicalPivotRows(
    rows,
    rowGroupFields,
    columnGroupFields,
    columnKeys,
    valueFields,
    0, // starting depth
    '', // parent key prefix
  );

  // Calculate grand totals
  const totals = calculateTotals(pivotRows, columnKeys, valueFields);
  const grandTotal = Object.values(totals).reduce((a, b) => a + b, 0);

  return {
    rows: pivotRows,
    columnKeys,
    totals,
    grandTotal,
  };
}

/**
 * Get unique column key combinations from the data.
 */
export function getUniqueColumnKeys(rows: PivotDataRow[], columnFields: string[]): string[] {
  if (columnFields.length === 0) return ['value'];

  const keys = new Set<string>();
  for (const row of rows) {
    const key = columnFields.map((f) => String(row[f] ?? '')).join('|');
    keys.add(key);
  }
  return [...keys].sort();
}

/**
 * Group rows by a single field.
 */
export function groupByField(rows: PivotDataRow[], field: string): Map<string, PivotDataRow[]> {
  const groups = new Map<string, PivotDataRow[]>();

  for (const row of rows) {
    const key = String(row[field] ?? '');
    const existing = groups.get(key);
    if (existing) {
      existing.push(row);
    } else {
      groups.set(key, [row]);
    }
  }

  return groups;
}

/**
 * Group rows by multiple fields (legacy flat grouping).
 */
export function groupByFields(rows: PivotDataRow[], fields: string[]): Map<string, PivotDataRow[]> {
  const groups = new Map<string, PivotDataRow[]>();

  for (const row of rows) {
    const key = fields.map((f) => String(row[f] ?? '')).join('|');
    const existing = groups.get(key);
    if (existing) {
      existing.push(row);
    } else {
      groups.set(key, [row]);
    }
  }

  return groups;
}

/**
 * Build hierarchical pivot rows recursively.
 * Each level of rowGroupFields creates a new depth level.
 */
export function buildHierarchicalPivotRows(
  rows: PivotDataRow[],
  rowGroupFields: string[],
  columnFields: string[],
  columnKeys: string[],
  valueFields: PivotValueField[],
  depth: number,
  parentKey: string,
): PivotRow[] {
  const result: PivotRow[] = [];

  // If no more row group fields, we're at the leaf level - aggregate the data
  if (rowGroupFields.length === 0) {
    // This shouldn't normally happen as we need at least one grouping field
    // But handle it by creating a single aggregated row
    const values = aggregateValues(rows, columnFields, columnKeys, valueFields);
    const total = calculateRowTotal(values);
    result.push({
      rowKey: parentKey || 'all',
      rowLabel: parentKey || 'All',
      depth,
      values,
      total,
      isGroup: false,
      rowCount: rows.length,
    });
    return result;
  }

  // Get the current grouping field
  const currentField = rowGroupFields[0];
  const remainingFields = rowGroupFields.slice(1);
  const hasChildren = remainingFields.length > 0;

  // Group rows by current field
  const grouped = groupByField(rows, currentField);

  for (const [groupValue, groupRows] of grouped) {
    const rowKey = parentKey ? `${parentKey}|${groupValue}` : groupValue;

    // Aggregate values for this group (sum of all child rows)
    const values = aggregateValues(groupRows, columnFields, columnKeys, valueFields);
    const total = calculateRowTotal(values);

    // Build children if there are more grouping levels
    let children: PivotRow[] | undefined;
    if (hasChildren) {
      children = buildHierarchicalPivotRows(
        groupRows,
        remainingFields,
        columnFields,
        columnKeys,
        valueFields,
        depth + 1,
        rowKey,
      );
    }

    result.push({
      rowKey,
      rowLabel: groupValue || '(blank)',
      depth,
      values,
      total,
      isGroup: hasChildren,
      children,
      rowCount: groupRows.length,
    });
  }

  return result;
}

/**
 * Aggregate values for a set of rows across all column keys.
 */
export function aggregateValues(
  rows: PivotDataRow[],
  columnFields: string[],
  columnKeys: string[],
  valueFields: PivotValueField[],
): Record<string, number | null> {
  const values: Record<string, number | null> = {};

  for (const colKey of columnKeys) {
    for (const vf of valueFields) {
      // Filter rows that match this column key
      const matchingRows =
        columnFields.length > 0
          ? rows.filter((r) => columnFields.map((f) => String(r[f] ?? '')).join('|') === colKey)
          : rows;

      const nums = matchingRows.map((r) => Number(r[vf.field]) || 0);
      const aggregator = getPivotAggregator(vf.aggFunc);
      const aggregatedResult = nums.length > 0 ? aggregator(nums) : null;

      const valueKey = createValueKey([colKey], vf.field);
      values[valueKey] = aggregatedResult;
    }
  }

  return values;
}

/**
 * Calculate the total for a row's values.
 */
export function calculateRowTotal(values: Record<string, number | null>): number {
  let sum = 0;
  for (const val of Object.values(values)) {
    sum += val ?? 0;
  }
  return sum;
}

/**
 * Legacy flat pivot row building (for backwards compatibility).
 */
export function buildPivotRows(
  groupedData: Map<string, PivotDataRow[]>,
  columnFields: string[],
  columnKeys: string[],
  valueFields: PivotValueField[],
  depth: number,
): PivotRow[] {
  const result: PivotRow[] = [];

  for (const [rowKey, groupRows] of groupedData) {
    const values = aggregateValues(groupRows, columnFields, columnKeys, valueFields);
    const total = calculateRowTotal(values);

    result.push({
      rowKey,
      rowLabel: rowKey || '(blank)',
      depth,
      values,
      total,
      isGroup: false,
      rowCount: groupRows.length,
    });
  }

  return result;
}

/**
 * Calculate grand totals across all pivot rows.
 */
export function calculateTotals(
  pivotRows: PivotRow[],
  columnKeys: string[],
  valueFields: PivotValueField[],
): Record<string, number> {
  const totals: Record<string, number> = {};

  // Recursively sum all rows (including nested children)
  function sumRows(rows: PivotRow[]) {
    for (const row of rows) {
      // Only count leaf rows to avoid double-counting
      if (!row.isGroup || !row.children?.length) {
        for (const colKey of columnKeys) {
          for (const vf of valueFields) {
            const valueKey = createValueKey([colKey], vf.field);
            totals[valueKey] = (totals[valueKey] ?? 0) + (row.values[valueKey] ?? 0);
          }
        }
      } else if (row.children) {
        sumRows(row.children);
      }
    }
  }

  sumRows(pivotRows);
  return totals;
}

/**
 * Flatten hierarchical pivot rows for rendering.
 * Respects expanded state - only includes children of expanded groups.
 */
export function flattenPivotRows(rows: PivotRow[], expandedKeys?: Set<string>, defaultExpanded = true): PivotRow[] {
  const result: PivotRow[] = [];

  function flatten(row: PivotRow) {
    result.push(row);

    // Check if this group is expanded
    const isExpanded = expandedKeys ? expandedKeys.has(row.rowKey) : defaultExpanded;

    // Only include children if expanded
    if (row.children && isExpanded) {
      for (const child of row.children) {
        flatten(child);
      }
    }
  }

  for (const row of rows) {
    flatten(row);
  }

  return result;
}

/**
 * Get all group keys from pivot rows (for expand all / collapse all).
 */
export function getAllGroupKeys(rows: PivotRow[]): string[] {
  const keys: string[] = [];

  function collectKeys(row: PivotRow) {
    if (row.isGroup) {
      keys.push(row.rowKey);
    }
    if (row.children) {
      for (const child of row.children) {
        collectKeys(child);
      }
    }
  }

  for (const row of rows) {
    collectKeys(row);
  }

  return keys;
}
