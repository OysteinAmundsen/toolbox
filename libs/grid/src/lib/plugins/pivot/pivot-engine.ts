import type { PivotConfig, PivotResult, PivotRow, PivotValueField } from './types';
import { getPivotAggregator, createValueKey } from './pivot-model';

export type PivotDataRow = Record<string, unknown>;

export function buildPivot(rows: PivotDataRow[], config: PivotConfig): PivotResult {
  const rowGroupFields = config.rowGroupFields ?? [];
  const columnGroupFields = config.columnGroupFields ?? [];
  const valueFields = config.valueFields ?? [];

  // Get unique column combinations
  const columnKeys = getUniqueColumnKeys(rows, columnGroupFields);

  // Group rows by row group fields
  const groupedData = groupByFields(rows, rowGroupFields);

  // Build pivot rows
  const pivotRows = buildPivotRows(groupedData, columnGroupFields, columnKeys, valueFields, 0);

  // Calculate totals
  const totals = calculateTotals(pivotRows, columnKeys, valueFields);
  const grandTotal = Object.values(totals).reduce((a, b) => a + b, 0);

  return {
    rows: pivotRows,
    columnKeys,
    totals,
    grandTotal,
  };
}

export function getUniqueColumnKeys(rows: PivotDataRow[], columnFields: string[]): string[] {
  if (columnFields.length === 0) return ['value'];

  const keys = new Set<string>();
  for (const row of rows) {
    const key = columnFields.map((f) => String(row[f] ?? '')).join('|');
    keys.add(key);
  }
  return [...keys].sort();
}

export function groupByFields(rows: PivotDataRow[], fields: string[]): Map<string, PivotDataRow[]> {
  const groups = new Map<string, PivotDataRow[]>();

  for (const row of rows) {
    const key = fields.map((f) => String(row[f] ?? '')).join('|');
    if (!groups.has(key)) {
      groups.set(key, []);
    }
    const group = groups.get(key);
    if (group) group.push(row);
  }

  return groups;
}

export function buildPivotRows(
  groupedData: Map<string, PivotDataRow[]>,
  columnFields: string[],
  columnKeys: string[],
  valueFields: PivotValueField[],
  depth: number
): PivotRow[] {
  const result: PivotRow[] = [];

  for (const [rowKey, groupRows] of groupedData) {
    const values: Record<string, number | null> = {};
    let total = 0;

    for (const colKey of columnKeys) {
      for (const vf of valueFields) {
        const matchingRows =
          columnFields.length > 0
            ? groupRows.filter((r) => columnFields.map((f) => String(r[f] ?? '')).join('|') === colKey)
            : groupRows;

        const nums = matchingRows.map((r) => Number(r[vf.field]) || 0);
        const aggregator = getPivotAggregator(vf.aggFunc);
        const aggregatedResult = nums.length > 0 ? aggregator(nums) : null;

        const valueKey = createValueKey([colKey], vf.field);
        values[valueKey] = aggregatedResult;

        if (aggregatedResult !== null) total += aggregatedResult;
      }
    }

    result.push({
      rowKey,
      rowLabel: rowKey || '(blank)',
      depth,
      values,
      total,
      isGroup: false,
    });
  }

  return result;
}

export function calculateTotals(
  pivotRows: PivotRow[],
  columnKeys: string[],
  valueFields: PivotValueField[]
): Record<string, number> {
  const totals: Record<string, number> = {};

  for (const colKey of columnKeys) {
    for (const vf of valueFields) {
      const valueKey = createValueKey([colKey], vf.field);
      totals[valueKey] = pivotRows.reduce((sum, row) => {
        return sum + (row.values[valueKey] ?? 0);
      }, 0);
    }
  }

  return totals;
}

export function flattenPivotRows(rows: PivotRow[]): PivotRow[] {
  const result: PivotRow[] = [];

  function flatten(row: PivotRow) {
    result.push(row);
    if (row.children) {
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
