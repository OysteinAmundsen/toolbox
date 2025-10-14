/**
 * Row Grouping Plugin (Class-based)
 *
 * Enables hierarchical row grouping with expand/collapse and aggregations.
 */

/* eslint-disable @typescript-eslint/no-explicit-any */

import { BaseGridPlugin, CellClickEvent } from '../../core/plugin/base-plugin';
import {
  buildGroupedRowModel,
  collapseAllGroups,
  expandAllGroups,
  getGroupRowCount,
  runAggregator,
  toggleGroupExpansion,
} from './grouping-rows';
import type { GroupingRowsConfig, GroupRowModelItem, GroupToggleDetail, RenderRow } from './types';

/**
 * Group state information returned by getGroupState()
 */
export interface GroupState {
  /** Whether grouping is currently active */
  isActive: boolean;
  /** Number of expanded groups */
  expandedCount: number;
  /** Total number of groups */
  totalGroups: number;
  /** Array of expanded group keys */
  expandedKeys: string[];
}

/**
 * Row Grouping Plugin for tbw-grid
 *
 * @example
 * ```ts
 * new GroupingRowsPlugin({
 *   enabled: true,
 *   groupOn: (row) => row.category,
 *   defaultExpanded: false,
 *   showRowCount: true,
 * })
 * ```
 */
export class GroupingRowsPlugin extends BaseGridPlugin<GroupingRowsConfig> {
  readonly name = 'groupingRows';
  override readonly version = '1.0.0';

  protected override get defaultConfig(): Partial<GroupingRowsConfig> {
    return {
      enabled: true,
      defaultExpanded: false,
      showRowCount: true,
      indentWidth: 20,
      aggregators: {},
    };
  }

  // ===== Internal State =====
  private expandedKeys: Set<string> = new Set();
  private flattenedRows: RenderRow[] = [];
  private isActive = false;

  // ===== Lifecycle =====

  override detach(): void {
    this.expandedKeys.clear();
    this.flattenedRows = [];
    this.isActive = false;
  }

  // ===== Hooks =====

  /**
   * Auto-detect grouping configuration from grid config.
   * Called by plugin system to determine if plugin should activate.
   */
  static detect(rows: readonly any[], config: any): boolean {
    return typeof config?.groupOn === 'function' || typeof config?.enableRowGrouping === 'boolean';
  }

  override processRows(rows: readonly any[]): any[] {
    const config = this.config;

    // Check if grouping is configured
    if (!config.enabled || typeof config.groupOn !== 'function') {
      this.isActive = false;
      this.flattenedRows = [];
      return [...rows];
    }

    // Build grouped model
    const grouped = buildGroupedRowModel({
      rows: rows as any[],
      config: config,
      expanded: this.expandedKeys,
    });

    // If no grouping produced, return original rows
    if (grouped.length === 0) {
      this.isActive = false;
      this.flattenedRows = [];
      return [...rows];
    }

    this.isActive = true;
    this.flattenedRows = grouped;

    // Return flattened rows for rendering
    // The grid will need to handle group rows specially
    return grouped.map((item) => {
      if (item.kind === 'group') {
        return {
          __isGroupRow: true,
          __groupKey: item.key,
          __groupValue: item.value,
          __groupDepth: item.depth,
          __groupRows: item.rows,
          __groupExpanded: item.expanded,
          __groupRowCount: getGroupRowCount(item),
        };
      }
      return item.row;
    });
  }

  override onCellClick(event: CellClickEvent): boolean | void {
    const row = event.row;

    // Check if this is a group row toggle
    if (row?.__isGroupRow) {
      const target = event.originalEvent.target as HTMLElement;
      if (target?.closest('.group-toggle')) {
        this.toggle(row.__groupKey);
        return true; // Prevent default
      }
    }
  }

