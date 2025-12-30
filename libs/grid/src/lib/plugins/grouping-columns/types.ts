/**
 * Column Groups Plugin Types
 *
 * Type definitions for multi-level column header grouping.
 */

/* eslint-disable @typescript-eslint/no-explicit-any */

import type { ColumnConfig as CoreColumnConfig } from '../../core/types';

/** Configuration options for the column groups plugin */
export interface GroupingColumnsConfig {
  /** Custom group header renderer */
  groupHeaderRenderer?: (params: GroupHeaderRenderParams) => HTMLElement | string | void;
  /** Whether to show group borders (default: true) */
  showGroupBorders?: boolean;
}

/** Parameters passed to custom group header renderer */
export interface GroupHeaderRenderParams {
  /** The group ID */
  id: string;
  /** The group label (or id if no label) */
  label: string;
  /** Columns in this group */
  columns: CoreColumnConfig[];
  /** Starting column index */
  firstIndex: number;
  /** Whether this is an implicit (unnamed) group */
  isImplicit: boolean;
}

/** Internal state managed by the column groups plugin */
export interface GroupingColumnsState {
  /** Computed column groups */
  groups: ColumnGroup[];
  /** Whether groups are currently active */
  isActive: boolean;
}

/** Column group definition */
export interface ColumnGroup<T = any> {
  /** Unique group identifier */
  id: string;
  /** Display label for the group header */
  label?: string;
  /** Columns belonging to this group */
  columns: CoreColumnConfig<T>[];
  /** Index of first column in this group */
  firstIndex: number;
}

/** Extended column group with implicit flag */
export interface ColumnGroupInternal<T = any> extends ColumnGroup<T> {
  /** Whether this group was auto-generated for ungrouped columns */
  implicit?: boolean;
}
