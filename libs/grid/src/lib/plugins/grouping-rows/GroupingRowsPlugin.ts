/**
 * Row Grouping Plugin (Class-based)
 *
 * Enables hierarchical row grouping with expand/collapse and aggregations.
 */

import { GridClasses } from '../../core/constants';
import { aggregatorRegistry } from '../../core/internal/aggregators';
import { announce, getA11yMessage } from '../../core/internal/aria';
import { setRowLoadingState } from '../../core/internal/loading';
import {
  BaseGridPlugin,
  CellClickEvent,
  HeaderClickEvent,
  type PluginManifest,
  type PluginQuery,
} from '../../core/plugin/base-plugin';
import { isExpanderColumn } from '../../core/plugin/expander-column';
import type { RowElementInternal } from '../../core/types';
import {
  buildGroupedRowModel,
  buildPreDefinedGroupModel,
  collapseAllGroups,
  expandAllGroups,
  getGroupKeys,
  getGroupPath,
  getGroupRowCount,
  resolveDefaultExpanded,
  resolveGroupFields,
  toggleGroupExpansion,
} from './grouping-rows';
import styles from './grouping-rows.css?inline';
import type {
  ExpandCollapseAnimation,
  GroupCollapseDetail,
  GroupDefinition,
  GroupExpandDetail,
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
 * import { queryGrid } from '@toolbox-web/grid';
 * import { GroupingRowsPlugin } from '@toolbox-web/grid/plugins/grouping-rows';
 *
 * const grid = queryGrid('tbw-grid');
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
    modifiesRowStructure: true,
    hookPriority: {
      // Run before MultiSort so we can intercept header clicks on grouped columns
      onHeaderClick: -1,
    },
    incompatibleWith: [
      {
        name: 'tree',
        reason:
          'Both plugins transform the entire row model. TreePlugin flattens nested hierarchies while ' +
          'GroupingRowsPlugin groups flat rows with synthetic headers. Use one approach per grid.',
      },
      {
        name: 'pivot',
        reason:
          'PivotPlugin creates its own aggregated row and column structure. ' +
          'Row grouping cannot be applied on top of pivot-generated rows.',
      },
    ],
    events: [
      {
        type: 'grouping-state-change',
        description: 'Emitted when groups are expanded/collapsed. Subscribers can react to row visibility changes.',
      },
      {
        type: 'group-expand',
        description: 'Emitted when a pre-defined group is expanded. Use to lazily load group row data.',
      },
      {
        type: 'group-collapse',
        description: 'Emitted when a pre-defined group is collapsed.',
      },
    ],
    queries: [
      {
        type: 'canMoveRow',
        description: 'Returns false for group header rows (cannot be reordered)',
      },
      {
        type: 'grouping:get-grouped-fields',
        description: 'Returns the column field names that match group depth levels (string[])',
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

  /**
   * Optional dependency on MultiSort for coordinated sort management.
   * When MultiSort is loaded, GroupingRows queries its sort model to determine
   * group header ordering. Without it, falls back to core sort state.
   */
  static override readonly dependencies = [
    { name: 'multiSort', required: false, reason: 'Queries sort model for coordinated group sorting' },
  ];

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
  /** Pre-defined group definitions (server-side mode) */
  private preDefinedGroups: GroupDefinition[] = [];
  /** Lazily loaded row data keyed by group key */
  private groupRowsMap = new Map<string, unknown[]>();
  /** Groups currently in a loading state */
  private loadingGroups = new Set<string>();
  /** Whether an async groups fetch is currently in progress */
  private groupsFetchInFlight = false;
  /** Column fields that produce group values (depth 0, 1, ...). Cached for
   *  the `grouping:get-grouped-fields` query so MultiSort can filter them out. */
  private groupedFields: string[] = [];
  /** User-specified sort directions per group depth level. Toggled via
   *  header clicks on grouped columns. */
  private userGroupSortDirections = new Map<number, 1 | -1>();
  /** Group keys with an in-flight rows fetch */
  private rowsFetchInFlight = new Set<string>();
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
    this.preDefinedGroups = [];
    this.groupRowsMap.clear();
    this.loadingGroups.clear();
    this.groupsFetchInFlight = false;
    this.groupedFields = [];
    this.userGroupSortDirections.clear();
    this.rowsFetchInFlight.clear();
  }

  /**
   * Provide row height for group header rows.
   *
   * If `groupRowHeight` is configured, returns that value for group rows.
   * This allows the variable row height system to use known heights for
   * group headers without needing to measure them from the DOM.
   *
   * @param row - The row object (may be a group row)
   * @param _index - Index in the processed rows array (unused)
   * @returns Height in pixels for group rows, undefined for data rows
   *
   * @internal Plugin hook for variable row height support
   */
  override getRowHeight(row: unknown, _index: number): number | undefined {
    // Only provide height if groupRowHeight is configured
    if (this.config.groupRowHeight == null) return undefined;

    // Check if this is a group row
    if ((row as { __isGroupRow?: boolean }).__isGroupRow === true) {
      return this.config.groupRowHeight;
    }

    return undefined;
  }

  /**
   * Handle plugin queries.
   * @internal
   */
  override handleQuery(query: PluginQuery): unknown {
    if (query.type === 'canMoveRow') {
      // Group header rows cannot be reordered
      const row = query.context as { __isGroupRow?: boolean } | null | undefined;
      if (row?.__isGroupRow === true) {
        return false;
      }
    }
    if (query.type === 'grouping:get-grouped-fields') {
      return [...this.groupedFields];
    }
    return undefined;
  }

  /**
   * Intercept header clicks on grouped columns to toggle group sort direction.
   * Returns `true` for grouped columns to prevent MultiSort from handling them.
   * @internal
   */
  override onHeaderClick(event: HeaderClickEvent): boolean | void {
    const fieldIndex = this.groupedFields.indexOf(event.field);
    if (fieldIndex === -1) return; // Not a grouped column — let other plugins handle it

    if (!event.column.sortable) return;

    // The fieldIndex in groupedFields corresponds to the group depth level
    // (resolveGroupFields populates them in depth order: 0, 1, 2, ...)
    const targetDepth = fieldIndex;

    // Toggle direction: asc → desc → asc
    const current = this.userGroupSortDirections.get(targetDepth) ?? 1;
    this.userGroupSortDirections.set(targetDepth, current === 1 ? -1 : 1);

    this.requestRender();
    return true; // Prevent MultiSort from handling this column
  }
  // #endregion

  // #region Sort State Resolution

  /**
   * Build a sort-direction map for each group depth level by cross-referencing
   * the active sort state with the column fields that produce group values.
   *
   * Supports three direction sources (in priority order):
   * 1. User-set directions via header clicks on grouped columns
   * 2. MultiSort plugin model (for backwards compatibility / state restore)
   * 3. Core single-column sort state
   */
  private resolveGroupSortDirections(rows: readonly any[]): Map<number, 1 | -1> | undefined {
    const config = this.config;
    if (typeof config.groupOn !== 'function' || rows.length === 0) {
      this.groupedFields = [];
      return undefined;
    }

    // Discover depth → field mapping by sampling rows
    const columnFields = this.columns.map((c) => c.field);
    const depthToField = resolveGroupFields([...rows], config.groupOn, columnFields);

    // Cache grouped field names for the grouping:get-grouped-fields query
    this.groupedFields = [...depthToField.values()];

    if (depthToField.size === 0) return undefined;

    // Start with user-set directions (from header clicks on grouped columns)
    const directions = new Map<number, 1 | -1>(this.userGroupSortDirections);

    // Fill missing depths from MultiSort model or core sort state
    if (directions.size < depthToField.size) {
      const activeSorts = new Map<string, 1 | -1>();

      const multiSortResults = this.grid?.query?.('sort:get-model', null);
      if (Array.isArray(multiSortResults) && multiSortResults.length > 0) {
        const sortModel = multiSortResults[0] as Array<{ field: string; direction: 'asc' | 'desc' }>;
        if (Array.isArray(sortModel)) {
          for (const entry of sortModel) {
            activeSorts.set(entry.field, entry.direction === 'desc' ? -1 : 1);
          }
        }
      }

      if (activeSorts.size === 0) {
        const gridHost = this.grid as unknown as { _sortState?: { field: string; direction: 1 | -1 } | null };
        if (gridHost._sortState) {
          activeSorts.set(gridHost._sortState.field, gridHost._sortState.direction);
        }
      }

      for (const [depth, field] of depthToField) {
        if (!directions.has(depth)) {
          const dir = activeSorts.get(field);
          if (dir !== undefined) {
            directions.set(depth, dir);
          }
        }
      }
    }

    return directions.size > 0 ? directions : undefined;
  }

  // #endregion

  // #region Hooks

  /**
   * Auto-detect grouping configuration from grid config.
   * Called by plugin system to determine if plugin should activate.
   */
  static detect(rows: readonly any[], config: any): boolean {
    return (
      typeof config?.groupOn === 'function' ||
      typeof config?.enableRowGrouping === 'boolean' ||
      Array.isArray(config?.groups) ||
      typeof config?.groups === 'function'
    );
  }

  /** @internal */
  override processRows(rows: readonly any[]): any[] {
    // Pre-defined groups path — use external group structure instead of groupOn analysis
    if (this.preDefinedGroups.length > 0 || this.config.groups != null) {
      // If groups is an async callback and hasn't been resolved yet, trigger fetch
      if (typeof this.config.groups === 'function' && this.preDefinedGroups.length === 0 && !this.groupsFetchInFlight) {
        this.fetchGroupsAsync(this.config.groups);
        // Return empty while loading
        this.isActive = true;
        this.flattenedRows = [];
        return [];
      }
      if (this.preDefinedGroups.length > 0) {
        return this.processPreDefinedGroups();
      }
      // Static array path
      if (Array.isArray(this.config.groups) && this.config.groups.length > 0) {
        return this.processPreDefinedGroups();
      }
      // Groups callback in flight or empty result — return empty
      this.isActive = typeof this.config.groups === 'function';
      this.flattenedRows = [];
      return [];
    }

    const config = this.config;

    // Check if grouping is configured
    if (typeof config.groupOn !== 'function') {
      this.isActive = false;
      this.flattenedRows = [];
      return [...rows];
    }

    // First build: get structure to know all group keys
    // (needed for index-based defaultExpanded)
    const groupSortDirections = this.resolveGroupSortDirections(rows);
    const initialBuild = buildGroupedRowModel({
      rows: [...rows],
      config: config,
      expanded: new Set(), // Empty to get all root groups
      groupSortDirections,
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
      groupSortDirections,
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
          // Cache key for variable row height support - survives expand/collapse
          __rowCacheKey: `group:${item.key}`,
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
      if (target?.closest(`.${GridClasses.GROUP_TOGGLE}`)) {
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
   * Render a row. Returns true if we handled the row (group row or loading placeholder), false otherwise.
   * @internal
   */
  override renderRow(row: any, rowEl: HTMLElement, _rowIndex: number): boolean {
    // Handle loading placeholder rows for pre-defined groups
    // Uses the grid's built-in row loading API for consistent, customizable spinners
    if (row?.__loading === true && row?.__groupKey) {
      rowEl.className = 'data-grid-row';
      (rowEl as RowElementInternal).__isCustomRow = true;
      rowEl.innerHTML = '';
      const cell = document.createElement('div');
      cell.className = 'cell';
      cell.style.gridColumn = '1 / -1';
      cell.setAttribute('role', 'gridcell');
      cell.textContent = '\u00A0'; // &nbsp; for row height
      rowEl.appendChild(cell);
      setRowLoadingState(rowEl, true);
      return true;
    }

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

  // #region Pre-Defined Groups

  /**
   * Build the row model from pre-defined group definitions.
   * Used when `groups` config or `setGroups()` provides external group structure.
   */
  private processPreDefinedGroups(): any[] {
    const groups =
      this.preDefinedGroups.length > 0
        ? this.preDefinedGroups
        : Array.isArray(this.config.groups)
          ? this.config.groups
          : [];

    if (groups.length === 0) {
      this.isActive = false;
      this.flattenedRows = [];
      return [];
    }

    // Resolve defaultExpanded on first render only
    if (!this.hasAppliedDefaultExpanded && this.expandedKeys.size === 0 && this.config.defaultExpanded !== false) {
      const allKeys = this.collectGroupKeys(groups);
      const initialExpanded = resolveDefaultExpanded(this.config.defaultExpanded ?? false, allKeys);
      if (initialExpanded.size > 0) {
        this.expandedKeys = new Set(initialExpanded);
        this.hasAppliedDefaultExpanded = true;
      }
    }

    const grouped = buildPreDefinedGroupModel({
      groups,
      expanded: this.expandedKeys,
      groupRows: this.groupRowsMap,
      loadingGroups: this.loadingGroups,
    });

    this.isActive = true;
    this.flattenedRows = grouped;

    // Track visible data rows for animation
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
    return grouped.map((item) => {
      if (item.kind === 'group') {
        // Look up the pre-defined group to get rowCount from server
        const groupDef = this.findGroupDefinition(groups, item.key);
        const rowCount = groupDef?.rowCount ?? item.rows.length;
        return {
          __isGroupRow: true,
          __groupKey: item.key,
          __groupValue: item.value,
          __groupDepth: item.depth,
          __groupRows: item.rows,
          __groupExpanded: item.expanded,
          __groupRowCount: rowCount,
          __rowCacheKey: `group:${item.key}`,
        };
      }
      return item.row;
    });
  }

  /**
   * Fetch group definitions from an async callback.
   * Sets `preDefinedGroups` when resolved and triggers re-render.
   */
  private fetchGroupsAsync(fn: () => Promise<GroupDefinition[]>): void {
    this.groupsFetchInFlight = true;
    fn().then(
      (groups) => {
        this.groupsFetchInFlight = false;
        this.preDefinedGroups = groups;
        this.requestRender();
      },
      () => {
        // On error, clear the in-flight flag so a retry can happen
        this.groupsFetchInFlight = false;
      },
    );
  }

  /**
   * Fetch rows for a group using the `rows` callback and update state.
   * Manages loading indicator automatically. Guards against duplicate in-flight fetches.
   */
  private fetchGroupRowsAsync(groupKey: string, groupDef: GroupDefinition): void {
    const rowsFn = this.config.rows;
    if (!rowsFn || this.rowsFetchInFlight.has(groupKey)) return;

    this.rowsFetchInFlight.add(groupKey);
    this.loadingGroups.add(groupKey);
    this.requestRender();

    rowsFn(groupDef).then(
      (rows) => {
        this.rowsFetchInFlight.delete(groupKey);
        this.groupRowsMap.set(groupKey, rows);
        this.loadingGroups.delete(groupKey);
        this.requestRender();
      },
      () => {
        this.rowsFetchInFlight.delete(groupKey);
        this.loadingGroups.delete(groupKey);
        this.requestRender();
      },
    );
  }

  /**
   * Collect all group keys from a pre-defined group tree.
   */
  private collectGroupKeys(groups: GroupDefinition[]): string[] {
    const keys: string[] = [];
    for (const g of groups) {
      keys.push(g.key);
      if (g.children?.length) {
        keys.push(...this.collectGroupKeys(g.children));
      }
    }
    return keys;
  }

  /**
   * Get the active group definitions (pre-defined or empty).
   */
  private getActiveGroups(): GroupDefinition[] {
    if (this.preDefinedGroups.length > 0) return this.preDefinedGroups;
    return Array.isArray(this.config.groups) ? this.config.groups : [];
  }

  /**
   * Find a group definition by key in the pre-defined group tree.
   */
  private findGroupDefinition(groups: GroupDefinition[], key: string): GroupDefinition | undefined {
    for (const g of groups) {
      if (g.key === key) return g;
      if (g.children?.length) {
        const found = this.findGroupDefinition(g.children, key);
        if (found) return found;
      }
    }
    return undefined;
  }
  // #endregion

  // #region Private Rendering Helpers

  /**
   * Create a toggle button for expanding/collapsing a group.
   */
  private createToggleButton(expanded: boolean, handleToggle: () => void): HTMLButtonElement {
    const btn = document.createElement('button');
    btn.type = 'button';
    btn.className = `${GridClasses.GROUP_TOGGLE}${expanded ? ` ${GridClasses.EXPANDED}` : ''}`;
    btn.setAttribute('aria-label', expanded ? 'Collapse group' : 'Expand group');
    this.setIcon(btn, expanded ? 'collapse' : 'expand');
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
    label.className = GridClasses.GROUP_LABEL;
    label.textContent = this.getGroupLabelText(row.__groupValue, row.__groupDepth || 0, row.__groupKey);
    cell.appendChild(label);

    // Row count
    if (config.showRowCount !== false) {
      const count = document.createElement('span');
      count.className = GridClasses.GROUP_COUNT;
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
        const result = aggregatorRegistry.run(aggRef, groupRows, field, col);
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
          const aggResult = aggregatorRegistry.run(firstColAgg, groupRows, col.field, col);
          label.textContent = aggResult != null ? String(aggResult) : String(row.__groupValue);
        } else {
          label.textContent = this.getGroupLabelText(row.__groupValue, row.__groupDepth || 0, row.__groupKey);
        }
        cell.appendChild(label);

        if (config.showRowCount !== false) {
          const count = document.createElement('span');
          count.className = GridClasses.GROUP_COUNT;
          count.textContent = ` (${groupRows.length})`;
          cell.appendChild(count);
        }
      } else {
        // Other columns: run aggregator if defined
        const aggRef = aggregators[col.field];
        if (aggRef) {
          const result = aggregatorRegistry.run(aggRef, groupRows, col.field, col);
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

    // Emit group-expand/group-collapse events for pre-defined mode
    const activeGroups = this.getActiveGroups();
    if (activeGroups.length > 0) {
      const groupPath = getGroupPath(activeGroups, key);
      if (isExpanding) {
        this.emit<GroupExpandDetail>('group-expand', { groupKey: key, groupPath });

        // Auto-fetch rows via `rows` callback if configured and not already cached
        if (config.rows && !this.groupRowsMap.has(key)) {
          const groupDef = this.findGroupDefinition(activeGroups, key);
          if (groupDef) {
            this.fetchGroupRowsAsync(key, groupDef);
          }
        }
      } else {
        this.emit<GroupCollapseDetail>('group-collapse', { groupKey: key, groupPath });
      }
    }

    // Announce group state change for screen readers
    const expanded = this.expandedKeys.has(key);
    const groupName = group?.value != null ? String(group.value) : key;
    if (expanded) {
      const rowCount = group?.rows?.length ?? 0;
      announce(this.gridElement, getA11yMessage(this.gridElement, 'groupExpanded', groupName, rowCount));
    } else {
      announce(this.gridElement, getA11yMessage(this.gridElement, 'groupCollapsed', groupName));
    }

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

  // --- Pre-defined group API ---

  /**
   * Replace auto-detected groups with an externally provided group structure.
   *
   * When groups are set, the plugin switches to pre-defined mode — `groupOn`
   * is ignored and the plugin renders the provided group headers instead.
   * Row data for each group must be populated via {@link setGroupRows}.
   *
   * @param groups - Array of group definitions, or empty array to clear
   */
  setGroups(groups: GroupDefinition[]): void {
    this.preDefinedGroups = groups;
    this.groupRowsMap.clear();
    this.loadingGroups.clear();
    this.rowsFetchInFlight.clear();
    this.expandedKeys.clear();
    this.hasAppliedDefaultExpanded = false;
    this.requestRender();
  }

  /**
   * Get the current pre-defined group structure.
   *
   * Returns the groups set via {@link setGroups} or the resolved `groups` config.
   * Returns an empty array when using `groupOn`-based grouping or while
   * an async `groups` callback is still in flight.
   *
   * @returns Current group definitions
   */
  getGroups(): GroupDefinition[] {
    if (this.preDefinedGroups.length > 0) return [...this.preDefinedGroups];
    return Array.isArray(this.config.groups) ? [...this.config.groups] : [];
  }

  /**
   * Populate row data for an expanded group.
   *
   * Call this in response to a `group-expand` event after fetching rows
   * from the server. The plugin will re-render to show the rows.
   *
   * If the {@link GroupingRowsConfig.rows | rows} callback is configured,
   * this is called automatically — you only need this for the imperative API.
   *
   * @param groupKey - The group key to populate
   * @param rows - The row data for this group
   */
  setGroupRows(groupKey: string, rows: unknown[]): void {
    this.groupRowsMap.set(groupKey, rows);
    this.loadingGroups.delete(groupKey);
    this.requestRender();
  }

  /**
   * Toggle loading indicator for a group.
   *
   * When loading is true, the group shows a loading spinner instead of row data.
   * Call with `false` after rows are loaded (also cleared by {@link setGroupRows}).
   *
   * @param groupKey - The group key
   * @param loading - Whether the group is loading
   */
  setGroupLoading(groupKey: string, loading: boolean): void {
    if (loading) {
      this.loadingGroups.add(groupKey);
    } else {
      this.loadingGroups.delete(groupKey);
    }
    this.requestRender();
  }

  /**
   * Clear cached row data for one or all groups.
   *
   * Use when the server data has changed and groups need to be re-fetched
   * on next expand.
   *
   * @param groupKey - Specific group key to clear, or omit to clear all
   */
  clearGroupRows(groupKey?: string): void {
    if (groupKey != null) {
      this.groupRowsMap.delete(groupKey);
      this.rowsFetchInFlight.delete(groupKey);
    } else {
      this.groupRowsMap.clear();
      this.rowsFetchInFlight.clear();
    }
    this.requestRender();
  }
  // #endregion
}
