/**
 * Status Bar Rendering Logic
 *
 * Pure functions for creating and updating the status bar UI.
 * Includes both info bar and aggregation row rendering.
 */

import { getAggregator } from '../../core/internal/aggregators';
import type { ColumnConfig } from '../../core/types';
import type {
  AggregationRowConfig,
  AggregatorConfig,
  AggregatorDefinition,
  PinnedRowsConfig,
  PinnedRowsContext,
  PinnedRowsPanel,
} from './types';

/**
 * Check if an aggregator definition is a full config object (with aggFunc and optional formatter).
 */
function isAggregatorConfig(def: AggregatorDefinition): def is AggregatorConfig {
  return typeof def === 'object' && def !== null && 'aggFunc' in def;
}

/**
 * Creates the info bar DOM element with all configured panels.
 *
 * @param config - The status bar configuration
 * @param context - The current grid context for rendering
 * @returns The complete info bar element
 */
export function createInfoBarElement(config: PinnedRowsConfig, context: PinnedRowsContext): HTMLElement {
  const pinnedRows = document.createElement('div');
  pinnedRows.className = 'tbw-pinned-rows';
  pinnedRows.setAttribute('role', 'presentation');
  pinnedRows.setAttribute('aria-live', 'polite');

  const left = document.createElement('div');
  left.className = 'tbw-pinned-rows-left';

  const center = document.createElement('div');
  center.className = 'tbw-pinned-rows-center';

  const right = document.createElement('div');
  right.className = 'tbw-pinned-rows-right';

  // Default panels - row count
  if (config.showRowCount !== false) {
    const rowCount = document.createElement('span');
    rowCount.className = 'tbw-status-panel tbw-status-panel-row-count';
    rowCount.textContent = `Total: ${context.totalRows} rows`;
    left.appendChild(rowCount);
  }

  // Filtered count panel (only shows when filter is active)
  if (config.showFilteredCount && context.filteredRows !== context.totalRows) {
    const filteredCount = document.createElement('span');
    filteredCount.className = 'tbw-status-panel tbw-status-panel-filtered-count';
    filteredCount.textContent = `Filtered: ${context.filteredRows}`;
    left.appendChild(filteredCount);
  }

  // Selected count panel (only shows when rows are selected)
  if (config.showSelectedCount && context.selectedRows > 0) {
    const selectedCount = document.createElement('span');
    selectedCount.className = 'tbw-status-panel tbw-status-panel-selected-count';
    selectedCount.textContent = `Selected: ${context.selectedRows}`;
    right.appendChild(selectedCount);
  }

  // Render custom panels
  if (config.customPanels) {
    for (const panel of config.customPanels) {
      const panelEl = renderCustomPanel(panel, context);
      switch (panel.position) {
        case 'left':
          left.appendChild(panelEl);
          break;
        case 'center':
          center.appendChild(panelEl);
          break;
        case 'right':
          right.appendChild(panelEl);
          break;
      }
    }
  }

  pinnedRows.appendChild(left);
  pinnedRows.appendChild(center);
  pinnedRows.appendChild(right);

  return pinnedRows;
}

/**
 * Creates a container for aggregation rows at top or bottom.
 *
 * @param position - 'top' or 'bottom'
 * @returns The container element
 */
export function createAggregationContainer(position: 'top' | 'bottom'): HTMLElement {
  const container = document.createElement('div');
  container.className = `tbw-aggregation-rows tbw-aggregation-rows-${position}`;
  // Use presentation role since aggregation rows are outside the role="grid" element for layout reasons
  container.setAttribute('role', 'presentation');
  return container;
}

/**
 * Renders aggregation rows into a container.
 *
 * @param container - The container to render into
 * @param rows - Aggregation row configurations
 * @param columns - Current column configuration
 * @param dataRows - Current row data for aggregation calculations
 * @param globalFullWidth - Global fullWidth default from PinnedRowsConfig (default: false)
 */
export function renderAggregationRows(
  container: HTMLElement,
  rows: AggregationRowConfig[],
  columns: ColumnConfig[],
  dataRows: unknown[],
  globalFullWidth = false,
): void {
  container.innerHTML = '';

  for (const rowConfig of rows) {
    const rowEl = document.createElement('div');
    rowEl.className = 'tbw-aggregation-row';
    // Use presentation role since aggregation rows are outside the role="grid" element
    rowEl.setAttribute('role', 'presentation');
    if (rowConfig.id) {
      rowEl.setAttribute('data-aggregation-id', rowConfig.id);
    }

    // Per-row fullWidth overrides global default
    const isFullWidth = rowConfig.fullWidth ?? globalFullWidth;

    if (isFullWidth) {
      renderFullWidthAggregationRow(rowEl, rowConfig, columns, dataRows);
    } else {
      renderPerColumnAggregationRow(rowEl, rowConfig, columns, dataRows);
    }

    container.appendChild(rowEl);
  }
}

/**
 * Renders a full-width aggregation row: single spanning cell with label and inline aggregated values.
 */
