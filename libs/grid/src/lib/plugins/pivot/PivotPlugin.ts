/**
 * Pivot Plugin (Class-based)
 *
 * Provides pivot table functionality for tbw-grid.
 * Transforms flat data into grouped, aggregated pivot views.
 */

import { BaseGridPlugin } from '../../core/plugin/base-plugin';
import type { ColumnConfig } from '../../core/types';
import { buildPivot, flattenPivotRows, type PivotDataRow } from './pivot-engine';
import { createValueKey, validatePivotConfig } from './pivot-model';
import type { PivotConfig, PivotResult, PivotValueField } from './types';

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
  override readonly version = '1.0.0';

  protected override get defaultConfig(): Partial<PivotConfig> {
    return {
      enabled: true,
      showTotals: true,
      showGrandTotal: true,
    };
  }

  // ===== Internal State =====
  private isActive = false;
  private pivotResult: PivotResult | null = null;
  private columnHeaders: string[] = [];
  private rowHeaders: string[] = [];

  // ===== Lifecycle =====

  override detach(): void {
    this.isActive = false;
    this.pivotResult = null;
    this.columnHeaders = [];
    this.rowHeaders = [];
  }

  // ===== Hooks =====

  override processRows(rows: readonly unknown[]): PivotDataRow[] {
    if (!this.config.enabled || !this.isActive) {
      return [...rows] as PivotDataRow[];
    }

    const errors = validatePivotConfig(this.config);
    if (errors.length > 0) {
      this.warn(`Config errors: ${errors.join(', ')}`);
      return [...rows] as PivotDataRow[];
    }

    // Build pivot
    this.pivotResult = buildPivot(rows as PivotDataRow[], this.config);

    // Return flattened pivot rows for rendering
    return flattenPivotRows(this.pivotResult.rows).map((pr) => ({
      __pivotRowKey: pr.rowKey,
      __pivotLabel: pr.rowLabel,
      __pivotDepth: pr.depth,
      __pivotIsGroup: pr.isGroup,
      __pivotTotal: pr.total,
      ...pr.values,
    }));
  }

  override processColumns(columns: readonly ColumnConfig[]): ColumnConfig[] {
    if (!this.config.enabled || !this.isActive || !this.pivotResult) {
      return [...columns];
    }

    const pivotColumns: ColumnConfig[] = [];

    // Row label column
    pivotColumns.push({
      field: '__pivotLabel',
      header: this.config.rowGroupFields?.join(' / ') ?? 'Group',
      width: 200,
    });

    // Value columns for each column key
    for (const colKey of this.pivotResult.columnKeys) {
      for (const vf of this.config.valueFields ?? []) {
        const valueKey = createValueKey([colKey], vf.field);
        pivotColumns.push({
          field: valueKey,
          header: `${colKey} - ${vf.header || vf.field} (${vf.aggFunc})`,
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

  // ===== Public API =====

  /**
   * Enable pivot mode.
   */
  enablePivot(): void {
    this.isActive = true;
    this.requestRender();
  }

  /**
   * Disable pivot mode and return to normal grid view.
   */
  disablePivot(): void {
    this.isActive = false;
    this.pivotResult = null;
    this.requestRender();
  }

  /**
   * Check if pivot mode is currently active.
   */
  isPivotActive(): boolean {
    return this.isActive;
  }

  /**
   * Get the current pivot result.
   */
  getPivotResult(): PivotResult | null {
    return this.pivotResult;
  }

  /**
   * Set the row group fields for pivoting.
   * @param fields - Array of field names to group rows by
   */
  setRowGroupFields(fields: string[]): void {
    this.config.rowGroupFields = fields;
    this.requestRender();
  }

  /**
   * Set the column group fields for pivoting.
   * @param fields - Array of field names to create columns from
   */
  setColumnGroupFields(fields: string[]): void {
    this.config.columnGroupFields = fields;
    this.requestRender();
  }

  /**
   * Set the value fields with aggregation functions.
   * @param fields - Array of value field configurations
   */
  setValueFields(fields: PivotValueField[]): void {
    this.config.valueFields = fields;
    this.requestRender();
  }

  /**
   * Refresh the pivot by clearing cached results.
   */
  refresh(): void {
    this.pivotResult = null;
    this.requestRender();
  }

  // ===== Styles =====

  override readonly styles = `
    [data-pivot-depth="1"] { padding-left: 20px; }
    [data-pivot-depth="2"] { padding-left: 40px; }
    [data-pivot-depth="3"] { padding-left: 60px; }
    .pivot-group-row { font-weight: bold; background: var(--tbw-pivot-group-bg, var(--tbw-color-panel-bg)); }
    .pivot-total-row { font-weight: bold; border-top: 2px solid var(--tbw-pivot-border, var(--tbw-color-border-strong)); }
  `;
}
