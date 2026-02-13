/**
 * Column Groups Plugin (Class-based)
 *
 * Enables multi-level column header grouping.
 */

/* eslint-disable @typescript-eslint/no-explicit-any */

import type { AfterCellRenderContext, PluginManifest, PluginQuery } from '../../core/plugin/base-plugin';
import { BaseGridPlugin } from '../../core/plugin/base-plugin';
import type { ColumnConfig } from '../../core/types';
import type { ColumnGroupInfo } from '../visibility/types';
import {
  applyGroupedHeaderCellClasses,
  buildGroupHeaderRow,
  computeColumnGroups,
  hasColumnGroups,
} from './grouping-columns';
import styles from './grouping-columns.css?inline';
import type { ColumnGroup, GroupingColumnsConfig } from './types';

/**
 * Column Grouping Plugin for tbw-grid
 *
 * Enables visual grouping of columns under shared headers. Supports two approaches:
 * declarative `columnGroups` at the grid level, or inline `group` property on columns.
 *
 * ## Installation
 *
 * ```ts
 * import { GroupingColumnsPlugin } from '@toolbox-web/grid/plugins/grouping-columns';
 * ```
 *
 * ## Configuration Options
 *
 * | Option | Type | Default | Description |
 * |--------|------|---------|-------------|
 * | `showGroupBorders` | `boolean` | `true` | Show borders between groups |
 * | `groupHeaderRenderer` | `function` | - | Custom renderer for group header content |
 *
 * ## Grid Config: `columnGroups`
 *
 * | Property | Type | Description |
 * |----------|------|-------------|
 * | `id` | `string` | Unique group identifier |
 * | `header` | `string` | Display label for the group header |
 * | `children` | `string[]` | Array of column field names in this group |
 *
 * ## Column Config: `group`
 *
 * | Type | Description |
 * |------|-------------|
 * | `string` | Simple group ID (used as both id and label) |
 * | `{ id: string; label?: string }` | Group object with explicit id and optional label |
 *
 * ## Programmatic API
 *
 * | Method | Signature | Description |
 * |--------|-----------|-------------|
 * | `isGroupingActive` | `() => boolean` | Check if grouping is active |
 * | `getGroups` | `() => ColumnGroup[]` | Get all computed groups |
 * | `getGroupColumns` | `(groupId) => ColumnConfig[]` | Get columns in a specific group |
 * | `refresh` | `() => void` | Force refresh of column groups |
 *
 * @example Declarative columnGroups (Recommended)
 * ```ts
 * import '@toolbox-web/grid';
 * import { GroupingColumnsPlugin } from '@toolbox-web/grid/plugins/grouping-columns';
 *
 * grid.gridConfig = {
 *   columnGroups: [
 *     { id: 'personal', header: 'Personal Info', children: ['firstName', 'lastName', 'email'] },
 *     { id: 'work', header: 'Work Info', children: ['department', 'title', 'salary'] },
 *   ],
 *   columns: [
 *     { field: 'firstName', header: 'First Name' },
 *     { field: 'lastName', header: 'Last Name' },
 *     // ...
 *   ],
 *   plugins: [new GroupingColumnsPlugin()],
 * };
 * ```
 *
 * @example Inline group Property
 * ```ts
 * grid.gridConfig = {
 *   columns: [
 *     { field: 'firstName', header: 'First Name', group: { id: 'personal', label: 'Personal Info' } },
 *     { field: 'lastName', header: 'Last Name', group: 'personal' }, // string shorthand
 *   ],
 *   plugins: [new GroupingColumnsPlugin()],
 * };
 * ```
 *
 * @see {@link GroupingColumnsConfig} for all configuration options
 * @see {@link ColumnGroup} for the group structure
 * @see {@link ReorderPlugin} for drag-to-reorder within groups
 *
 * @internal Extends BaseGridPlugin
 */
export class GroupingColumnsPlugin extends BaseGridPlugin<GroupingColumnsConfig> {
  /**
   * Plugin manifest - declares owned properties for configuration validation.
   * @internal
   */
  static override readonly manifest: PluginManifest = {
    ownedProperties: [
      {
        property: 'group',
        level: 'column',
        description: 'the "group" column property',
      },
      {
        property: 'columnGroups',
        level: 'config',
        description: 'the "columnGroups" config property',
        isUsed: (v) => Array.isArray(v) && v.length > 0,
      },
    ],
    queries: [{ type: 'getColumnGrouping', description: 'Returns column group metadata for the visibility panel' }],
  };

  /** @internal */
  readonly name = 'groupingColumns';
  /** @internal */
  override readonly styles = styles;

  /** @internal */
  protected override get defaultConfig(): Partial<GroupingColumnsConfig> {
    return {
      showGroupBorders: true,
      lockGroupOrder: false,
    };
  }