function renderFullWidthAggregationRow(
  rowEl: HTMLElement,
  rowConfig: AggregationRowConfig,
  columns: ColumnConfig[],
  dataRows: unknown[],
): void {
  const cell = document.createElement('div');
  cell.className = 'tbw-aggregation-cell tbw-aggregation-cell-full';
  cell.style.gridColumn = '1 / -1';

  // Label (static string or dynamic function)
  const labelValue = typeof rowConfig.label === 'function' ? rowConfig.label(dataRows, columns) : rowConfig.label;
  if (labelValue) {
    const labelSpan = document.createElement('span');
    labelSpan.className = 'tbw-aggregation-label';
    labelSpan.textContent = labelValue;
    cell.appendChild(labelSpan);
  }

  // Inline aggregated values
  const aggregatesContainer = renderInlineAggregates(rowConfig, columns, dataRows);
  if (aggregatesContainer) {
    cell.appendChild(aggregatesContainer);
  }

  // If nothing was added (no label, no aggregates), ensure cell is empty but present
  rowEl.appendChild(cell);
}

/**
 * Renders per-column aggregation cells aligned to the grid template.
 */
function renderPerColumnAggregationRow(
  rowEl: HTMLElement,
  rowConfig: AggregationRowConfig,
  columns: ColumnConfig[],
  dataRows: unknown[],
): void {
  for (const col of columns) {
    const cell = document.createElement('div');
    cell.className = 'tbw-aggregation-cell';
    cell.setAttribute('data-field', col.field);

    const { value, formatter } = resolveAggregatedValue(rowConfig, col, dataRows);

    if (value != null) {
      cell.textContent = formatter ? formatter(value, col.field, col) : String(value);
    } else {
      cell.textContent = '';
    }
    rowEl.appendChild(cell);
  }
}

/**
 * Resolves the aggregated value for a single column in an aggregation row.
 * Returns the computed value and an optional formatter function.
 */
function resolveAggregatedValue(
  rowConfig: AggregationRowConfig,
  col: ColumnConfig,
  dataRows: unknown[],
): { value: unknown; formatter?: (value: unknown, field: string, column?: ColumnConfig) => string } {
  let value: unknown;
  let formatter: ((value: unknown, field: string, column?: ColumnConfig) => string) | undefined;

  // Check for aggregator first
  const aggDef = rowConfig.aggregators?.[col.field];
  if (aggDef) {
    if (isAggregatorConfig(aggDef)) {
      const aggFn = getAggregator(aggDef.aggFunc);
      if (aggFn) {
        value = aggFn(dataRows, col.field, col);
      }
      formatter = aggDef.formatter;
    } else {
      const aggFn = getAggregator(aggDef);
      if (aggFn) {
        value = aggFn(dataRows, col.field, col);
      }
    }
  } else if (rowConfig.cells && Object.prototype.hasOwnProperty.call(rowConfig.cells, col.field)) {
    const staticVal = rowConfig.cells[col.field];
    if (typeof staticVal === 'function') {
      value = staticVal(dataRows, col.field, col);
    } else {
      value = staticVal;
    }
  }

  return { value, formatter };
}

/**
 * Renders inline aggregate values for a full-width aggregation row.
 * Returns a container element with aggregate spans, or null if no aggregates are defined.
 */
function renderInlineAggregates(
  rowConfig: AggregationRowConfig,
  columns: ColumnConfig[],
  dataRows: unknown[],
): HTMLElement | null {
  // Collect fields that have aggregators or cell values
  const hasAggregators = rowConfig.aggregators && Object.keys(rowConfig.aggregators).length > 0;
  const hasCells = rowConfig.cells && Object.keys(rowConfig.cells).length > 0;
  if (!hasAggregators && !hasCells) return null;

  const container = document.createElement('span');
  container.className = 'tbw-aggregation-aggregates';

  for (const col of columns) {
    const { value, formatter } = resolveAggregatedValue(rowConfig, col, dataRows);
    if (value != null) {
      const span = document.createElement('span');
      span.className = 'tbw-aggregation-aggregate';
      span.setAttribute('data-field', col.field);
      const header = col.header ?? col.field;
      const displayValue = formatter ? formatter(value, col.field, col) : String(value);
      span.textContent = `${header}: ${displayValue}`;
      container.appendChild(span);
    }
  }

  return container.children.length > 0 ? container : null;
}

/**
 * Renders a custom panel element.
 *
 * @param panel - The panel definition
 * @param context - The current grid context
 * @returns The panel DOM element
 */
function renderCustomPanel(panel: PinnedRowsPanel, context: PinnedRowsContext): HTMLElement {
  const panelEl = document.createElement('div');
  panelEl.className = 'tbw-status-panel tbw-status-panel-custom';
  panelEl.id = `status-panel-${panel.id}`;

  const content = panel.render(context);

  if (typeof content === 'string') {
    panelEl.innerHTML = content;
  } else {
    panelEl.appendChild(content);
  }

  return panelEl;
}

/**
 * Builds the status bar context from grid state and plugin states.
 *
 * @param rows - Current row data
 * @param columns - Current column configuration
 * @param grid - Grid element reference
 * @param selectionState - Optional selection plugin state
 * @param filterState - Optional filtering plugin state
 * @returns The status bar context
 */
export function buildContext(
  rows: unknown[],
  columns: unknown[],
  grid: HTMLElement,
  selectionState?: { selected: Set<number> } | null,
  filterState?: { cachedResult: unknown[] | null } | null,
): PinnedRowsContext {
  return {
    totalRows: rows.length,
    filteredRows: filterState?.cachedResult?.length ?? rows.length,
    selectedRows: selectionState?.selected?.size ?? 0,
    columns: columns as PinnedRowsContext['columns'],
    rows,
    grid,
  };
}

// Keep old name as alias for backwards compatibility
export const createPinnedRowsElement = createInfoBarElement;