  /**
   * Render a row. Returns true if we handled the row (group row), false otherwise.
   */
  override renderRow(row: any, rowEl: HTMLElement, _rowIndex: number): boolean {
    // Only handle group rows
    if (!row?.__isGroupRow) {
      return false;
    }

    const config = this.config;

    // If a custom renderer is provided, use it
    if (config.groupRowRenderer) {
      const toggleExpand = () => {
        this.toggle(row.__groupKey);
      };

      const result = config.groupRowRenderer({
        key: row.__groupKey,
        value: row.__groupValue,
        depth: row.__groupDepth,
        rows: row.__groupRows,
        expanded: row.__groupExpanded,
        toggleExpand,
      });

      if (result) {
        rowEl.className = 'group-row';
        (rowEl as any).__isCustomRow = true; // Mark for proper class reset on recycle
        rowEl.setAttribute('data-group-depth', String(row.__groupDepth));
        if (typeof result === 'string') {
          rowEl.innerHTML = result;
        } else {
          rowEl.innerHTML = '';
          rowEl.appendChild(result);
        }
        return true;
      }
    }

    // Helper to toggle expansion
    const handleToggle = () => {
      this.toggle(row.__groupKey);
    };

    // Default group row rendering
    rowEl.className = 'group-row';
    (rowEl as any).__isCustomRow = true; // Mark for proper class reset on recycle
    rowEl.setAttribute('data-group-depth', String(row.__groupDepth));
    rowEl.setAttribute('role', 'row');
    rowEl.setAttribute('aria-expanded', String(row.__groupExpanded));
    rowEl.style.paddingLeft = `${(row.__groupDepth || 0) * (config.indentWidth ?? 20)}px`;
    rowEl.innerHTML = '';

    const isFullWidth = config.fullWidth !== false; // default true

    if (isFullWidth) {
      this.renderFullWidthGroupRow(row, rowEl, handleToggle);
    } else {
      this.renderPerColumnGroupRow(row, rowEl, handleToggle);
    }

    return true;
  }

  override afterRender(): void {
    // No additional DOM manipulation needed for grouping
    // The renderRow hook handles all group row rendering
  }

  // ===== Private Rendering Helpers =====

  private renderFullWidthGroupRow(row: any, rowEl: HTMLElement, handleToggle: () => void): void {
    const config = this.config;

    // Full-width mode: single spanning cell with toggle + label + count
    const cell = document.createElement('div');
    cell.className = 'cell group-full';
    cell.style.gridColumn = '1 / -1';
    cell.setAttribute('role', 'gridcell');

    // Toggle button with click handler
    const btn = document.createElement('button');
    btn.type = 'button';
    btn.className = 'group-toggle';
    btn.setAttribute('aria-label', row.__groupExpanded ? 'Collapse group' : 'Expand group');
    btn.textContent = row.__groupExpanded ? '▾' : '▸';
    btn.addEventListener('click', (e) => {
      e.stopPropagation();
      handleToggle();
    });
    cell.appendChild(btn);

    // Group label - use formatLabel if provided
    const label = document.createElement('span');
    label.className = 'group-label';
    const labelText = config.formatLabel
      ? config.formatLabel(row.__groupValue, row.__groupDepth || 0, row.__groupKey)
      : String(row.__groupValue);
    label.textContent = labelText;
    cell.appendChild(label);

    // Row count
    if (config.showRowCount !== false) {
      const count = document.createElement('span');
      count.className = 'group-count';
      count.textContent = `(${row.__groupRowCount ?? row.__groupRows?.length ?? 0})`;
      cell.appendChild(count);
    }

    rowEl.appendChild(cell);
  }

  private renderPerColumnGroupRow(row: any, rowEl: HTMLElement, handleToggle: () => void): void {
    const config = this.config;
    const aggregators = config.aggregators ?? {};
    const columns = this.columns;
    const groupRows = row.__groupRows ?? [];

    // Get grid template from the grid element
    const gridEl = this.grid as any;
    const bodyEl = this.shadowRoot?.querySelector('.body') as HTMLElement | null;
    const gridTemplate = bodyEl?.style.gridTemplateColumns || '';
    if (gridTemplate) {
      rowEl.style.display = 'grid';
      rowEl.style.gridTemplateColumns = gridTemplate;
    }

    columns.forEach((col, colIdx) => {
      const cell = document.createElement('div');
      cell.className = 'cell group-cell';
      cell.setAttribute('data-col', String(colIdx));
      cell.setAttribute('role', 'gridcell');

      if (colIdx === 0) {
        // First column: toggle button + label
        const btn = document.createElement('button');
        btn.type = 'button';
        btn.className = 'group-toggle';
        btn.textContent = row.__groupExpanded ? '▾' : '▸';
        btn.addEventListener('click', (e) => {
          e.stopPropagation();
          handleToggle();
        });
        cell.appendChild(btn);

        const label = document.createElement('span');
        const firstColAgg = aggregators[col.field];
        if (firstColAgg) {
          const aggResult = runAggregator(firstColAgg, groupRows, col.field, col);
          label.textContent = aggResult != null ? String(aggResult) : String(row.__groupValue);
        } else {
          const labelText = config.formatLabel
            ? config.formatLabel(row.__groupValue, row.__groupDepth || 0, row.__groupKey)
            : String(row.__groupValue);
          label.textContent = labelText;
        }
        cell.appendChild(label);

        if (config.showRowCount !== false) {
          const count = document.createElement('span');
          count.className = 'group-count';
          count.textContent = ` (${groupRows.length})`;
          cell.appendChild(count);
        }
      } else {
        // Other columns: run aggregator if defined
        const aggRef = aggregators[col.field];
        if (aggRef) {
          const result = runAggregator(aggRef, groupRows, col.field, col);
          cell.textContent = result != null ? String(result) : '';
        } else {
          cell.textContent = '';
        }
      }

      rowEl.appendChild(cell);
    });
  }