  // #region Internal State
  private groups: ColumnGroup[] = [];
  private isActive = false;
  /** Fields that are the last column in a group (for group-end border class). */
  #groupEndFields = new Set<string>();
  // #endregion

  // #region Lifecycle

  /** @internal */
  override attach(grid: import('../../core/plugin/base-plugin').GridElement): void {
    super.attach(grid);

    // Listen for cancelable column-move events to enforce group contiguity
    (grid as unknown as HTMLElement).addEventListener('column-move', this.#onColumnMove, {
      signal: this.disconnectSignal,
    });
  }

  /** @internal */
  override detach(): void {
    this.groups = [];
    this.isActive = false;
    this.#groupEndFields.clear();
  }

  // #region Column Move Guard

  /**
   * Handle the cancelable column-move event.
   * - When lockGroupOrder is enabled, prevents moves that would break group contiguity.
   * - Always refreshes #groupEndFields after a successful move so that afterCellRender
   *   applies group-end borders to the correct (reordered) last column.
   */
  #onColumnMove = (e: Event): void => {
    if (!this.isActive) return;

    const event = e as CustomEvent<{ field: string; columnOrder: string[] }>;
    const { field, columnOrder } = event.detail;

    if (this.config.lockGroupOrder) {
      // Check ALL explicit groups — moving any column (grouped or not) could break contiguity
      for (const group of this.groups) {
        if (group.id.startsWith('__implicit__')) continue;
        if (!this.#isGroupContiguous(group, columnOrder)) {
          event.preventDefault();
          this.#flashHeaderCell(field);
          return;
        }
      }
    }

    // Recompute group-end fields based on proposed column order.
    // setColumnOrder runs synchronously after this handler returns,
    // but afterCellRender (which reads #groupEndFields) fires during
    // the subsequent refreshVirtualWindow. Precompute using the
    // proposed columnOrder so the borders are correct immediately.
    this.#recomputeGroupEndFields(columnOrder);
  };

  /**
   * Recompute which fields are group-end based on a column order.
   * The last field of each explicit group in the order gets the group-end class.
   */
  #recomputeGroupEndFields(columnOrder: string[]): void {
    this.#groupEndFields.clear();
    // Find the last field of each group (including implicit groups between explicit ones).
    // Skip the very last group overall — no adjacent group follows it, so no separator needed.
    const lastGroupEndField = this.#findLastGroupEndField(columnOrder);
    for (const group of this.groups) {
      const groupFields = new Set(group.columns.map((c) => c.field));
      // Walk the column order in reverse to find the last member of this group
      for (let i = columnOrder.length - 1; i >= 0; i--) {
        if (groupFields.has(columnOrder[i])) {
          const field = columnOrder[i];
          // Don't mark the last group's trailing field — nothing follows it
          if (field !== lastGroupEndField) {
            this.#groupEndFields.add(field);
          }
          break;
        }
      }
    }
  }

  /**
   * Find the trailing field of the last group in column order (to exclude from group-end marking).
   */
  #findLastGroupEndField(columnOrder: string[]): string | null {
    if (this.groups.length === 0) return null;
    // Determine which group contains the last field in column order
    for (let i = columnOrder.length - 1; i >= 0; i--) {
      const field = columnOrder[i];
      for (const group of this.groups) {
        if (group.columns.some((c) => c.field === field)) {
          // This group is the last in display order — find its last field
          const groupFields = new Set(group.columns.map((c) => c.field));
          for (let j = columnOrder.length - 1; j >= 0; j--) {
            if (groupFields.has(columnOrder[j])) return columnOrder[j];
          }
        }
      }
    }
    return null;
  }

  /**
   * Check if all columns in a group are contiguous in the proposed column order.
   */
  #isGroupContiguous(group: ColumnGroup, columnOrder: string[]): boolean {
    const indices = group.columns
      .map((c) => columnOrder.indexOf(c.field))
      .filter((i) => i !== -1)
      .sort((a, b) => a - b);
    if (indices.length <= 1) return true;
    return indices.length === indices[indices.length - 1] - indices[0] + 1;
  }

  /**
   * Flash the header cell with an error color to indicate a blocked move.
   */
  #flashHeaderCell(field: string): void {
    const headerCell = this.gridElement?.querySelector(
      `.header-row [part~="header-cell"][data-field="${field}"]`,
    ) as HTMLElement;
    if (!headerCell) return;

    headerCell.style.setProperty('--_flash-color', 'var(--tbw-color-error)');
    headerCell.animate(
      [{ backgroundColor: 'rgba(from var(--_flash-color) r g b / 30%)' }, { backgroundColor: 'transparent' }],
      { duration: 400, easing: 'ease-out' },
    );
  }
  // #endregion

  /** @internal */
  override handleQuery(query: PluginQuery): unknown {
    if (query.type === 'getColumnGrouping') {
      return this.#getStableColumnGrouping();
    }
    return undefined;
  }

  /**
   * Get stable column grouping info that includes ALL columns (visible and hidden).
   * Used by the visibility panel to maintain group structure regardless of visibility state.
   * Fields within each group are sorted by current display order.
   */
  #getStableColumnGrouping(): ColumnGroupInfo[] {
    let result: ColumnGroupInfo[];

    // 1. Prefer declarative columnGroups - always complete, visibility-independent
    const columnGroups = this.grid?.gridConfig?.columnGroups;
    if (columnGroups && Array.isArray(columnGroups) && columnGroups.length > 0) {
      result = columnGroups
        .filter((g) => g.children.length > 0)
        .map((g) => ({
          id: g.id,
          label: g.header,
          fields: [...g.children],
        }));
    } else if (this.isActive && this.groups.length > 0) {
      // 2. If active groups exist from processColumns, use them
      result = this.groups
        .filter((g) => !g.id.startsWith('__implicit__'))
        .map<ColumnGroupInfo>((g) => ({
          id: g.id,
          label: g.label ?? g.id,
          fields: g.columns.map((c) => c.field),
        }));

      // Also check hidden columns for inline group properties not in active groups
      const allCols = this.columns as ColumnConfig[];
      for (const col of allCols) {
        if ((col as any).hidden && col.group) {
          const gId = typeof col.group === 'string' ? col.group : col.group.id;
          const gLabel = typeof col.group === 'string' ? col.group : (col.group.label ?? col.group.id);
          const existing = result.find((g) => g.id === gId);
          if (existing) {
            if (!existing.fields.includes(col.field)) existing.fields.push(col.field);
          } else {
            result.push({ id: gId, label: gLabel, fields: [col.field] });
          }
        }
      }
    } else {
      // 3. Fall back: scan ALL columns (including hidden) for inline group properties
      const allCols = this.columns as ColumnConfig[];
      const groupMap = new Map<string, ColumnGroupInfo>();
      for (const col of allCols) {
        if (!col.group) continue;
        const gId = typeof col.group === 'string' ? col.group : col.group.id;
        const gLabel = typeof col.group === 'string' ? col.group : (col.group.label ?? col.group.id);
        const existing = groupMap.get(gId);
        if (existing) {
          if (!existing.fields.includes(col.field)) existing.fields.push(col.field);
        } else {
          groupMap.set(gId, { id: gId, label: gLabel, fields: [col.field] });
        }
      }
      result = Array.from(groupMap.values());
    }

    // Sort fields within each group by current display order so consumers
    // (e.g. the visibility panel) render columns in their reordered positions.
    const displayOrder = this.grid?.getColumnOrder();
    if (displayOrder && displayOrder.length > 0) {
      const orderIndex = new Map(displayOrder.map((f, i) => [f, i]));
      for (const group of result) {
        group.fields.sort((a, b) => (orderIndex.get(a) ?? Infinity) - (orderIndex.get(b) ?? Infinity));
      }
    }

    return result;
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

  /** @internal */
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

    // Pre-compute group-end fields for the afterCellRender hook
    this.#groupEndFields.clear();
    for (const g of groups) {
      const lastCol = g.columns[g.columns.length - 1];
      if (lastCol?.field) {
        this.#groupEndFields.add(lastCol.field);
      }
    }

    // Return columns with group info applied
    return processedColumns;
  }

  /** @internal */
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

    // Recompute groups from visible columns only (hidden columns have no CSS grid track).
    // This also picks up any plugin-added columns (e.g. expander) that weren't present
    // during processColumns.
    const finalColumns = this.visibleColumns as ColumnConfig[];
    const groups = computeColumnGroups(finalColumns);
    if (groups.length === 0) return;

    // Keep #groupEndFields in sync for afterCellRender (covers scheduler-driven renders)
    this.#groupEndFields.clear();
    for (let gi = 0; gi < groups.length; gi++) {
      const g = groups[gi];
      const lastCol = g.columns[g.columns.length - 1];
      // Don't mark the last group — no adjacent group follows it
      if (lastCol?.field && gi < groups.length - 1) {
        this.#groupEndFields.add(lastCol.field);
      }
    }

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
  }

  /**
   * Apply group-end class to individual cells during render and scroll.
   * This is more efficient than querySelectorAll in afterRender and ensures
   * cells recycled during scroll also get the class applied.
   * @internal
   */
  override afterCellRender(context: AfterCellRenderContext): void {
    if (!this.isActive || !this.config.showGroupBorders) return;
    context.cellElement.classList.toggle('group-end', this.#groupEndFields.has(context.column.field));
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
