/**
 * Column Groups Plugin (Class-based)
 *
 * Enables multi-level column header grouping.
 */

/* eslint-disable @typescript-eslint/no-explicit-any */

import { BaseGridPlugin } from '../../core/plugin/base-plugin';
import type { ColumnConfig } from '../../core/types';
import {
  applyGroupedHeaderCellClasses,
  buildGroupHeaderRow,
  computeColumnGroups,
  hasColumnGroups,
} from './grouping-columns';
import styles from './grouping-columns.css?inline';
import type { ColumnGroup, GroupingColumnsConfig } from './types';

/**
 * Column Groups Plugin for tbw-grid
 *
 * @example
 * ```ts
 * new GroupingColumnsPlugin({
 *   enabled: true,
 *   showGroupBorders: true,
 * })
 * ```
 */
export class GroupingColumnsPlugin extends BaseGridPlugin<GroupingColumnsConfig> {
  readonly name = 'groupingColumns';
  override readonly styles = styles;

  protected override get defaultConfig(): Partial<GroupingColumnsConfig> {
    return {
      showGroupBorders: true,
    };
  }

  // #region Internal State
  private groups: ColumnGroup[] = [];
  private isActive = false;
  // #endregion

  // #region Lifecycle

  override detach(): void {
    this.groups = [];
    this.isActive = false;
  }
  // #endregion

  // #region Static Detection

  /**
   * Auto-detect column groups from column configuration.
   * Detects both inline `column.group` properties and declarative `columnGroups` config.
   */
  static detect(rows: readonly any[], config: any): boolean {
    // Check for declarative columnGroups in config
    if (config?.columnGroups && Array.isArray(config.columnGroups) && config.columnGroups.length > 0) {
      return true;
    }
    // Check for inline group properties on columns
    const columns = config?.columns;
    if (!Array.isArray(columns)) return false;
    return hasColumnGroups(columns);
  }
  // #endregion

  // #region Hooks

  override processColumns(columns: readonly ColumnConfig[]): ColumnConfig[] {
    // First, check if gridConfig.columnGroups is defined and apply to columns
    const columnGroups = this.grid?.gridConfig?.columnGroups;
    let processedColumns: ColumnConfig[];

    if (columnGroups && Array.isArray(columnGroups) && columnGroups.length > 0) {
      // Build a map of field -> group info from the declarative config
      const fieldToGroup = new Map<string, { id: string; label: string }>();
      for (const group of columnGroups) {
        for (const field of group.children) {
          fieldToGroup.set(field, { id: group.id, label: group.header });
        }
      }

      // Apply group property to columns that don't already have one
      processedColumns = columns.map((col) => {
        const groupInfo = fieldToGroup.get(col.field);
        if (groupInfo && !col.group) {
          return { ...col, group: groupInfo };
        }
        return col;
      });
    } else {
      processedColumns = [...columns];
    }

    // Compute groups from column definitions (now including applied groups)
    const groups = computeColumnGroups(processedColumns);

    if (groups.length === 0) {
      this.isActive = false;
      this.groups = [];
      return processedColumns;
    }

    this.isActive = true;
    this.groups = groups;

    // Return columns with group info applied
    return processedColumns;
  }

  override afterRender(): void {
    if (!this.isActive) {
      // Remove any existing group header
      const header = this.gridElement?.querySelector('.header');
      const existingGroupRow = header?.querySelector('.header-group-row');
      if (existingGroupRow) existingGroupRow.remove();
      return;
    }

    const header = this.gridElement?.querySelector('.header');
    if (!header) return;

    // Remove existing group row if present
    const existingGroupRow = header.querySelector('.header-group-row');
    if (existingGroupRow) existingGroupRow.remove();

    // Recompute groups from the final column list (which includes plugin-added columns like expander).
    // The groups computed during processColumns may be stale if other plugins added columns.
    const finalColumns = this.columns as ColumnConfig[];
    const groups = computeColumnGroups(finalColumns);
    if (groups.length === 0) return;

    // Build and insert group header row
    const groupRow = buildGroupHeaderRow(groups, finalColumns);
    if (groupRow) {
      // Toggle border visibility class
      groupRow.classList.toggle('no-borders', !this.config.showGroupBorders);

      const headerRow = header.querySelector('.header-row');
      if (headerRow) {
        header.insertBefore(groupRow, headerRow);
      } else {
        header.appendChild(groupRow);
      }
    }

    // Apply classes to header cells
    const headerRow = header.querySelector('.header-row') as HTMLElement;
    if (headerRow) {
      // Toggle border visibility on header cells
      headerRow.classList.toggle('no-group-borders', !this.config.showGroupBorders);
      applyGroupedHeaderCellClasses(headerRow, groups, finalColumns);
    }

    // Apply group-end class to data cells for continuous border styling
    this.#applyGroupEndToDataCells(groups);
  }

  /**
   * Apply group-end class to all data cells in the last column of each group.
   * This extends the strong border separator through all data rows.
   */
  #applyGroupEndToDataCells(groups: ColumnGroup[]): void {
    if (!this.config.showGroupBorders) return;

    const gridEl = this.gridElement;
    if (!gridEl) return;

    // Collect the field names of all group-end columns
    const groupEndFields = new Set<string>();
    for (const g of groups) {
      const lastCol = g.columns[g.columns.length - 1];
      if (lastCol?.field) {
        groupEndFields.add(lastCol.field);
      }
    }

    // Apply group-end class to all data cells with those fields
    const allDataCells = gridEl.querySelectorAll('.rows .cell[data-field]');
    for (const cell of allDataCells) {
      const field = cell.getAttribute('data-field');
      if (field && groupEndFields.has(field)) {
        cell.classList.add('group-end');
      } else {
        cell.classList.remove('group-end');
      }
    }
  }
  // #endregion

  // #region Public API

  /**
   * Check if column groups are active.
   * @returns Whether grouping is active
   */
  isGroupingActive(): boolean {
    return this.isActive;
  }

  /**
   * Get the computed column groups.
   * @returns Array of column groups
   */
  getGroups(): ColumnGroup[] {
    return this.groups;
  }

  /**
   * Get columns in a specific group.
   * @param groupId - The group ID to find
   * @returns Array of columns in the group
   */
  getGroupColumns(groupId: string): ColumnConfig[] {
    const group = this.groups.find((g) => g.id === groupId);
    return group ? group.columns : [];
  }

  /**
   * Refresh column groups (recompute from current columns).
   */
  refresh(): void {
    this.requestRender();
  }
  // #endregion
}
