import type { ExpandCollapseAnimation } from '../../core/types';
export type { ExpandCollapseAnimation } from '../../core/types';

/**
 * Custom aggregation function that receives an array of numeric values
 * and returns a single aggregated result.
 *
 * @example
 * ```typescript
 * const weightedAvg: CustomAggFunc = (values) => {
 *   const total = values.reduce((a, b) => a + b, 0);
 *   return total / values.length;
 * };
 * ```
 */
export type CustomAggFunc = (values: number[]) => number;

/**
 * Built-in aggregation functions for pivot value fields.
 *
 * Each function is applied per-cell to aggregate the matching data rows into a single value:
 *
 * | Function | Result | Blank handling |
 * |----------|--------|----------------|
 * | `'sum'` | Numeric total of all values | Non-numeric values ignored |
 * | `'avg'` | Arithmetic mean | Non-numeric values excluded from count |
 * | `'count'` | Number of rows in the group | Counts all rows including blanks |
 * | `'min'` | Smallest numeric value | Non-numeric values ignored |
 * | `'max'` | Largest numeric value | Non-numeric values ignored |
 * | `'first'` | Value from the first row in the group | May be `undefined` if group is empty |
 * | `'last'` | Value from the last row in the group | May be `undefined` if group is empty |
 *
 * You can also provide a custom function:
 * ```typescript
 * const valueFields: PivotValueField[] = [
 *   { field: 'revenue', aggFunc: 'sum', header: 'Total Revenue' },
 *   { field: 'margin', aggFunc: (values) => values.reduce((a, b) => a + b, 0) / values.length },
 * ];
 * ```
 */
export type AggFunc = 'sum' | 'avg' | 'count' | 'min' | 'max' | 'first' | 'last' | CustomAggFunc;

/** Sort direction for pivot rows or columns. */
export type PivotSortDir = 'asc' | 'desc';

/** Configuration for sorting pivot row groups. */
export interface PivotSortConfig {
  /** Sort by `'label'` (group name) or `'value'` (aggregate value). Default: `'label'` */
  by?: 'label' | 'value';
  /** Sort direction. Default: `'asc'` */
  direction?: PivotSortDir;
  /** When `by: 'value'`, which value field to sort by (defaults to first value field). */
  valueField?: string;
}

/**
 * Value display mode for pivot cells.
 * - `'raw'` — Show raw aggregated value (default)
 * - `'percentOfRow'` — Show as percentage of row total
 * - `'percentOfColumn'` — Show as percentage of column total
 * - `'percentOfGrandTotal'` — Show as percentage of grand total
 */
export type PivotValueDisplayMode = 'raw' | 'percentOfRow' | 'percentOfColumn' | 'percentOfGrandTotal';

/**
 * Value that determines which groups are expanded by default.
 * - `true` — Expand all groups
 * - `false` — Collapse all groups
 * - `number` — Expand group at this index
 * - `string` — Expand group with this key
 * - `string[]` — Expand groups matching these keys
 */
export type PivotDefaultExpandedValue = boolean | number | string | string[];

/**
 * Configuration for the pivot plugin.
 *
 * Pivot mode transforms flat row data into a cross-tabulation (pivot table)
 * by grouping rows along one axis (`rowGroupFields`), spreading unique values
 * of another field across columns (`columnGroupFields`), and computing
 * aggregate values (`valueFields`) at each intersection.
 *
 * @example
 * ```typescript
 * new PivotPlugin({
 *   rowGroupFields: ['department'],
 *   columnGroupFields: ['quarter'],
 *   valueFields: [{ field: 'revenue', aggFunc: 'sum' }],
 *   showTotals: true,
 *   showGrandTotal: true,
 * })
 * ```
 */