  // ===== Public API =====

  /**
   * Expand all groups.
   */
  expandAll(): void {
    this.expandedKeys = expandAllGroups(this.flattenedRows);
    this.requestRender();
  }

  /**
   * Collapse all groups.
   */
  collapseAll(): void {
    this.expandedKeys = collapseAllGroups();
    this.requestRender();
  }

  /**
   * Toggle expansion of a specific group.
   * @param key - The group key to toggle
   */
  toggle(key: string): void {
    this.expandedKeys = toggleGroupExpansion(this.expandedKeys, key);

    // Find the group to emit event details
    const group = this.flattenedRows.find((r) => r.kind === 'group' && r.key === key) as GroupRowModelItem | undefined;

    this.emit<GroupToggleDetail>('group-toggle', {
      key,
      expanded: this.expandedKeys.has(key),
      value: group?.value,
      depth: group?.depth ?? 0,
    });

    this.requestRender();
  }

  /**
   * Check if a specific group is expanded.
   * @param key - The group key to check
   * @returns Whether the group is expanded
   */
  isExpanded(key: string): boolean {
    return this.expandedKeys.has(key);
  }

  /**
   * Expand a specific group.
   * @param key - The group key to expand
   */
  expand(key: string): void {
    if (!this.expandedKeys.has(key)) {
      this.expandedKeys = new Set([...this.expandedKeys, key]);
      this.requestRender();
    }
  }

  /**
   * Collapse a specific group.
   * @param key - The group key to collapse
   */
  collapse(key: string): void {
    if (this.expandedKeys.has(key)) {
      const newKeys = new Set(this.expandedKeys);
      newKeys.delete(key);
      this.expandedKeys = newKeys;
      this.requestRender();
    }
  }

  /**
   * Get the current group state.
   * @returns Group state information
   */
  getGroupState(): GroupState {
    const groupRows = this.flattenedRows.filter((r) => r.kind === 'group');
    return {
      isActive: this.isActive,
      expandedCount: this.expandedKeys.size,
      totalGroups: groupRows.length,
      expandedKeys: [...this.expandedKeys],
    };
  }

  /**
   * Get the total count of visible rows (including group headers).
   * @returns Number of visible rows
   */
  getRowCount(): number {
    return this.flattenedRows.length;
  }

  /**
   * Refresh the grouped row model.
   * Call this after modifying groupOn or other config options.
   */
  refreshGroups(): void {
    this.requestRender();
  }

  /**
   * Get current expanded group keys.
   * @returns Array of expanded group keys
   */
  getExpandedGroups(): string[] {
    return [...this.expandedKeys];
  }

  /**
   * Get the flattened row model.
   * @returns Array of render rows (groups + data rows)
   */
  getFlattenedRows(): RenderRow[] {
    return this.flattenedRows;
  }

  /**
   * Check if grouping is currently active.
   * @returns Whether grouping is active
   */
  isGroupingActive(): boolean {
    return this.isActive;
  }

  /**
   * Set the groupOn function dynamically.
   * @param fn - The groupOn function or undefined to disable
   */
  setGroupOn(fn: ((row: any) => any[] | any | null | false) | undefined): void {
    (this.config as GroupingRowsConfig).groupOn = fn;
    this.requestRender();
  }

  // ===== Styles =====

  override readonly styles = `
    .group-row {
      background: var(--tbw-grouping-rows-bg, var(--tbw-color-panel-bg));
      font-weight: 500;
    }
    .group-row:hover {
      background: var(--tbw-grouping-rows-bg-hover, var(--tbw-color-row-hover));
    }
    .group-toggle {
      cursor: pointer;
      user-select: none;
      display: inline-flex;
      align-items: center;
      justify-content: center;
      width: 20px;
      height: 20px;
      margin-right: 4px;
      font-size: 10px;
    }
    .group-toggle:hover {
      background: var(--tbw-grouping-rows-toggle-hover, var(--tbw-color-row-hover));
      border-radius: 2px;
    }
    .group-label {
      display: inline-flex;
      align-items: center;
      gap: 8px;
    }
    .group-count {
      color: var(--tbw-grouping-rows-count-color, var(--tbw-color-fg-muted));
      font-size: 0.85em;
      font-weight: normal;
    }
    [data-group-depth="0"] .group-label { padding-left: 0; }
    [data-group-depth="1"] .group-label { padding-left: 20px; }
    [data-group-depth="2"] .group-label { padding-left: 40px; }
    [data-group-depth="3"] .group-label { padding-left: 60px; }
    [data-group-depth="4"] .group-label { padding-left: 80px; }
  `;
}
