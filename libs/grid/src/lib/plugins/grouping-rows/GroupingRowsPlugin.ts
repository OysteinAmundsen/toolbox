/**
 * Row Grouping Plugin (Class-based)
 *
 * Enables hierarchical row grouping with expand/collapse and aggregations.
 */

import { BaseGridPlugin, CellClickEvent, type PluginManifest, type PluginQuery } from '../../core/plugin/base-plugin';
import { isExpanderColumn } from '../../core/plugin/expander-column';
import type { RowElementInternal } from '../../core/types';
import {
  buildGroupedRowModel,
  collapseAllGroups,
  expandAllGroups,
  getGroupKeys,
  getGroupRowCount,
  resolveDefaultExpanded,
  runAggregator,
  toggleGroupExpansion,
} from './grouping-rows';
import styles from './grouping-rows.css?inline';
import type {
  ExpandCollapseAnimation,
  GroupingRowsConfig,
  GroupRowModelItem,
  GroupToggleDetail,
  RenderRow,
} from './types';

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
 * Organizes rows into collapsible hierarchical groups. Perfect for organizing data
 * by category, department, status, or any other dimension—or even multiple dimensions
 * for nested grouping. Includes aggregation support for summarizing group data.
 *
 * ## Installation
 *
 * ```ts
 * import { GroupingRowsPlugin } from '@toolbox-web/grid/plugins/grouping-rows';
 * ```
 *
 * ## Configuration Options
 *
 * | Option | Type | Default | Description |
 * |--------|------|---------|-------------|
 * | `groupOn` | `(row) => string[]` | - | Callback returning group path array |
 * | `defaultExpanded` | `boolean \\| number \\| string \\| string[]` | `false` | Initial expanded state |
 * | `showRowCount` | `boolean` | `true` | Show row count in group header |
 * | `indentWidth` | `number` | `20` | Indentation per level (pixels) |
 * | `fullWidth` | `boolean` | `true` | Group row spans full width |
 * | `animation` | `false \\| 'slide' \\| 'fade'` | `'slide'` | Expand/collapse animation |
 * | `accordion` | `boolean` | `false` | Only one group open at a time |
 *
 * ## Programmatic API
 *
 * | Method | Signature | Description |
 * |--------|-----------|-------------|
 * | `expandGroup` | `(path: string[]) => void` | Expand a specific group |
 * | `collapseGroup` | `(path: string[]) => void` | Collapse a specific group |
 * | `expandAll` | `() => void` | Expand all groups |
 * | `collapseAll` | `() => void` | Collapse all groups |
 * | `isGroupExpanded` | `(path: string[]) => boolean` | Check if group is expanded |
 * | `getGroupState` | `() => GroupState` | Get current grouping state |
 *
 * ## CSS Custom Properties
 *
 * | Property | Default | Description |
 * |----------|---------|-------------|
 * | `--tbw-group-indent-width` | `1.25em` | Indentation per group level |
 * | `--tbw-grouping-rows-bg` | `var(--tbw-color-panel-bg)` | Group row background |
 * | `--tbw-grouping-rows-count-color` | `var(--tbw-color-fg-muted)` | Count badge color |
 * | `--tbw-animation-duration` | `200ms` | Expand/collapse animation |
 *
 * @example Single-Level Grouping by Department
 * ```ts
 * import '@toolbox-web/grid';
 * import { GroupingRowsPlugin } from '@toolbox-web/grid/plugins/grouping-rows';
 *
 * const grid = document.querySelector('tbw-grid');
 * grid.gridConfig = {
 *   columns: [
 *     { field: 'name', header: 'Employee' },
 *     { field: 'department', header: 'Department' },
 *     { field: 'salary', header: 'Salary', type: 'currency' },
 *   ],
 *   plugins: [
 *     new GroupingRowsPlugin({
 *       groupOn: (row) => [row.department],
 *       showRowCount: true,
 *       defaultExpanded: false,
 *     }),
 *   ],
 * };
 * ```
 *
 * @example Multi-Level Grouping
 * ```ts
 * new GroupingRowsPlugin({
 *   groupOn: (row) => [row.region, row.department, row.team],
 *   indentWidth: 24,
 *   animation: 'slide',
 * })
 * ```
 *
 * @see {@link GroupingRowsConfig} for all configuration options
 * @see {@link GroupState} for the group state structure
 *
 * @internal Extends BaseGridPlugin
 */
