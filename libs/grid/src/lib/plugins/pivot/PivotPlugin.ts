/**
 * Pivot Plugin (Class-based)
 *
 * Provides pivot table functionality for tbw-grid.
 * Transforms flat data into grouped, aggregated pivot views.
 * Includes a tool panel for interactive pivot configuration.
 */

import { BaseGridPlugin } from '../../core/plugin/base-plugin';
import type { ColumnConfig, ToolPanelDefinition } from '../../core/types';
import { buildPivot, flattenPivotRows, getAllGroupKeys, type PivotDataRow } from './pivot-engine';
import { createValueKey, validatePivotConfig } from './pivot-model';
import { renderPivotPanel, type FieldInfo, type PanelCallbacks } from './pivot-panel';
import { renderPivotGrandTotalRow, renderPivotGroupRow, renderPivotLeafRow, type PivotRowData } from './pivot-rows';
import type { AggFunc, ExpandCollapseAnimation, PivotConfig, PivotResult, PivotValueField } from './types';

// Import CSS as inline string (Vite handles this)
import styles from './pivot.css?inline';

/**
 * Pivot Plugin for tbw-grid
 *
 * @example
 * ```ts
 * new PivotPlugin({
 *   rowGroupFields: ['category'],
 *   columnGroupFields: ['region'],
 *   valueFields: [{ field: 'sales', aggFunc: 'sum' }]
 * })
 * ```
 */
export class PivotPlugin extends BaseGridPlugin<PivotConfig> {
  readonly name = 'pivot';
  override readonly styles = styles;

  /** Tool panel ID for shell integration */
  static readonly PANEL_ID = 'pivot';

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
  private defaultExpanded = true;
  private originalColumns: Array<{ field: string; header: string }> = [];
  private panelContainer: HTMLElement | null = null;
  private grandTotalFooter: HTMLElement | null = null;
  private previousVisibleKeys = new Set<string>();
  private keysToAnimate = new Set<string>();

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
  }

  // #endregion

  // #region Shell Integration

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
    this.defaultExpanded = this.config.defaultExpanded ?? true;

    // Initialize expanded state with defaults if first build
    if (this.expandedKeys.size === 0 && this.defaultExpanded && this.pivotResult) {
      this.expandAllKeys();
    }

    // Build pivot
    this.pivotResult = buildPivot(rows as PivotDataRow[], this.config);

    // If default expanded and we just built the pivot, add all group keys
    if (this.expandedKeys.size === 0 && this.defaultExpanded) {
      this.expandAllKeys();
    }

    // Return flattened pivot rows respecting expanded state
    const indentWidth = this.config.indentWidth ?? 20;
    const flatRows: PivotDataRow[] = flattenPivotRows(
      this.pivotResult.rows,
      this.expandedKeys,
      this.defaultExpanded,
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

    // Grand total is rendered as a pinned footer row in afterRender,
    // not as part of the scrolling row data

    return flatRows;
  }

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
    });

    // Value columns for each column key
    for (const colKey of this.pivotResult.columnKeys) {
      for (const vf of this.config.valueFields ?? []) {
        const valueKey = createValueKey([colKey], vf.field);
        const valueHeader = vf.header || this.fieldHeaderMap.get(vf.field) || vf.field;
        pivotColumns.push({
          field: valueKey,
          header: `${colKey} - ${valueHeader} (${vf.aggFunc})`,
          width: 120,
          type: 'number',
        });
      }
    }

    // Totals column
    if (this.config.showTotals) {
      pivotColumns.push({
        field: '__pivotTotal',
        header: 'Total',
        width: 100,
        type: 'number',
      });
    }

    return pivotColumns;
  }

  override renderRow(row: Record<string, unknown>, rowEl: HTMLElement): boolean {
    const pivotRow = row as PivotRowData;

    // Handle pivot group row (has children)
    if (pivotRow.__pivotRowKey && pivotRow.__pivotHasChildren) {
      return renderPivotGroupRow(pivotRow, rowEl, {
        columns: this.gridColumns,
        onToggle: (key) => this.toggle(key),
        resolveIcon: (iconKey) => this.resolveIcon(iconKey),
        setIcon: (el, icon) => this.setIcon(el, icon),
      });
    }

    // Handle pivot leaf row (no children but in pivot mode)
    if (pivotRow.__pivotRowKey !== undefined && this.isActive) {
      return renderPivotLeafRow(pivotRow, rowEl, this.gridColumns);
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

  override afterRender(): void {
    // Render grand total as a sticky pinned footer when pivot is active
    if (this.isActive && this.config.showGrandTotal && this.pivotResult) {
      this.renderGrandTotalFooter();
    } else {
      this.cleanupGrandTotalFooter();
    }

    // Apply animations to newly visible rows
    const style = this.animationStyle;
    if (style === false || this.keysToAnimate.size === 0) return;

    const body = this.shadowRoot?.querySelector('.rows');
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
   * Render the grand total row as a sticky footer pinned to the bottom.
   */
  private renderGrandTotalFooter(): void {
    if (!this.pivotResult) return;

    const shadowRoot = this.shadowRoot;
    if (!shadowRoot) return;

    // Find the scroll container to append the footer
    const container =
      shadowRoot.querySelector('.tbw-scroll-area') ??
      shadowRoot.querySelector('.tbw-grid-content') ??
      shadowRoot.children[0];
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
    if (this.expandedKeys.has(key)) {
      this.expandedKeys.delete(key);
    } else {
      this.expandedKeys.add(key);
    }
    this.requestRender();
  }

  expand(key: string): void {
    this.expandedKeys.add(key);
    this.requestRender();
  }

  collapse(key: string): void {
    this.expandedKeys.delete(key);
    this.requestRender();
  }

  expandAll(): void {
    this.expandAllKeys();
    this.requestRender();
  }

  collapseAll(): void {
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

  isExpanded(key: string): boolean {
    return this.expandedKeys.has(key);
  }

  // #endregion

  // #region Public API

  enablePivot(): void {
    if (this.originalColumns.length === 0) {
      this.captureOriginalColumns();
    }
    this.isActive = true;
    this.requestRender();
  }

  disablePivot(): void {
    this.isActive = false;
    this.pivotResult = null;
    this.requestRender();
  }

  isPivotActive(): boolean {
    return this.isActive;
  }

  getPivotResult(): PivotResult | null {
    return this.pivotResult;
  }

  setRowGroupFields(fields: string[]): void {
    this.config.rowGroupFields = fields;
    this.requestRender();
  }

  setColumnGroupFields(fields: string[]): void {
    this.config.columnGroupFields = fields;
    this.requestRender();
  }

  setValueFields(fields: PivotValueField[]): void {
    this.config.valueFields = fields;
    this.requestRender();
  }

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
      onAddFieldToZone: (field, zone) => this.addFieldToZone(field, zone),
      onRemoveFieldFromZone: (field, zone) => this.removeFieldFromZone(field, zone),
      onAddValueField: (field, aggFunc) => this.addValueField(field, aggFunc),
      onRemoveValueField: (field) => this.removeValueField(field),
      onUpdateValueAggFunc: (field, aggFunc) => this.updateValueAggFunc(field, aggFunc),
      onOptionChange: (option, value) => {
        this.config[option] = value;
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

  // #endregion
}
