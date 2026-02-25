/**
 * Row Grouping Plugin Types
 *
 * Type definitions for hierarchical row grouping feature.
 */

/* eslint-disable @typescript-eslint/no-explicit-any */

// Re-export aggregator types from core
export type { AggregatorFn, AggregatorRef } from '../../core/internal/aggregators';
export type { ExpandCollapseAnimation } from '../../core/types';

import type { ExpandCollapseAnimation } from '../../core/types';

/** Map of field names to aggregator references */
export type AggregatorMap = Record<string, import('../../core/internal/aggregators').AggregatorRef>;

/**
 * Default expanded state for group rows.
 * - `boolean`: true = expand all, false = collapse all
 * - `number`: expand group at this index (0-based)
 * - `string`: expand group with this key
 * - `string[]`: expand groups with these keys
 */
export type DefaultExpandedValue = boolean | number | string | string[];

/** Configuration options for the row grouping plugin */
export interface GroupingRowsConfig {
  /**
   * Callback to determine group path for a row.
   * Return an array of group keys, a single key, null/false to skip grouping.
   */
  groupOn?: (row: any) => any[] | any | null | false;
  /**
   * Default expanded state for group rows.
   * - `true`: Expand all groups initially
   * - `false`: Collapse all groups initially (default)
   * - `number`: Expand group at this index (0-based)
   * - `string`: Expand group with this key (composite key format: "parent||child")
   * - `string[]`: Expand groups with these keys
   * @default false
   */
  defaultExpanded?: DefaultExpandedValue;
  /** Custom group row renderer - takes full control of group row rendering */
  groupRowRenderer?: (params: GroupRowRenderParams) => HTMLElement | string | void;
  /** Show row count in group headers (default: true) */
  showRowCount?: boolean;
  /** Indent width per depth level in pixels (default: 20) */
  indentWidth?: number;
  /** Aggregators for group row cells by field name */
  aggregators?: AggregatorMap;
  /** Custom format function for group label */
  formatLabel?: (value: any, depth: number, key: string) => string;
  /** Whether to render group row as full-width spanning cell (default: true) */
  fullWidth?: boolean;
  /**
   * Animation style for expanding/collapsing groups.
   * - `false`: No animation
   * - `'slide'`: Slide animation (default)
   * - `'fade'`: Fade animation
   * @default 'slide'
   */
  animation?: ExpandCollapseAnimation;
  /**
   * Accordion mode - only one group can be expanded at a time.
   * Expanding a group will automatically collapse all other groups at the same depth.
   * @default false
   */
  accordion?: boolean;
  /**
   * Height of group header rows in pixels.
   * Used by the variable row height system to provide consistent heights
   * for group rows without needing to measure them.
   *
   * If not specified, group rows will be measured from the DOM like data rows.
   * Setting this improves performance by avoiding DOM measurements.
   *
   * @example
   * ```ts
   * new GroupingRowsPlugin({
   *   groupOn: (row) => [row.department],
   *   groupRowHeight: 36, // Group headers are 36px tall
   * })
   * ```
   */
  groupRowHeight?: number;
}

/** Parameters passed to custom group row renderer */
export interface GroupRowRenderParams {
  /** The group key */
  key: string;
  /** The group value (last segment of path) */
  value: any;
  /** Depth level (0-based) */
  depth: number;
  /** All data rows in this group (including nested) */
  rows: any[];
  /** Whether the group is expanded */
  expanded: boolean;
  /** Toggle expand/collapse */
  toggleExpand: () => void;
}

/** Internal state managed by the row grouping plugin */
export interface GroupingRowsState {
  /** Set of expanded group keys */
  expandedKeys: Set<string>;
  /** Flattened render model */
  flattenedRows: RenderRow[];
  /** Whether grouping is currently active */
  isActive: boolean;
}

// Backward compatibility aliases
export type RowGroupingConfig = GroupingRowsConfig;
export type RowGroupingState = GroupingRowsState;

/** Group row model item */
export interface GroupRowModelItem {
  kind: 'group';
  key: string;
  value: any;
  depth: number;
  rows: any[];
  expanded: boolean;
}

/** Data row model item */
export interface DataRowModelItem {
  kind: 'data';
  row: any;
  rowIndex: number;
}

/** Union type for render rows */
export type RenderRow = GroupRowModelItem | DataRowModelItem;

/** Event detail for group toggle */
export interface GroupToggleDetail {
  /** The group key that was toggled */
  key: string;
  /** Whether the group is now expanded */
  expanded: boolean;
  /** The group value */
  value: any;
  /** Depth level */
  depth: number;
}

// Module Augmentation - Register plugin name for type-safe getPluginByName()
declare module '../../core/types' {
  interface PluginNameMap {
    groupingRows: import('./GroupingRowsPlugin').GroupingRowsPlugin;
  }
}