export class GroupingRowsPlugin extends BaseGridPlugin<GroupingRowsConfig> {
  /**
   * Plugin manifest - declares configuration validation rules and events.
   * @internal
   */
  static override readonly manifest: PluginManifest<GroupingRowsConfig> = {
    events: [
      {
        type: 'grouping-state-change',
        description: 'Emitted when groups are expanded/collapsed. Subscribers can react to row visibility changes.',
      },
    ],
    queries: [
      {
        type: 'canMoveRow',
        description: 'Returns false for group header rows (cannot be reordered)',
      },
    ],
    configRules: [
      {
        id: 'groupingRows/accordion-defaultExpanded',
        severity: 'warn',
        message:
          `"accordion: true" and "defaultExpanded" (non-false) are used together.\n` +
          `  → In accordion mode, only one group can be open at a time.\n` +
          `  → Using defaultExpanded with multiple groups will collapse to one on first toggle.\n` +
          `  → Consider using "defaultExpanded: false" or a single group key/index with accordion mode.`,
        check: (config) =>
          config.accordion === true &&
          config.defaultExpanded !== false &&
          config.defaultExpanded !== undefined &&
          // Allow single group expansion with accordion
          !(typeof config.defaultExpanded === 'number') &&
          !(typeof config.defaultExpanded === 'string') &&
          // Warn if true or array with multiple items
          (config.defaultExpanded === true ||
            (Array.isArray(config.defaultExpanded) && config.defaultExpanded.length > 1)),
      },
    ],
  };

  /** @internal */
  readonly name = 'groupingRows';
  /** @internal */
  override readonly styles = styles;

  /** @internal */
  protected override get defaultConfig(): Partial<GroupingRowsConfig> {
    return {
      defaultExpanded: false,
      showRowCount: true,
      indentWidth: 20,
      aggregators: {},
      animation: 'slide',
      accordion: false,
    };
  }

  // #region Internal State
  private expandedKeys: Set<string> = new Set();
  private flattenedRows: RenderRow[] = [];
  private isActive = false;
  private previousVisibleKeys = new Set<string>();
  private keysToAnimate = new Set<string>();
  /** Track if initial defaultExpanded has been applied */
  private hasAppliedDefaultExpanded = false;
  // #endregion

  // #region Animation

  /**
   * Get expand/collapse animation style from plugin config.
   * Uses base class isAnimationEnabled to respect grid-level settings.
   */
  private get animationStyle(): ExpandCollapseAnimation {
    if (!this.isAnimationEnabled) return false;
    return this.config.animation ?? 'slide';
  }

  // #endregion

  // #region Lifecycle

  /** @internal */
  override detach(): void {
    this.expandedKeys.clear();
    this.flattenedRows = [];
    this.isActive = false;
    this.previousVisibleKeys.clear();
    this.keysToAnimate.clear();
    this.hasAppliedDefaultExpanded = false;
  }

  /**
   * Handle plugin queries.
   * @internal
   */
  override handleQuery(query: PluginQuery): unknown {
    if (query.type === 'canMoveRow') {
      // Group header rows cannot be reordered
      const row = query.context as any;
      if (row && row.__isGroupRow === true) {
        return false;
      }
    }
    return undefined;
  }
  // #endregion

  // #region Hooks

  /**
   * Auto-detect grouping configuration from grid config.
   * Called by plugin system to determine if plugin should activate.
   */
  static detect(rows: readonly any[], config: any): boolean {
    return typeof config?.groupOn === 'function' || typeof config?.enableRowGrouping === 'boolean';
  }

