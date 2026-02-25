/**
 * Column Groups Plugin Types
 *
 * Type definitions for multi-level column header grouping.
 */

/* eslint-disable @typescript-eslint/no-explicit-any */

import type { ColumnConfig as CoreColumnConfig } from '../../core/types';

// ============================================================================
// Module Augmentation - Extends core types with grouping-specific properties
// ============================================================================

declare module '../../core/types' {
  /**
   * Augment ColumnConfig with group assignment property.
   */
  interface ColumnConfig<TRow = any> {
    /**
     * Column group assignment for the GroupingColumnsPlugin.
     * Columns with the same group.id are rendered under a shared header.
     */
    group?: { id: string; label?: string } | string;
  }

  /**
   * Augment GridConfig with declarative column groups.
   */
  interface GridConfig<TRow = any> {
    /**
     * Declarative column group definitions for the GroupingColumnsPlugin.
     * Each group specifies an id, header label, and array of column field names.
     * The plugin will automatically assign the `group` property to matching columns.
     *
     * @example
     * ```ts
     * columnGroups: [
     *   { id: 'personal', header: 'Personal Info', children: ['firstName', 'lastName', 'email'] },
     *   { id: 'work', header: 'Work Info', children: ['department', 'title', 'salary'] },
     * ]
     * ```
     */
    columnGroups?: ColumnGroupDefinition[];
  }

  interface PluginNameMap {
    groupingColumns: import('./GroupingColumnsPlugin').GroupingColumnsPlugin;
  }
}

// ============================================================================
// Plugin Configuration Types
// ============================================================================

/** Configuration options for the column groups plugin */
export interface GroupingColumnsConfig {
  /** Custom group header renderer */
  groupHeaderRenderer?: (params: GroupHeaderRenderParams) => HTMLElement | string | void;
  /** Whether to show group borders (default: true) */
  showGroupBorders?: boolean;
  /**
   * Prevent columns from being reordered outside their group.
   * When enabled, column moves that would break group contiguity are blocked.
   * Works with both header drag-and-drop and visibility panel drag-and-drop.
   * @default false
   */
  lockGroupOrder?: boolean;
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

/**
 * Declarative column group definition for GridConfig.columnGroups.
 * Maps group metadata to column field names.
 */
export interface ColumnGroupDefinition {
  /** Unique group identifier */
  id: string;
  /** Display label for the group header */
  header: string;
  /** Array of column field names belonging to this group */
  children: string[];
}

/** Column group definition (computed at runtime) */
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
