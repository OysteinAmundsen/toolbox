/**
 * Pivot Plugin (Class-based)
 *
 * Provides pivot table functionality for tbw-grid.
 * Transforms flat data into grouped, aggregated pivot views.
 * Includes a tool panel for interactive pivot configuration.
 */

import { announce, getA11yMessage } from '../../core/internal/aria';
import { BaseGridPlugin, HeaderClickEvent, type PluginManifest, type PluginQuery } from '../../core/plugin/base-plugin';
import type { ColumnConfig, ToolPanelDefinition } from '../../core/types';
import {
  buildPivot,
  flattenPivotRows,
  getAllGroupKeys,
  getColumnTotals,
  resolveDefaultExpanded,
  sortPivotMulti,
  type PivotDataRow,
} from './pivot-engine';
import { createValueKey, validatePivotConfig } from './pivot-model';
import { renderPivotPanel, type FieldInfo, type PanelCallbacks } from './pivot-panel';
import { renderPivotGrandTotalRow, renderPivotGroupRow, renderPivotLeafRow, type PivotRowData } from './pivot-rows';
import type {
  AggFunc,
  ExpandCollapseAnimation,
  PivotConfig,
  PivotConfigChangeDetail,
  PivotResult,
  PivotSortConfig,
  PivotSortDir,
  PivotStateChangeDetail,
  PivotToggleDetail,
  PivotValueField,
} from './types';

// Import CSS as inline string (Vite handles this)
import styles from './pivot.css?inline';

/**
 * Pivot Table Plugin for tbw-grid
 *
 * Transforms flat data into a pivot table view with grouped rows, grouped columns,
 * and aggregated values. Includes an interactive tool panel for configuring
 * row groups, column groups, and value aggregations at runtime.
 *
 * ## Installation
 *
 * ```ts
 * import { PivotPlugin } from '@toolbox-web/grid/plugins/pivot';
 * ```
 *
 * ## Aggregation Functions
 *
 * `sum`, `avg`, `count`, `min`, `max`, `first`, `last`
 *
 * ## CSS Custom Properties
 *
 * | Property | Default | Description |
 * |----------|---------|-------------|
 * | `--tbw-pivot-group-bg` | `var(--tbw-color-row-alt)` | Group row background |
 * | `--tbw-pivot-grand-total-bg` | `var(--tbw-color-header-bg)` | Grand total row |
 *
 * @example Basic Pivot Table
 * ```ts
 * import '@toolbox-web/grid';
 * import { PivotPlugin } from '@toolbox-web/grid/plugins/pivot';
 *
 * grid.gridConfig = {
 *   columns: [...],
 *   plugins: [
 *     new PivotPlugin({
 *       rowGroupFields: ['region', 'product'],
 *       columnGroupFields: ['quarter'],
 *       valueFields: [{ field: 'sales', aggFunc: 'sum', header: 'Total' }],
 *     }),
 *   ],
 * };
 * ```
 *
 * @example Programmatic-Only (No Tool Panel)
 * ```ts
 * new PivotPlugin({
 *   showToolPanel: false,
 *   rowGroupFields: ['category'],
 *   valueFields: [{ field: 'amount', aggFunc: 'sum' }],
 * })
 * ```
 *
 * @see {@link PivotConfig} for all configuration options
 * @see {@link PivotValueField} for value field structure
 *
 * @internal Extends BaseGridPlugin
 */
export class PivotPlugin extends BaseGridPlugin<PivotConfig> {
  /**
   * Plugin manifest declaring incompatibilities with other plugins.
   * @internal
   */
  static override readonly manifest: PluginManifest = {
    modifiesRowStructure: true,
    hookPriority: {
      // Run before MultiSortPlugin so pivot columns are intercepted first
      // when MultiSort is NOT present; non-pivot columns fall through.
      onHeaderClick: -10,
      // Run AFTER MultiSortPlugin's processRows so MultiSort sorts raw rows
      // (a no-op for pivot fields) before Pivot builds and sorts its own rows.
      processRows: 100,
    },
    incompatibleWith: [
      {
        name: 'groupingRows',
        reason:
          'PivotPlugin creates its own aggregated row and column structure. ' +
          'Row grouping cannot be applied on top of pivot-generated rows.',
      },
      {
        name: 'tree',
        reason:
          'PivotPlugin replaces the entire row and column structure with aggregated pivot data. ' +
          'Tree hierarchy cannot coexist with pivot aggregation.',
      },
      {
        name: 'serverSide',
        reason:
          'PivotPlugin requires the full dataset to compute aggregations. ' +
          'ServerSidePlugin lazy-loads rows in blocks, so pivot aggregation cannot be performed client-side.',
      },
    ],
    queries: [{ type: 'sort:get-sort-config', description: 'Returns the current pivot sort configuration' }],
  };

  /** @internal */
  readonly name = 'pivot';
  /** @internal */
  override readonly styles = styles;

  /** Tool panel ID for shell integration */
  static readonly PANEL_ID = 'pivot';