  /** @internal */
  override processRows(rows: readonly any[]): any[] {
    const config = this.config;

    // Check if grouping is configured
    if (typeof config.groupOn !== 'function') {
      this.isActive = false;
      this.flattenedRows = [];
      return [...rows];
    }

    // First build: get structure to know all group keys
    // (needed for index-based defaultExpanded)
    const initialBuild = buildGroupedRowModel({
      rows: [...rows],
      config: config,
      expanded: new Set(), // Empty to get all root groups
    });

    // If no grouping produced, return original rows
    if (initialBuild.length === 0) {
      this.isActive = false;
      this.flattenedRows = [];
      return [...rows];
    }

    // Resolve defaultExpanded on first render only
    let initialExpanded: Set<string> | undefined;
    if (!this.hasAppliedDefaultExpanded && this.expandedKeys.size === 0 && config.defaultExpanded !== false) {
      const allKeys = getGroupKeys(initialBuild);
      initialExpanded = resolveDefaultExpanded(config.defaultExpanded ?? false, allKeys);

      // Mark as applied and populate expandedKeys for subsequent toggles
      if (initialExpanded.size > 0) {
        this.expandedKeys = new Set(initialExpanded);
        this.hasAppliedDefaultExpanded = true;
      }
    }

    // Build with proper expanded state
    const grouped = buildGroupedRowModel({
      rows: [...rows],
      config: config,
      expanded: this.expandedKeys,
      initialExpanded,
    });

    this.isActive = true;
    this.flattenedRows = grouped;

    // Track which data rows are newly visible (for animation)
    this.keysToAnimate.clear();
    const currentVisibleKeys = new Set<string>();
    grouped.forEach((item, idx) => {
      if (item.kind === 'data') {
        const key = `data-${idx}`;
        currentVisibleKeys.add(key);
        if (!this.previousVisibleKeys.has(key)) {
          this.keysToAnimate.add(key);
        }
      }
    });
    this.previousVisibleKeys = currentVisibleKeys;

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

  /** @internal */
  override onCellClick(event: CellClickEvent): boolean | void {
    const row = event.row as Record<string, unknown> | undefined;

    // Check if this is a group row toggle
    if (row?.__isGroupRow) {
      const target = event.originalEvent.target as HTMLElement;
      if (target?.closest('.group-toggle')) {
        this.toggle(row.__groupKey as string);
        return true; // Prevent default
      }
    }
  }

  /** @internal */
  override onKeyDown(event: KeyboardEvent): boolean | void {
    // SPACE toggles expansion on group rows
    if (event.key !== ' ') return;

    const focusRow = this.grid._focusRow;
    const row = this.rows[focusRow] as Record<string, unknown> | undefined;

    // Only handle SPACE on group rows
    if (!row?.__isGroupRow) return;

    event.preventDefault();
    this.toggle(row.__groupKey as string);

    // Restore focus styling after render completes via render pipeline
    this.requestRenderWithFocus();
    return true;
  }

  /**
   * Render a row. Returns true if we handled the row (group row), false otherwise.
   * @internal
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
        rowEl.className = 'data-grid-row group-row';
        (rowEl as RowElementInternal).__isCustomRow = true; // Mark for proper class reset on recycle
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

    // Default group row rendering - keep data-grid-row class for focus/keyboard navigation
    rowEl.className = 'data-grid-row group-row';
    (rowEl as RowElementInternal).__isCustomRow = true; // Mark for proper class reset on recycle
    rowEl.setAttribute('data-group-depth', String(row.__groupDepth));
    rowEl.setAttribute('role', 'row');
    rowEl.setAttribute('aria-expanded', String(row.__groupExpanded));
    // Use CSS variable for depth-based indentation
    rowEl.style.setProperty('--tbw-group-depth', String(row.__groupDepth || 0));
    if (config.indentWidth !== undefined) {
      rowEl.style.setProperty('--tbw-group-indent-width', `${config.indentWidth}px`);
    }
    // Clear any inline height from previous use (e.g., responsive card mode sets height: auto)
    // This ensures group rows use CSS-defined height, not stale inline styles from recycled elements
    rowEl.style.height = '';
    rowEl.innerHTML = '';

    const isFullWidth = config.fullWidth !== false; // default true

    if (isFullWidth) {
      this.renderFullWidthGroupRow(row, rowEl, handleToggle);
    } else {
      this.renderPerColumnGroupRow(row, rowEl, handleToggle);
    }

    return true;
  }

  /** @internal */
  override afterRender(): void {
    const style = this.animationStyle;
    if (style === false || this.keysToAnimate.size === 0) return;

    const body = this.gridElement?.querySelector('.rows');
    if (!body) return;

    const animClass = style === 'fade' ? 'tbw-group-fade-in' : 'tbw-group-slide-in';
    for (const rowEl of body.querySelectorAll('.data-grid-row:not(.group-row)')) {
      const cell = rowEl.querySelector('.cell[data-row]');
      const idx = cell ? parseInt(cell.getAttribute('data-row') ?? '-1', 10) : -1;
      const item = this.flattenedRows[idx];
      const key = item?.kind === 'data' ? `data-${idx}` : undefined;

      if (key && this.keysToAnimate.has(key)) {
        rowEl.classList.add(animClass);
        rowEl.addEventListener('animationend', () => rowEl.classList.remove(animClass), { once: true });
      }
    }
    this.keysToAnimate.clear();
  }
  // #endregion

  // #region Private Rendering Helpers

  /**
   * Create a toggle button for expanding/collapsing a group.
   */
  private createToggleButton(expanded: boolean, handleToggle: () => void): HTMLButtonElement {
    const btn = document.createElement('button');
    btn.type = 'button';
    btn.className = `group-toggle${expanded ? ' expanded' : ''}`;
    btn.setAttribute('aria-label', expanded ? 'Collapse group' : 'Expand group');
    this.setIcon(btn, this.resolveIcon(expanded ? 'collapse' : 'expand'));
    btn.addEventListener('click', (e) => {
      e.stopPropagation();
      handleToggle();
    });
    return btn;
  }

  /**
   * Get the formatted label text for a group.
   */
  private getGroupLabelText(value: unknown, depth: number, key: string): string {
    const config = this.config;
    return config.formatLabel ? config.formatLabel(value, depth, key) : String(value);
  }

  private renderFullWidthGroupRow(row: any, rowEl: HTMLElement, handleToggle: () => void): void {
    const config = this.config;
    const aggregators = config.aggregators ?? {};
    const groupRows = row.__groupRows ?? [];

    // Full-width mode: single spanning cell with toggle + label + count + aggregates
    const cell = document.createElement('div');
    cell.className = 'cell group-full';
    cell.style.gridColumn = '1 / -1';
    cell.setAttribute('role', 'gridcell');
    cell.setAttribute('data-col', '0'); // Required for focus/click delegation

    // Toggle button
    cell.appendChild(this.createToggleButton(row.__groupExpanded, handleToggle));

    // Group label
    const label = document.createElement('span');
    label.className = 'group-label';
    label.textContent = this.getGroupLabelText(row.__groupValue, row.__groupDepth || 0, row.__groupKey);
    cell.appendChild(label);

    // Row count
    if (config.showRowCount !== false) {
      const count = document.createElement('span');
      count.className = 'group-count';
      count.textContent = `(${row.__groupRowCount ?? row.__groupRows?.length ?? 0})`;
      cell.appendChild(count);
    }

    // Render aggregates if configured
    const aggregatorEntries = Object.entries(aggregators);
    if (aggregatorEntries.length > 0) {
      const aggregatesContainer = document.createElement('span');
      aggregatesContainer.className = 'group-aggregates';

      for (const [field, aggRef] of aggregatorEntries) {
        const col = this.columns.find((c) => c.field === field);
        const result = runAggregator(aggRef, groupRows, field, col);
        if (result != null) {
          const aggSpan = document.createElement('span');
          aggSpan.className = 'group-aggregate';
          aggSpan.setAttribute('data-field', field);
          // Use column header as label if available
          const colHeader = col?.header ?? field;
          aggSpan.textContent = `${colHeader}: ${result}`;
          aggregatesContainer.appendChild(aggSpan);
        }
      }

      if (aggregatesContainer.children.length > 0) {
        cell.appendChild(aggregatesContainer);
      }
    }

    rowEl.appendChild(cell);
  }

  private renderPerColumnGroupRow(row: any, rowEl: HTMLElement, handleToggle: () => void): void {
    const config = this.config;
    const aggregators = config.aggregators ?? {};
    const columns = this.columns;
    const groupRows = row.__groupRows ?? [];

    // Get grid template from the grid element
    const bodyEl = this.gridElement?.querySelector('.body') as HTMLElement | null;
    const gridTemplate = bodyEl?.style.gridTemplateColumns || '';
    if (gridTemplate) {
      rowEl.style.display = 'grid';
      rowEl.style.gridTemplateColumns = gridTemplate;
    }

    // Track whether we've rendered the toggle button yet (should be in first non-expander column)
    let toggleRendered = false;

    columns.forEach((col, colIdx) => {
      const cell = document.createElement('div');
      cell.className = 'cell group-cell';
      cell.setAttribute('data-col', String(colIdx));
      cell.setAttribute('role', 'gridcell');

      // Skip expander columns (they're handled by other plugins like MasterDetail/Tree)
      // but still render an empty cell to maintain grid structure
      if (isExpanderColumn(col)) {
        cell.setAttribute('data-field', col.field);
        rowEl.appendChild(cell);
        return;
      }

      // First non-expander column gets the toggle button + label
      if (!toggleRendered) {
        toggleRendered = true;
        cell.appendChild(this.createToggleButton(row.__groupExpanded, handleToggle));

        const label = document.createElement('span');
        const firstColAgg = aggregators[col.field];
        if (firstColAgg) {
          const aggResult = runAggregator(firstColAgg, groupRows, col.field, col);
          label.textContent = aggResult != null ? String(aggResult) : String(row.__groupValue);
        } else {
          label.textContent = this.getGroupLabelText(row.__groupValue, row.__groupDepth || 0, row.__groupKey);
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
  // #endregion

  // #region Public API

  /**
   * Expand all groups.
   */
  expandAll(): void {
    this.expandedKeys = expandAllGroups(this.flattenedRows);
    this.emitPluginEvent('grouping-state-change', { expandedKeys: [...this.expandedKeys] });
    this.requestRender();
  }

  /**
   * Collapse all groups.
   */
  collapseAll(): void {
    this.expandedKeys = collapseAllGroups();
    this.emitPluginEvent('grouping-state-change', { expandedKeys: [...this.expandedKeys] });
    this.requestRender();
  }

  /**
   * Toggle expansion of a specific group.
   * In accordion mode, expanding a group will collapse all sibling groups.
   * @param key - The group key to toggle
   */
  toggle(key: string): void {
    const isExpanding = !this.expandedKeys.has(key);
    const config = this.config;

    // Find the group to get its depth for accordion mode
    const group = this.flattenedRows.find((r) => r.kind === 'group' && r.key === key) as GroupRowModelItem | undefined;

    // In accordion mode, collapse sibling groups when expanding
    if (config.accordion && isExpanding && group) {
      const newKeys = new Set<string>();
      // Keep only ancestors (keys that are prefixes of the current key) and the current key
      for (const existingKey of this.expandedKeys) {
        // Check if existingKey is an ancestor of the toggled key
        // Ancestors have composite keys that are prefixes of child keys (separated by '||')
        if (key.startsWith(existingKey + '||') || existingKey.startsWith(key + '||')) {
          // This is an ancestor or descendant - keep it only if ancestor
          if (key.startsWith(existingKey + '||')) {
            newKeys.add(existingKey);
          }
        } else {
          // Check depth - only keep groups at different depths
          const existingGroup = this.flattenedRows.find((r) => r.kind === 'group' && r.key === existingKey) as
            | GroupRowModelItem
            | undefined;
          if (existingGroup && existingGroup.depth !== group.depth) {
            newKeys.add(existingKey);
          }
        }
      }
      newKeys.add(key);
      this.expandedKeys = newKeys;
    } else {
      this.expandedKeys = toggleGroupExpansion(this.expandedKeys, key);
    }

    this.emit<GroupToggleDetail>('group-toggle', {
      key,
      expanded: this.expandedKeys.has(key),
      value: group?.value,
      depth: group?.depth ?? 0,
    });

    // Notify other plugins that grouping state changed (row visibility changed)
    this.emitPluginEvent('grouping-state-change', {
      expandedKeys: [...this.expandedKeys],
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
  // #endregion
}
