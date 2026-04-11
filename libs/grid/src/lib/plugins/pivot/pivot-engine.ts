import { createValueKey, getPivotAggregator } from './pivot-model';
import type { PivotConfig, PivotResult, PivotRow, PivotSortConfig, PivotSortDir, PivotValueField } from './types';

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
  const columnKeys = getUniqueColumnKeys(rows, columnGroupFields, config.sortColumns);

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

  // Sort row groups if configured
  if (config.sortRows) {
    sortPivotRows(pivotRows, config.sortRows, valueFields);
  }

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
export function getUniqueColumnKeys(
  rows: PivotDataRow[],
  columnFields: string[],
  sortDir: PivotSortDir = 'asc',
): string[] {
  if (columnFields.length === 0) return ['value'];

  const keys = new Set<string>();
  for (const row of rows) {
    const key = columnFields.map((f) => String(row[f] ?? '')).join('|');
    keys.add(key);
  }
  const sorted = [...keys].sort();
  return sortDir === 'desc' ? sorted.reverse() : sorted;
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

/**
 * Recursively sort pivot rows at each level.
 */
export function sortPivotRows(rows: PivotRow[], sortConfig: PivotSortConfig, valueFields: PivotValueField[]): void {
  const dir = sortConfig.direction === 'desc' ? -1 : 1;

  rows.sort((a, b) => {
    if (sortConfig.by === 'value') {
      const field = sortConfig.valueField ?? valueFields[0]?.field;
      if (field) {
        const aVal = a.total ?? 0;
        const bVal = b.total ?? 0;
        return (aVal - bVal) * dir;
      }
    }
    // Default: sort by label
    return a.rowLabel.localeCompare(b.rowLabel) * dir;
  });

  for (const row of rows) {
    if (row.children?.length) {
      sortPivotRows(row.children, sortConfig, valueFields);
    }
  }
}

/**
 * Sort pivot rows by multiple criteria (from MultiSort's sort model).
 * Each criterion is a PivotSortConfig; earlier entries take precedence.
 * Maintains hierarchy by sorting children recursively at each level.
 */
export function sortPivotMulti(rows: PivotRow[], configs: PivotSortConfig[], valueFields: PivotValueField[]): void {
  if (configs.length === 0) return;

  const knownValueFields = new Set(valueFields.map((vf) => vf.field));

  /** Resolve the numeric sort value for a row given a valueField key. */
  const getSortValue = (row: PivotRow, valueField: string): number => {
    // Direct match (full value key like "Q1|sales")
    if (row.values[valueField] != null) {
      return typeof row.values[valueField] === 'number' ? (row.values[valueField] as number) : 0;
    }
    // Suffix match — sum all matching columns for a bare field name
    if (knownValueFields.has(valueField)) {
      const suffix = `|${valueField}`;
      let sum = 0;
      let found = false;
      for (const key of Object.keys(row.values)) {
        if (key.endsWith(suffix)) {
          sum += typeof row.values[key] === 'number' ? (row.values[key] as number) : 0;
          found = true;
        }
      }
      if (found) return sum;
    }
    return row.total ?? 0;
  };

  // Precompute accessors for deterministic ordering (same accessor for both a and b)
  const accessors = configs.map((cfg) => {
    if (cfg.by === 'value') {
      if (cfg.valueField) {
        return (row: PivotRow) => getSortValue(row, cfg.valueField!);
      }
      return (row: PivotRow) => row.total ?? 0;
    }
    return null; // label sort — uses localeCompare directly
  });

  rows.sort((a, b) => {
    for (let i = 0; i < configs.length; i++) {
      const cfg = configs[i];
      const dir = cfg.direction === 'desc' ? -1 : 1;
      let cmp = 0;

      if (cfg.by === 'value') {
        const accessor = accessors[i] as (row: PivotRow) => number;
        cmp = (accessor(a) - accessor(b)) * dir;
      } else {
        cmp = a.rowLabel.localeCompare(b.rowLabel) * dir;
      }

      if (cmp !== 0) return cmp;
    }
    return 0;
  });

  for (const row of rows) {
    if (row.children?.length) {
      sortPivotMulti(row.children, configs, valueFields);
    }
  }
}

/**
 * Resolve `defaultExpanded` config to a set of keys, similar to grouping-rows.
 */
export function resolveDefaultExpanded(
  value: boolean | number | string | string[] | undefined,
  allGroupKeys: string[],
): Set<string> {
  if (value === true || value === undefined) return new Set(allGroupKeys);
  if (value === false) return new Set();
  if (typeof value === 'number') {
    const key = allGroupKeys[value];
    return key ? new Set([key]) : new Set();
  }
  if (typeof value === 'string') return new Set([value]);
  if (Array.isArray(value)) return new Set(value);
  return new Set();
}

/**
 * Calculate column totals (sum of all leaf row values per column key).
 * Used for percentage-of-column calculations.
 */
export function getColumnTotals(
  rows: PivotRow[],
  columnKeys: string[],
  valueFields: PivotValueField[],
): Record<string, number> {
  const totals: Record<string, number> = {};

  function sumLeaves(rows: PivotRow[]) {
    for (const row of rows) {
      if (!row.isGroup || !row.children?.length) {
        for (const colKey of columnKeys) {
          for (const vf of valueFields) {
            const valueKey = createValueKey([colKey], vf.field);
            totals[valueKey] = (totals[valueKey] ?? 0) + (row.values[valueKey] ?? 0);
          }
        }
      } else if (row.children) {
        sumLeaves(row.children);
      }
    }
  }

  sumLeaves(rows);
  return totals;
}
