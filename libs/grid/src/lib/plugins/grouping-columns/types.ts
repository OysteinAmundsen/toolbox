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

/**
 * Parameters passed to the {@link GroupingColumnsConfig.groupHeaderRenderer | groupHeaderRenderer} callback.
 *
 * @example Return an HTML string with the group label and column count:
 * ```ts
 * groupHeaderRenderer: (params) => {
 *   return `<strong>${params.label}</strong> (${params.columns.length} cols)`;
 * }
 * ```
 *
 * @example Return an HTMLElement for full control:
 * ```ts
 * groupHeaderRenderer: (params) => {
 *   const el = document.createElement('span');
 *   el.style.cssText = 'display: flex; align-items: center; gap: 0.4em;';
 *   el.textContent = `${params.label} — ${params.columns.length} columns`;
 *   return el;
 * }
 * ```
 *
 * @example Return void to keep the default label:
 * ```ts
 * groupHeaderRenderer: (params) => {
 *   if (params.isImplicit) return; // keep default for implicit groups
 *   return `<em>${params.label}</em>`;
 * }
 * ```
 */
export interface GroupHeaderRenderParams {
  /** The group ID (e.g. `'personal'`, `'work'`). */
  id: string;
  /** The group display label. Falls back to {@link id} if no label was provided. */
  label: string;
  /** The column configurations belonging to this group. */
  columns: CoreColumnConfig[];
  /** Zero-based index of the first column in this group within the visible columns array. */
  firstIndex: number;
  /** `true` for auto-generated groups that cover ungrouped columns. Always `false` when called from the renderer (implicit groups are skipped). */
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
