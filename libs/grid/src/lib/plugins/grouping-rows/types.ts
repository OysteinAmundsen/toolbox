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

/** Map of field names to aggregator references * @since 0.1.1
 */
export type AggregatorMap = Record<string, import('../../core/internal/aggregators').AggregatorRef>;

/**
 * Pre-defined group definition for server-side grouping.
 *
 * When groups are provided externally (e.g. from a server), this interface
 * describes each group's structure. The plugin renders these groups as
 * collapsible headers and emits events when users expand/collapse them,
 * allowing the consumer to lazily load row data.
 *
 * @example
 * ```typescript
 * const groups: GroupDefinition[] = [
 *   { key: 'Engineering', value: 'Engineering', rowCount: 150 },
 *   { key: 'Sales', value: 'Sales', rowCount: 89 },
 *   { key: 'Marketing', value: 'Marketing', rowCount: 42,
 *     children: [
 *       { key: 'Digital', value: 'Digital', rowCount: 20 },
 *       { key: 'Brand', value: 'Brand', rowCount: 22 },
 *     ],
 *   },
 * ];
 * ```
 * @since 0.1.1
 */
export interface GroupDefinition {
  /** Unique group identifier. */
  key: string;
  /** Display value for the group header. */
  value: unknown;
  /** Expected row count from server (for display in group header). */
  rowCount?: number;
  /** Nested child groups for multi-level grouping. */
  children?: GroupDefinition[];
  /** Server-computed aggregate values keyed by field name. */
  aggregates?: Record<string, unknown>;
}

/** Detail payload for `group-expand` event (pre-defined group mode). * @since 0.1.1
 */
export interface GroupExpandDetail {
  /** The key of the group being expanded. */
  groupKey: string;
  /** The full path of group keys from root to this group. */
  groupPath: string[];
}

/** Detail payload for `group-collapse` event (pre-defined group mode). * @since 0.1.1
 */
export interface GroupCollapseDetail {
  /** The key of the group being collapsed. */
  groupKey: string;
  /** The full path of group keys from root to this group. */
  groupPath: string[];
}

/**
 * Default expanded state for group rows.
 * - `boolean`: true = expand all, false = collapse all
 * - `number`: expand group at this index (0-based)
 * - `string`: expand group with this key
 * - `string[]`: expand groups with these keys
 * @since 0.1.1
 */
export type DefaultExpandedValue = boolean | number | string | string[];

/** Configuration options for the row grouping plugin * @since 0.1.1
 */
export interface GroupingRowsConfig {
  /**
   * Callback to determine group path for a row.
   * Return an array of group keys, a single key, null/false to skip grouping.
   *
   * Mutually exclusive with `groups` — when `groups` is provided, `groupOn` is ignored.
   */
  groupOn?: (row: any) => any[] | any | null | false;
  /**
   * Pre-defined group structure for server-side grouping.
   *
   * When provided, the plugin renders these groups as collapsible headers
   * instead of analyzing row data with `groupOn`.
   *
   * When combined with `ServerSidePlugin`, group definitions are delivered
   * automatically via `datasource:data` events and this config is not needed.
   *
   * @example Static groups
   * ```typescript
   * new GroupingRowsPlugin({
   *   groups: [
   *     { key: 'Engineering', value: 'Engineering', rowCount: 150 },
   *     { key: 'Sales', value: 'Sales', rowCount: 89 },
   *   ],
   * });
   * ```
   */
  groups?: GroupDefinition[];
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

/** Parameters passed to custom group row renderer * @since 0.1.1
 */
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

/**
 * A group header row in the flattened render model.
 *
 * Part of the {@link RenderRow} discriminated union (discriminant: `kind === 'group'`).
 * Group rows represent collapsed/expanded group headers in the virtualized row list.
 * They are produced by the grouping engine when `groupOn` categorizes rows into hierarchical groups.
 *
 * @example
 * ```typescript
 * function isGroup(row: RenderRow): row is GroupRowModelItem {
 *   return row.kind === 'group';
 * }
 * ```
 * @since 0.1.1
 */
export interface GroupRowModelItem {
  /** Discriminant — always `'group'` for group header rows. */
  kind: 'group';
  /** Composite group key (nested groups separated by `"||"`, e.g. `"Engineering||Frontend"`). */
  key: string;
  /** Display value for this group level (the last segment of the group path). */
  value: any;
  /** Nesting depth (0 = top-level group). */
  depth: number;
  /** All data rows belonging to this group (including rows in nested sub-groups). */
  rows: any[];
  /** Whether this group is currently expanded (children visible). */
  expanded: boolean;
}

/**
 * A data (leaf) row in the flattened render model.
 *
 * Part of the {@link RenderRow} discriminated union (discriminant: `kind === 'data'`).
 * Data rows represent actual row objects from the grid's data source.
 * Only visible when their parent group(s) are expanded.
 * @since 0.1.1
 */
export interface DataRowModelItem {
  /** Discriminant — always `'data'` for leaf data rows. */
  kind: 'data';
  /** The original row object from the data source. */
  row: any;
  /** Index of this row in the grid's current (post-sort/filter) row array. */
  rowIndex: number;
}

/**
 * Discriminated union of row types in the flattened render model.
 *
 * The grouping plugin transforms the grid's row array into a flat list of
 * `RenderRow` items that the virtualization engine iterates over. Each item
 * is either a {@link GroupRowModelItem} (group header) or a {@link DataRowModelItem}
 * (leaf data row). Use the `kind` property to discriminate:
 *
 * ```typescript
 * for (const row of flattenedRows) {
 *   if (row.kind === 'group') {
 *     renderGroupHeader(row);   // row is GroupRowModelItem
 *   } else {
 *     renderDataRow(row);       // row is DataRowModelItem
 *   }
 * }
 * ```
 * @since 0.1.1
 */
export type RenderRow = GroupRowModelItem | DataRowModelItem;

/** Event detail for group toggle * @since 0.1.1
 */
export interface GroupToggleDetail {
  /** The group key that was toggled */
  key: string;
  /** Whether the group is now expanded */
  expanded: boolean;
  /** The group value */
  value: any;
  /** Depth level */
  depth: number;
  /** All currently expanded keys after the operation */
  expandedKeys?: string[];
}

// Module Augmentation - Register plugin name for type-safe getPluginByName()
declare module '../../core/types' {
  interface DataGridEventMap {
    /** Fired when a row group is expanded or collapsed. @group Grouping Events */
    'group-toggle': GroupToggleDetail;
    /** Fired when a pre-defined group is expanded. @group Grouping Events */
    'group-expand': GroupExpandDetail;
    /** Fired when a pre-defined group is collapsed. @group Grouping Events */
    'group-collapse': GroupCollapseDetail;
  }

  interface PluginNameMap {
    groupingRows: import('./GroupingRowsPlugin').GroupingRowsPlugin;
  }
}