export interface PivotConfig {
  /** Whether pivot view is active on load (default: true when fields are configured) */
  active?: boolean;
  /** Fields to group rows by (vertical axis). Multiple fields create nested groups. */
  rowGroupFields?: string[];
  /** Fields whose unique values become column headers (horizontal axis). */
  columnGroupFields?: string[];
  /** Value fields to aggregate at each row/column intersection. */
  valueFields?: PivotValueField[];
  showTotals?: boolean;
  showGrandTotal?: boolean;
  /**
   * Which groups are expanded by default.
   * - `true` — expand all (default)
   * - `false` — collapse all
   * - `number` — expand group at index
   * - `string` — expand group with key
   * - `string[]` — expand groups matching keys
   */
  defaultExpanded?: PivotDefaultExpandedValue;
  /** Indent width per depth level in pixels (default: 20) */
  indentWidth?: number;
  /** Whether to show the pivot configuration tool panel (default: true) */
  showToolPanel?: boolean;
  /**
   * Animation style for expanding/collapsing groups.
   * - `false`: No animation
   * - `'slide'`: Slide animation (default)
   * - `'fade'`: Fade animation
   * @default 'slide'
   */
  animation?: ExpandCollapseAnimation;
  /**
   * Sort configuration for row groups.
   * When set, groups at each level are sorted by label or aggregate value.
   */
  sortRows?: PivotSortConfig;
  /**
   * Sort direction for column keys. Default: `'asc'` (alphabetical).
   * Set to `'desc'` for reverse order.
   */
  sortColumns?: PivotSortDir;
  /**
   * Include the grand total row in the row model (so it's included in exports/copy).
   * When `false` (default), grand total is rendered as a separate sticky footer.
   * @default false
   */
  grandTotalInRowModel?: boolean;
  /**
   * Display mode for aggregated values.
   * @default 'raw'
   */
  valueDisplayMode?: PivotValueDisplayMode;
  /**
   * Whether to show subtotal rows at each group level in multi-level grouping.
   * @default false
   */
  showSubtotals?: boolean;
}

/**
 * Defines a value field in the pivot table — which data field to aggregate
 * and how to compute the aggregation.
 *
 * Multiple `PivotValueField` entries on the same `field` with different `aggFunc`
 * values create separate columns (e.g. "Revenue (Sum)" and "Revenue (Avg)").
 */
export interface PivotValueField {
  /** The row data field to aggregate (must exist on the source row objects). */
  field: string;
  /** Aggregation function — a built-in name or a custom function. */
  aggFunc: AggFunc;
  /** Custom column header label. Defaults to `"field (aggFunc)"` if omitted. */
  header?: string;
  /**
   * Format function for display values. Receives the aggregated number and returns a string.
   * When omitted, the original column's `format` is used if available, otherwise raw `String(value)`.
   *
   * @example
   * ```typescript
   * { field: 'revenue', aggFunc: 'sum', format: (v) => `$${v.toLocaleString()}` }
   * ```
   */
  format?: (value: number) => string;
}

export interface PivotState {
  isActive: boolean;
  pivotResult: PivotResult | null;
  expandedKeys: Set<string>;
}

/**
 * Computed result of the pivot transformation.
 *
 * Produced internally by the pivot engine after processing source rows
 * through the configured `rowGroupFields`, `columnGroupFields`, and `valueFields`.
 */
export interface PivotResult {
  /** Hierarchical pivot rows (group headers + leaf rows). */
  rows: PivotRow[];
  /** Unique column keys derived from `columnGroupFields` values. */
  columnKeys: string[];
  /** Per-column totals (keyed by column key). Present when `showTotals` is enabled. */
  totals: Record<string, number>;
  /** Grand total across all columns. Present when `showGrandTotal` is enabled. */
  grandTotal: number;
}

export interface PivotRow {
  /** Unique key for this row (hierarchical path) */
  rowKey: string;
  /** Display label for this row */
  rowLabel: string;
  /** Depth level (0 = top level) */
  depth: number;
  /** Aggregated values by column key */
  values: Record<string, number | null>;
  /** Row total across all columns */
  total?: number;
  /** Whether this row has children (is a group header) */
  isGroup: boolean;
  /** Child rows (for hierarchical grouping) */
  children?: PivotRow[];
  /** Number of data rows in this group */
  rowCount?: number;
}

// #region Event Detail Types

/** Detail for `pivot-toggle` event. Fired when a group is expanded/collapsed. */
export interface PivotToggleDetail {
  /** The pivot row key that was toggled. */
  key: string;
  /** Whether the group is now expanded. */
  expanded: boolean;
  /** The display label of the group. */
  label: string;
  /** The depth level of the group. */
  depth: number;
}

/** Detail for `pivot-state-change` event. Fired when pivot is enabled or disabled. */
export interface PivotStateChangeDetail {
  /** Whether pivot is now active. */
  active: boolean;
}

/** Detail for `pivot-config-change` event. Fired when pivot configuration changes via the panel. */
export interface PivotConfigChangeDetail {
  /** The configuration property that changed. */
  property: string;
  /** The field that was affected (if applicable). */
  field?: string;
  /** The zone that was affected (if applicable). */
  zone?: 'rowGroups' | 'columnGroups' | 'values';
}

// #endregion

// Module Augmentation - Register plugin name for type-safe getPluginByName()
declare module '../../core/types' {
  interface PluginNameMap {
    pivot: import('./PivotPlugin').PivotPlugin;
  }
}