  /** @internal */
  protected override get defaultConfig(): Partial<PivotConfig> {
    return {
      active: true,
      showTotals: true,
      showGrandTotal: true,
      showToolPanel: true,
      animation: 'slide',
    };
  }

  // #region Internal State
  private isActive = false;
  private hasInitialized = false;
  private pivotResult: PivotResult | null = null;
  private fieldHeaderMap: Map<string, string> = new Map();
  private expandedKeys: Set<string> = new Set();
  private defaultExpanded: boolean | number | string | string[] = true;
  /** Tracks whether user has manually interacted with expand/collapse */
  private userHasToggledExpand = false;
  private originalColumns: Array<{ field: string; header: string }> = [];
  private panelContainer: HTMLElement | null = null;
  private grandTotalFooter: HTMLElement | null = null;
  private previousVisibleKeys = new Set<string>();
  private keysToAnimate = new Set<string>();
  /** Cached value formatters keyed by value field name */
  private valueFormatters: Map<string, (value: number) => string> = new Map();
  /** Column totals for percentage mode */
  private columnTotals: Record<string, number> = {};
  /** Current interactive sort state for pivot columns (managed by onHeaderClick) */
  private activeSortField: string | null = null;
  private activeSortDir: PivotSortDir | null = null;

  /**
   * Check if the plugin has valid pivot configuration (at least value fields).
   */
  private hasValidPivotConfig(): boolean {
    return (this.config.valueFields?.length ?? 0) > 0;
  }

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
    this.isActive = false;
    this.hasInitialized = false;
    this.pivotResult = null;
    this.fieldHeaderMap.clear();
    this.originalColumns = [];
    this.panelContainer = null;
    this.cleanupGrandTotalFooter();
    this.previousVisibleKeys.clear();
    this.keysToAnimate.clear();
    this.userHasToggledExpand = false;
    this.valueFormatters.clear();
    this.columnTotals = {};
    this.activeSortField = null;
    this.activeSortDir = null;
    this.config.sortRows = undefined;
  }

  // #endregion

  // #region Shell Integration

  /** @internal */
  override getToolPanel(): ToolPanelDefinition | undefined {
    // Allow users to disable the tool panel for programmatic-only pivot
    // Check userConfig first (works before attach), then merged config
    const showToolPanel = this.config?.showToolPanel ?? this.userConfig?.showToolPanel ?? true;
    if (showToolPanel === false) {
      return undefined;
    }

    return {
      id: PivotPlugin.PANEL_ID,
      title: 'Pivot',
      icon: '⊞',
      tooltip: 'Configure pivot table',
      order: 90,
      render: (container) => this.renderPanel(container),
    };
  }

  // #endregion

  // #region Hooks

  /** @internal */
  override processRows(rows: readonly unknown[]): PivotDataRow[] {
    // Auto-enable pivot if config.active is true and we have valid pivot fields
    if (!this.hasInitialized && this.config.active !== false && this.hasValidPivotConfig()) {
      this.hasInitialized = true;
      this.isActive = true;
    }

    if (!this.isActive) {
      return [...rows] as PivotDataRow[];
    }

    const errors = validatePivotConfig(this.config);
    if (errors.length > 0) {
      this.warn(`Config errors: ${errors.join(', ')}`);
      return [...rows] as PivotDataRow[];
    }

    this.buildFieldHeaderMap();
    this.buildValueFormatters();
    this.defaultExpanded = this.config.defaultExpanded ?? true;

    // Build pivot first so we have the rows structure
    this.pivotResult = buildPivot(rows as PivotDataRow[], this.config);

    // When MultiSort is active, apply its sort model to pivot rows.
    // This overrides config.sortRows when MultiSort has active sorts.
    const multiSortConfigs = this.getMultiSortConfigs();
    if (multiSortConfigs) {
      sortPivotMulti(this.pivotResult.rows, multiSortConfigs, this.config.valueFields ?? []);
    }

    // Initialize expanded state with defaults if first build AND user hasn't manually toggled
    // This prevents re-expanding when user collapses all groups
    if (this.expandedKeys.size === 0 && !this.userHasToggledExpand) {
      const allKeys = getAllGroupKeys(this.pivotResult.rows);
      this.expandedKeys = resolveDefaultExpanded(this.defaultExpanded, allKeys);
    }

    // Cache column totals for percentage mode
    if (this.config.valueDisplayMode && this.config.valueDisplayMode !== 'raw') {
      this.columnTotals = getColumnTotals(
        this.pivotResult.rows,
        this.pivotResult.columnKeys,
        this.config.valueFields ?? [],
      );
    }

    // Return flattened pivot rows respecting expanded state
    const indentWidth = this.config.indentWidth ?? 20;
    const flattenedDefExpanded = this.defaultExpanded === true || this.defaultExpanded === undefined;
    const flatRows: PivotDataRow[] = flattenPivotRows(
      this.pivotResult.rows,
      this.expandedKeys,
      flattenedDefExpanded,
    ).map((pr) => ({
      __pivotRowKey: pr.rowKey,
      __pivotLabel: pr.rowLabel,
      __pivotDepth: pr.depth,
      __pivotIsGroup: pr.isGroup,
      __pivotHasChildren: Boolean(pr.children?.length),
      __pivotExpanded: this.expandedKeys.has(pr.rowKey),
      __pivotRowCount: pr.rowCount ?? 0,
      __pivotIndent: pr.depth * indentWidth,
      __pivotTotal: pr.total,
      ...pr.values,
    }));

    // Track which rows are newly visible (for animation)
    this.keysToAnimate.clear();
    const currentVisibleKeys = new Set<string>();
    for (const row of flatRows) {
      const key = row.__pivotRowKey as string;
      currentVisibleKeys.add(key);
      // Animate non-root rows that weren't previously visible
      if (!this.previousVisibleKeys.has(key) && (row.__pivotDepth as number) > 0) {
        this.keysToAnimate.add(key);
      }
    }
    this.previousVisibleKeys = currentVisibleKeys;

    // Grand total: include in row model when configured, otherwise rendered as sticky footer
    if (this.config.grandTotalInRowModel && this.config.showGrandTotal && this.pivotResult) {
      flatRows.push({
        __pivotRowKey: '__grandTotal',
        __pivotLabel: 'Grand Total',
        __pivotIsGrandTotal: true,
        __pivotDepth: 0,
        __pivotTotal: this.pivotResult.grandTotal,
        ...this.pivotResult.totals,
      });
    }

    return flatRows;
  }

  /** @internal */
  override processColumns(columns: readonly ColumnConfig[]): ColumnConfig[] {
    if (!this.isActive || !this.pivotResult) {
      return [...columns];
    }

    const pivotColumns: ColumnConfig[] = [];

    // Row label column
    const rowGroupHeaders = (this.config.rowGroupFields ?? []).map((f) => this.fieldHeaderMap.get(f) ?? f).join(' / ');
    pivotColumns.push({
      field: '__pivotLabel',
      header: rowGroupHeaders || 'Group',
      width: 200,
      sortable: true,
    });

    // Value columns for each column key
    for (const colKey of this.pivotResult.columnKeys) {
      for (const vf of this.config.valueFields ?? []) {
        const valueKey = createValueKey([colKey], vf.field);
        const valueHeader = vf.header || this.fieldHeaderMap.get(vf.field) || vf.field;
        const aggLabel = typeof vf.aggFunc === 'function' ? 'custom' : vf.aggFunc;
        const formatter = this.valueFormatters.get(vf.field);
        pivotColumns.push({
          field: valueKey,
          header: `${colKey} - ${valueHeader} (${aggLabel})`,
          width: 120,
          type: 'number',
          sortable: true,
          ...(formatter ? { format: (v: unknown) => (v != null ? formatter(Number(v)) : '') } : {}),
        } as ColumnConfig);
      }
    }

    // Totals column
    if (this.config.showTotals) {
      pivotColumns.push({
        field: '__pivotTotal',
        header: 'Total',
        width: 100,
        type: 'number',
        sortable: true,
      });
    }

    return pivotColumns;
  }

  /** @internal */
  override renderRow(row: Record<string, unknown>, rowEl: HTMLElement, rowIndex: number): boolean {
    const pivotRow = row as PivotRowData;

    // Handle grand total row in row model (when grandTotalInRowModel is true)
    if (pivotRow.__pivotIsGrandTotal) {
      return renderPivotGrandTotalRow(pivotRow, rowEl, this.gridColumns);
    }

    // Handle pivot group row (has children)
    if (pivotRow.__pivotRowKey && pivotRow.__pivotHasChildren) {
      return renderPivotGroupRow(pivotRow, rowEl, {
        columns: this.gridColumns,
        rowIndex,
        onToggle: (key) => this.toggle(key),
        setIcon: (el, iconKey) => this.setIcon(el, iconKey),
      });
    }

    // Handle pivot leaf row (no children but in pivot mode)
    if (pivotRow.__pivotRowKey !== undefined && this.isActive) {
      return renderPivotLeafRow(pivotRow, rowEl, this.gridColumns, rowIndex);
    }

    // Clean up any leftover pivot styling from pooled row elements
    this.cleanupPivotStyling(rowEl);

    return false;
  }

  /**
   * Remove pivot-specific classes, attributes, and inline styles from a row element.
   * Called when pivot mode is disabled to clean up reused DOM elements.
   * Clears innerHTML so the grid's default renderer can rebuild the row.
   */
  private cleanupPivotStyling(rowEl: HTMLElement): void {
    // Check if this row was previously rendered by pivot (has pivot classes)
    const wasPivotRow =
      rowEl.classList.contains('pivot-group-row') ||
      rowEl.classList.contains('pivot-leaf-row') ||
      rowEl.classList.contains('pivot-grand-total-row');

    if (wasPivotRow) {
      // Remove pivot row classes and restore the default grid row class
      rowEl.classList.remove('pivot-group-row', 'pivot-leaf-row', 'pivot-grand-total-row');
      rowEl.classList.add('data-grid-row');

      // Remove pivot-specific attributes
      rowEl.removeAttribute('data-pivot-depth');

      // Clear the row content so the default renderer can rebuild it
      rowEl.innerHTML = '';
    }
  }

  /** @internal */
  override onKeyDown(event: KeyboardEvent): boolean | void {
    // SPACE toggles expansion on pivot group rows
    if (event.key !== ' ') return;
    if (!this.isActive) return;

    const focusRow = this.grid._focusRow;
    const row = this.rows[focusRow] as Record<string, unknown> | undefined;

    // Only handle SPACE on pivot group rows with children
    if (!row?.__pivotIsGroup || !row.__pivotHasChildren) return;

    event.preventDefault();
    this.toggle(row.__pivotRowKey as string);

    // Restore focus styling after render completes via render pipeline
    this.requestRenderWithFocus();
    return true;
  }

  /** @internal */
  override handleQuery(query: PluginQuery): unknown {
    if (query.type === 'sort:get-sort-config') {
      // When MultiSort is driving sort state, return its translated config
      const multiConfigs = this.getMultiSortConfigs();
      if (multiConfigs) return multiConfigs;
      return this.config.sortRows ?? null;
    }
    return undefined;
  }

  /** @internal */
  override onHeaderClick(event: HeaderClickEvent): boolean {
    if (!this.isActive) return false;

    const field = event.field;

    // Only handle clicks on pivot-generated columns
    if (!this.isPivotField(field)) return false;

    // When MultiSort is present, let it handle the click (supports shift-click
    // for multi-column sort). PivotPlugin reads MultiSort's sort model in processRows.
    if (this.isMultiSortActive()) return false;

    // Map the clicked column to a PivotSortConfig
    const sortConfig = this.mapFieldToSortConfig(field);
    if (!sortConfig) return false;

    // Toggle direction: none → asc → desc → none
    const currentDir = this.activeSortDir;
    const currentField = this.activeSortField;
    let newDir: PivotSortDir | null;

    if (currentField !== field) {
      // Different column — start ascending
      newDir = 'asc';
    } else if (currentDir === 'asc') {
      newDir = 'desc';
    } else {
      newDir = null; // Clear sort
    }

    this.activeSortField = newDir ? field : null;
    this.activeSortDir = newDir;

    // Apply to pivot config
    if (newDir) {
      this.config.sortRows = { ...sortConfig, direction: newDir };
    } else {
      this.config.sortRows = undefined;
    }

    this.emit<PivotConfigChangeDetail>('pivot-config-change', {
      property: 'sortRows',
    });

    this.refresh();

    // Announce for screen readers
    const gridEl = this.gridElement;
    if (gridEl) {
      const colHeader = event.column.header ?? field;
      if (newDir) {
        announce(
          gridEl,
          getA11yMessage(gridEl, 'sortApplied', colHeader, newDir === 'asc' ? 'ascending' : 'descending'),
        );
      } else {
        announce(gridEl, getA11yMessage(gridEl, 'sortCleared'));
      }
    }

    return true;
  }

  /** Check if a field belongs to a pivot-generated column. */
  private isPivotField(field: string): boolean {
    return field === '__pivotLabel' || field === '__pivotTotal' || field.includes('|');
  }

  /** Check whether the MultiSort plugin is loaded alongside Pivot. */
  private isMultiSortActive(): boolean {
    const results = this.grid?.query?.('sort:get-model', null);
    return Array.isArray(results) && results.length > 0;
  }

  /**
   * Read MultiSort's sort model and translate entries to PivotSortConfig[].
   * Returns null when MultiSort is not present or has no active sorts.
   */
  private getMultiSortConfigs(): PivotSortConfig[] | null {
    const results = this.grid?.query?.('sort:get-model', null);
    if (!results || results.length === 0) return null;

    const sortModel = results[0] as Array<{ field: string; direction: 'asc' | 'desc' }>;
    if (!Array.isArray(sortModel) || sortModel.length === 0) return null;

    const configs: PivotSortConfig[] = [];
    for (const entry of sortModel) {
      if (!this.isPivotField(entry.field)) continue;
      const base = this.mapFieldToSortConfig(entry.field);
      if (base) {
        configs.push({ ...base, direction: entry.direction });
      }
    }
    return configs.length > 0 ? configs : null;
  }

  /** Map a pivot column field to the appropriate PivotSortConfig (without direction). */
  private mapFieldToSortConfig(field: string): Omit<PivotSortConfig, 'direction'> | null {
    if (field === '__pivotLabel') {
      return { by: 'label' };
    }
    if (field === '__pivotTotal') {
      return { by: 'value' };
    }
    // Value columns use format: colKey|valueField (from createValueKey).
    // Preserve the full value key so sorting targets the exact pivot column
    // the user clicked, rather than collapsing distinct columns like
    // "Q1|sales" and "Q2|sales" into the same "sales" config.
    if (field.includes('|')) {
      return { by: 'value', valueField: field };
    }
    return null;
  }

  /** @internal */
  override afterRender(): void {
    // Render grand total as a sticky pinned footer when pivot is active
    // Skip when grandTotalInRowModel is true (grand total is already in the row model)
    if (this.isActive && this.config.showGrandTotal && this.pivotResult && !this.config.grandTotalInRowModel) {
      this.renderGrandTotalFooter();
    } else {
      this.cleanupGrandTotalFooter();
    }

    // Update sort indicators on pivot header cells.
    // When MultiSort is active it manages all indicators (including unsorted state).
    if (this.isActive && !this.isMultiSortActive()) {
      this.updateSortIndicators();
    }

    // Apply animations to newly visible rows
    const style = this.animationStyle;
    if (style === false || this.keysToAnimate.size === 0) return;

    const body = this.gridElement?.querySelector('.rows');
    if (!body) return;

    const animClass = style === 'fade' ? 'tbw-pivot-fade-in' : 'tbw-pivot-slide-in';
    for (const rowEl of body.querySelectorAll('.pivot-group-row, .pivot-leaf-row')) {
      const key = (rowEl as HTMLElement).dataset.pivotKey;
      if (key && this.keysToAnimate.has(key)) {
        rowEl.classList.add(animClass);
        rowEl.addEventListener('animationend', () => rowEl.classList.remove(animClass), { once: true });
      }
    }
    this.keysToAnimate.clear();
  }

  /**
   * Update sort indicator icons on pivot header cells.
   * Core's indicator rendering reads `_sortState`, which doesn't reflect pivot sort.
   * We manage indicators directly, following the same pattern as MultiSortPlugin.
   */
  private updateSortIndicators(): void {
    const gridEl = this.gridElement;
    if (!gridEl) return;

    // Derive effective sort state: interactive state takes priority,
    // then fall back to programmatic config.sortRows.
    const effectiveField = this.activeSortField;
    const effectiveDir = this.activeSortDir;
    const programmatic = !effectiveField ? this.config.sortRows : null;

    const headerCells = gridEl.querySelectorAll('.header-row .cell[data-field]');
    for (const cell of headerCells) {
      const field = cell.getAttribute('data-field');
      if (!field || !this.isPivotField(field)) continue;

      let sortDir: 'asc' | 'desc' | null = null;

      if (effectiveField === field) {
        // Interactive sort is active on this column
        sortDir = effectiveDir;
      } else if (programmatic) {
        // Programmatic sortRows — match by sort type
        if (programmatic.by === 'label' && field === '__pivotLabel') {
          sortDir = programmatic.direction ?? 'asc';
        } else if (programmatic.by === 'value' && field === '__pivotTotal' && !programmatic.valueField) {
          sortDir = programmatic.direction ?? 'asc';
        } else if (programmatic.by === 'value' && programmatic.valueField && field === programmatic.valueField) {
          sortDir = programmatic.direction ?? 'asc';
        }
      }

      this.updateSortIndicator(cell, sortDir);
    }
  }

  /**
   * Render the grand total row as a sticky footer pinned to the bottom.
   */
  private renderGrandTotalFooter(): void {
    if (!this.pivotResult) return;

    const gridEl = this.gridElement;
    if (!gridEl) return;

    // Find the scroll container to append the footer
    const container =
      gridEl.querySelector('.tbw-scroll-area') ??
      gridEl.querySelector('.tbw-grid-content') ??
      gridEl.querySelector('.tbw-grid-root');
    if (!container) return;

    // Create footer if it doesn't exist
    if (!this.grandTotalFooter) {
      this.grandTotalFooter = document.createElement('div');
      this.grandTotalFooter.className = 'pivot-grand-total-footer';
      container.appendChild(this.grandTotalFooter);
    }

    // Build the row data for grand total
    const grandTotalRow: PivotRowData = {
      __pivotRowKey: '__grandTotal',
      __pivotLabel: 'Grand Total',
      __pivotIsGrandTotal: true,
      __pivotTotal: this.pivotResult.grandTotal,
      ...this.pivotResult.totals,
    };

    // Render the grand total row into the footer
    renderPivotGrandTotalRow(grandTotalRow, this.grandTotalFooter, this.gridColumns);
    // Footer is outside the grid's role=grid element — use presentation role
    this.grandTotalFooter.setAttribute('role', 'presentation');
  }

  /**
   * Remove the grand total footer element.
   */
  private cleanupGrandTotalFooter(): void {
    if (this.grandTotalFooter) {
      this.grandTotalFooter.remove();
      this.grandTotalFooter = null;
    }
  }

  // #endregion

  // #region Expand/Collapse API

  toggle(key: string): void {
    this.userHasToggledExpand = true;
    const wasExpanded = this.expandedKeys.has(key);
    if (wasExpanded) {
      this.expandedKeys.delete(key);
    } else {
      this.expandedKeys.add(key);
    }
    this.emitToggle(key, !wasExpanded);
    this.requestRender();
  }

  /**
   * Expand a specific pivot group row, revealing its children.
   *
   * @param key - The pivot row key (hierarchical path, e.g. `'Engineering'` or `'Engineering||Frontend'`)
   */
  expand(key: string): void {
    this.userHasToggledExpand = true;
    this.expandedKeys.add(key);
    this.emitToggle(key, true);
    this.requestRender();
  }

  /**
   * Collapse a specific pivot group row, hiding its children.
   *
   * @param key - The pivot row key to collapse
   */
  collapse(key: string): void {
    this.userHasToggledExpand = true;
    this.expandedKeys.delete(key);
    this.emitToggle(key, false);
    this.requestRender();
  }

  /**
   * Expand all pivot group rows, revealing the full hierarchy.
   */
  expandAll(): void {
    this.userHasToggledExpand = true;
    this.expandAllKeys();
    this.requestRender();
  }

  /**
   * Collapse all pivot group rows, showing only top-level groups.
   */
  collapseAll(): void {
    this.userHasToggledExpand = true;
    this.expandedKeys.clear();
    this.requestRender();
  }

  /**
   * Add all group keys from the current pivot result to expandedKeys.
   */
  private expandAllKeys(): void {
    if (!this.pivotResult) return;
    const allKeys = getAllGroupKeys(this.pivotResult.rows);
    for (const key of allKeys) {
      this.expandedKeys.add(key);
    }
  }

  /**
   * Check whether a specific pivot group row is currently expanded.
   *
   * @param key - The pivot row key to check
   * @returns `true` if the group is expanded
   */
  isExpanded(key: string): boolean {
    return this.expandedKeys.has(key);
  }

  /**
   * Get all currently expanded group keys.
   *
   * @returns Array of expanded pivot row keys
   */
  getExpandedGroups(): string[] {
    return [...this.expandedKeys];
  }

  // #endregion

  // #region Public API

  /**
   * Enable pivot mode.
   *
   * Captures the original column set (if not already captured) and activates
   * the pivot transformation. The grid will re-render with pivot columns and rows.
   *
   * @example
   * ```ts
   * const pivot = grid.getPluginByName('pivot');
   * pivot.enablePivot();
   * ```
   */
  enablePivot(): void {
    if (this.originalColumns.length === 0) {
      this.captureOriginalColumns();
    }
    this.isActive = true;
    this.emit<PivotStateChangeDetail>('pivot-state-change', { active: true });
    this.requestRender();
  }

  /**
   * Disable pivot mode and restore the original grid columns.
   *
   * The grid reverts to its normal tabular layout with the original column definitions.
   */
  disablePivot(): void {
    this.isActive = false;
    this.pivotResult = null;
    this.emit<PivotStateChangeDetail>('pivot-state-change', { active: false });
    this.requestRender();
  }

  /**
   * Check whether pivot mode is currently active.
   *
   * @returns `true` if the grid is in pivot mode
   */
  isPivotActive(): boolean {
    return this.isActive;
  }

  /**
   * Get the current pivot computation result.
   *
   * Returns the full {@link PivotResult} with rows, column keys, totals,
   * and grand total. Returns `null` if pivot is inactive or not yet computed.
   *
   * @returns The computed pivot result, or `null`
   */
  getPivotResult(): PivotResult | null {
    return this.pivotResult;
  }

  /**
   * Set the fields used for row grouping (vertical axis).
   *
   * Triggers a re-render with the new pivot structure.
   *
   * @param fields - Array of field names to group rows by
   *
   * @example
   * ```ts
   * const pivot = grid.getPluginByName('pivot');
   * pivot.setRowGroupFields(['region', 'department']);
   * ```
   */
  setRowGroupFields(fields: string[]): void {
    this.config.rowGroupFields = fields;
    this.emitConfigChange('rowGroupFields');
    this.refresh();
  }

  /**
   * Set the fields whose unique values become column headers (horizontal axis).
   *
   * Triggers a re-render with the new pivot column structure.
   *
   * @param fields - Array of field names for column grouping
   *
   * @example
   * ```ts
   * const pivot = grid.getPluginByName('pivot');
   * pivot.setColumnGroupFields(['quarter']);
   * ```
   */
  setColumnGroupFields(fields: string[]): void {
    this.config.columnGroupFields = fields;
    this.emitConfigChange('columnGroupFields');
    this.refresh();
  }

  /**
   * Set the value fields and their aggregation functions.
   *
   * Each value field defines which data field to aggregate and how.
   * Triggers a re-render with the new aggregation.
   *
   * @param fields - Array of {@link PivotValueField} definitions
   *
   * @example
   * ```ts
   * const pivot = grid.getPluginByName('pivot');
   * pivot.setValueFields([
   *   { field: 'revenue', aggFunc: 'sum', header: 'Total Revenue' },
   *   { field: 'orders', aggFunc: 'count', header: '# Orders' },
   * ]);
   * ```
   */
  setValueFields(fields: PivotValueField[]): void {
    this.config.valueFields = fields;
    this.emitConfigChange('valueFields');
    this.refresh();
  }

  /**
   * Force re-computation of the pivot result.
   *
   * Clears the cached pivot result and triggers a full re-render.
   * Call this after changing the underlying row data.
   */
  refresh(): void {
    this.pivotResult = null;
    this.requestRender();
  }

  // #endregion

  // #region Tool Panel API

  /**
   * Show the pivot tool panel.
   * Opens the tool panel and ensures this section is expanded.
   */
  showPanel(): void {
    this.grid.openToolPanel();
    // Ensure our section is expanded
    if (!this.grid.expandedToolPanelSections.includes(PivotPlugin.PANEL_ID)) {
      this.grid.toggleToolPanelSection(PivotPlugin.PANEL_ID);
    }
  }

  /**
   * Hide the tool panel.
   */
  hidePanel(): void {
    this.grid.closeToolPanel();
  }

  /**
   * Toggle the pivot tool panel section.
   */
  togglePanel(): void {
    // If tool panel is closed, open it first
    if (!this.grid.isToolPanelOpen) {
      this.grid.openToolPanel();
    }
    this.grid.toggleToolPanelSection(PivotPlugin.PANEL_ID);
  }

  /**
   * Check if the pivot panel section is currently expanded.
   */
  isPanelVisible(): boolean {
    return this.grid.isToolPanelOpen && this.grid.expandedToolPanelSections.includes(PivotPlugin.PANEL_ID);
  }

  // #endregion

  // #region Private Helpers

  private get gridColumns(): ColumnConfig[] {
    return (this.grid.columns ?? []) as ColumnConfig[];
  }

  /**
   * Refresh pivot and update tool panel if active.
   */
  private refreshIfActive(): void {
    if (this.isActive) this.refresh();
    this.refreshPanel();
  }

  private buildFieldHeaderMap(): void {
    const availableFields = this.getAvailableFields();
    this.fieldHeaderMap.clear();
    for (const field of availableFields) {
      this.fieldHeaderMap.set(field.field, field.header);
    }
  }

  private getAvailableFields(): FieldInfo[] {
    if (this.originalColumns.length > 0) {
      return this.originalColumns;
    }
    return this.captureOriginalColumns();
  }

  private captureOriginalColumns(): FieldInfo[] {
    try {
      const columns = this.grid.getAllColumns?.() ?? this.grid.columns ?? [];
      this.originalColumns = columns
        .filter((col: { field: string }) => !col.field.startsWith('__pivot'))
        .map((col: { field: string; header?: string }) => ({
          field: col.field,
          header: col.header ?? col.field,
        }));
      return this.originalColumns;
    } catch {
      return [];
    }
  }

  private renderPanel(container: HTMLElement): (() => void) | void {
    this.panelContainer = container;

    if (this.originalColumns.length === 0) {
      this.captureOriginalColumns();
    }

    const callbacks: PanelCallbacks = {
      onTogglePivot: (enabled) => {
        if (enabled) {
          this.enablePivot();
        } else {
          this.disablePivot();
        }
        this.refreshPanel();
      },
      onAddFieldToZone: (field, zone) => {
        this.addFieldToZone(field, zone);
        this.emitConfigChange(zone === 'rowGroups' ? 'rowGroupFields' : 'columnGroupFields', field, zone);
      },
      onRemoveFieldFromZone: (field, zone) => {
        this.removeFieldFromZone(field, zone);
        this.emitConfigChange(zone === 'rowGroups' ? 'rowGroupFields' : 'columnGroupFields', field, zone);
      },
      onReorderFieldInZone: (field, zone, newIndex) => {
        this.reorderFieldInZone(field, zone, newIndex);
        this.emitConfigChange(zone === 'rowGroups' ? 'rowGroupFields' : 'columnGroupFields', field, zone);
      },
      onMoveFieldBetweenZones: (field, fromZone, toZone) => {
        this.moveFieldBetweenZones(field, fromZone, toZone);
        this.emitConfigChange(toZone === 'rowGroups' ? 'rowGroupFields' : 'columnGroupFields', field, toZone);
      },
      onAddValueField: (field, aggFunc) => {
        this.addValueField(field, aggFunc);
        this.emitConfigChange('valueFields', field, 'values');
      },
      onRemoveValueField: (field) => {
        this.removeValueField(field);
        this.emitConfigChange('valueFields', field, 'values');
      },
      onUpdateValueAggFunc: (field, aggFunc) => {
        this.updateValueAggFunc(field, aggFunc);
        this.emitConfigChange('valueFields', field, 'values');
      },
      onOptionChange: (option, value) => {
        this.config[option] = value;
        this.emitConfigChange(option);
        if (this.isActive) this.refresh();
      },
      getAvailableFields: () => this.getAvailableFields(),
    };

    return renderPivotPanel(container, this.config, this.isActive, callbacks);
  }

  private refreshPanel(): void {
    if (!this.panelContainer) return;
    this.panelContainer.innerHTML = '';
    this.renderPanel(this.panelContainer);
  }

  private addFieldToZone(field: string, zoneType: 'rowGroups' | 'columnGroups'): void {
    if (zoneType === 'rowGroups') {
      const current = this.config.rowGroupFields ?? [];
      if (!current.includes(field)) {
        this.config.rowGroupFields = [...current, field];
      }
    } else {
      const current = this.config.columnGroupFields ?? [];
      if (!current.includes(field)) {
        this.config.columnGroupFields = [...current, field];
      }
    }

    this.removeFromOtherZones(field, zoneType);
    this.refreshIfActive();
  }

  private removeFieldFromZone(field: string, zoneType: 'rowGroups' | 'columnGroups'): void {
    if (zoneType === 'rowGroups') {
      this.config.rowGroupFields = (this.config.rowGroupFields ?? []).filter((f) => f !== field);
    } else {
      this.config.columnGroupFields = (this.config.columnGroupFields ?? []).filter((f) => f !== field);
    }

    this.refreshIfActive();
  }

  private reorderFieldInZone(field: string, zoneType: 'rowGroups' | 'columnGroups', newIndex: number): void {
    const fields =
      zoneType === 'rowGroups' ? [...(this.config.rowGroupFields ?? [])] : [...(this.config.columnGroupFields ?? [])];
    const oldIndex = fields.indexOf(field);
    if (oldIndex === -1 || oldIndex === newIndex) return;
    fields.splice(oldIndex, 1);
    fields.splice(newIndex > oldIndex ? newIndex - 1 : newIndex, 0, field);
    if (zoneType === 'rowGroups') {
      this.config.rowGroupFields = fields;
    } else {
      this.config.columnGroupFields = fields;
    }
    this.refreshIfActive();
  }

  private moveFieldBetweenZones(
    field: string,
    fromZone: 'rowGroups' | 'columnGroups',
    toZone: 'rowGroups' | 'columnGroups',
  ): void {
    // Remove from source
    if (fromZone === 'rowGroups') {
      this.config.rowGroupFields = (this.config.rowGroupFields ?? []).filter((f) => f !== field);
    } else {
      this.config.columnGroupFields = (this.config.columnGroupFields ?? []).filter((f) => f !== field);
    }
    // Add to target
    if (toZone === 'rowGroups') {
      this.config.rowGroupFields = [...(this.config.rowGroupFields ?? []), field];
    } else {
      this.config.columnGroupFields = [...(this.config.columnGroupFields ?? []), field];
    }
    this.refreshIfActive();
  }

  private removeFromOtherZones(field: string, targetZone: 'rowGroups' | 'columnGroups' | 'values'): void {
    if (targetZone !== 'rowGroups') {
      this.config.rowGroupFields = (this.config.rowGroupFields ?? []).filter((f) => f !== field);
    }
    if (targetZone !== 'columnGroups') {
      this.config.columnGroupFields = (this.config.columnGroupFields ?? []).filter((f) => f !== field);
    }
    if (targetZone !== 'values') {
      this.config.valueFields = (this.config.valueFields ?? []).filter((v) => v.field !== field);
    }
  }

  private addValueField(field: string, aggFunc: AggFunc): void {
    const current = this.config.valueFields ?? [];
    if (!current.some((v) => v.field === field)) {
      this.config.valueFields = [...current, { field, aggFunc }];
    }

    this.removeFromOtherZones(field, 'values');
    this.refreshIfActive();
  }

  private removeValueField(field: string): void {
    this.config.valueFields = (this.config.valueFields ?? []).filter((v) => v.field !== field);
    this.refreshIfActive();
  }

  private updateValueAggFunc(field: string, aggFunc: AggFunc): void {
    const valueFields = this.config.valueFields ?? [];
    const fieldIndex = valueFields.findIndex((v) => v.field === field);
    if (fieldIndex >= 0) {
      valueFields[fieldIndex] = { ...valueFields[fieldIndex], aggFunc };
      this.config.valueFields = [...valueFields];
    }
    if (this.isActive) this.refresh();
  }

  // #region Event Helpers

  private emitToggle(key: string, expanded: boolean): void {
    const flatRow = this.rows.find((r) => (r as PivotDataRow).__pivotRowKey === key) as PivotDataRow | undefined;
    this.emit<PivotToggleDetail>('pivot-toggle', {
      key,
      expanded,
      label: (flatRow?.__pivotLabel as string) ?? key,
      depth: (flatRow?.__pivotDepth as number) ?? 0,
    });
  }

  private emitConfigChange(property: string, field?: string, zone?: 'rowGroups' | 'columnGroups' | 'values'): void {
    this.emit<PivotConfigChangeDetail>('pivot-config-change', { property, field, zone });
  }

  // #endregion

  // #region Value Formatting

  /**
   * Build value formatters from PivotValueField.format or original column format.
   */
  private buildValueFormatters(): void {
    this.valueFormatters.clear();
    const valueFields = this.config.valueFields ?? [];
    for (const vf of valueFields) {
      if (vf.format) {
        this.valueFormatters.set(vf.field, vf.format);
      } else {
        // Check if the original column had a format function
        const origCol = this.originalColumns.find((c) => c.field === vf.field);
        if (origCol) {
          const allCols = this.grid.getAllColumns?.() ?? this.grid.columns ?? [];
          const col = allCols.find((c: { field: string }) => c.field === vf.field) as
            | { field: string; format?: (value: unknown, row: unknown) => string }
            | undefined;
          if (col?.format) {
            const fmt = col.format;
            this.valueFormatters.set(vf.field, (v: number) => fmt(v, {}));
          }
        }
      }
    }
  }

  // #endregion
}
