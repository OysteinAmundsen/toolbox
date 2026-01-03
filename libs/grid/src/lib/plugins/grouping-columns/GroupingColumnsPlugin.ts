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
  override readonly version = '1.0.0';

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
   */
  static detect(rows: readonly any[], config: any): boolean {
    const columns = config?.columns;
    if (!Array.isArray(columns)) return false;
    return hasColumnGroups(columns);
  }
  // #endregion

  // #region Hooks

  override processColumns(columns: readonly ColumnConfig[]): ColumnConfig[] {
    // Compute groups from column definitions
    const groups = computeColumnGroups(columns as ColumnConfig[]);

    if (groups.length === 0) {
      this.isActive = false;
      this.groups = [];
      return [...columns];
    }

    this.isActive = true;
    this.groups = groups;

    // Return columns unchanged - the afterRender hook will add the group header
    return [...columns];
  }

  override afterRender(): void {
    if (!this.isActive || this.groups.length === 0) {
      // Remove any existing group header
      const header = this.shadowRoot?.querySelector('.header');
      const existingGroupRow = header?.querySelector('.header-group-row');
      if (existingGroupRow) existingGroupRow.remove();
      return;
    }

    const header = this.shadowRoot?.querySelector('.header');
    if (!header) return;

    // Remove existing group row if present
    const existingGroupRow = header.querySelector('.header-group-row');
    if (existingGroupRow) existingGroupRow.remove();

    // Build and insert group header row
    const groupRow = buildGroupHeaderRow(this.groups, this.columns as ColumnConfig[]);
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
      applyGroupedHeaderCellClasses(headerRow, this.groups, this.columns as ColumnConfig[]);
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

  // #region Styles

  override readonly styles = styles;
  // #endregion
}
