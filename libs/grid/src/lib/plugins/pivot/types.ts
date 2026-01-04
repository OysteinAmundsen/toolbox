/** Available aggregation function types */
export type AggFunc = 'sum' | 'avg' | 'count' | 'min' | 'max' | 'first' | 'last';

/** Animation style for expand/collapse */
export type ExpandCollapseAnimation = false | 'slide' | 'fade';

export interface PivotConfig {
  /** Whether pivot view is active on load (default: true when fields are configured) */
  active?: boolean;
  rowGroupFields?: string[];
  columnGroupFields?: string[];
  valueFields?: PivotValueField[];
  showTotals?: boolean;
  showGrandTotal?: boolean;
  /** Whether groups are expanded by default (default: true) */
  defaultExpanded?: boolean;
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
}

export interface PivotValueField {
  field: string;
  aggFunc: AggFunc;
  header?: string;
}

export interface PivotState {
  isActive: boolean;
  pivotResult: PivotResult | null;
  expandedKeys: Set<string>;
}

export interface PivotResult {
  rows: PivotRow[];
  columnKeys: string[];
  totals: Record<string, number>;
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
