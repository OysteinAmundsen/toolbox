/**
 * Status Bar Rendering Logic
 *
 * Pure functions for creating and updating the status bar UI.
 * Includes both info bar and aggregation row rendering.
 */

import type { PinnedRowsPanel, PinnedRowsContext, PinnedRowsConfig, AggregationRowConfig } from './types';
import type { ColumnConfig } from '../../core/types';
import { getAggregator } from '../../core/internal/aggregators';

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
  pinnedRows.setAttribute('role', 'status');
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
  container.setAttribute('role', 'rowgroup');
  return container;
}

/**
 * Renders aggregation rows into a container.
 *
 * @param container - The container to render into
 * @param rows - Aggregation row configurations
 * @param columns - Current column configuration
 * @param dataRows - Current row data for aggregation calculations
 */
export function renderAggregationRows(
  container: HTMLElement,
  rows: AggregationRowConfig[],
  columns: ColumnConfig[],
  dataRows: unknown[]
): void {
  container.innerHTML = '';

  for (const rowConfig of rows) {
    const rowEl = document.createElement('div');
    rowEl.className = 'tbw-aggregation-row';
    rowEl.setAttribute('role', 'row');
    if (rowConfig.id) {
      rowEl.setAttribute('data-aggregation-id', rowConfig.id);
    }

    if (rowConfig.fullWidth) {
      // Full-width mode: single cell spanning all columns
      const cell = document.createElement('div');
      cell.className = 'tbw-aggregation-cell tbw-aggregation-cell-full';
      cell.style.gridColumn = '1 / -1';
      cell.textContent = rowConfig.label || '';
      rowEl.appendChild(cell);
    } else {
      // Per-column mode: one cell per column with aggregated/static values
      for (const col of columns) {
        const cell = document.createElement('div');
        cell.className = 'tbw-aggregation-cell';
        cell.setAttribute('data-field', col.field);

        let value: unknown;

        // Check for aggregator first
        const aggRef = rowConfig.aggregators?.[col.field];
        if (aggRef) {
          const aggFn = getAggregator(aggRef);
          if (aggFn) {
            value = aggFn(dataRows, col.field, col);
          }
        } else if (rowConfig.cells && Object.prototype.hasOwnProperty.call(rowConfig.cells, col.field)) {
          // Static or computed cell value
          const staticVal = rowConfig.cells[col.field];
          if (typeof staticVal === 'function') {
            value = staticVal(dataRows, col.field, col);
          } else {
            value = staticVal;
          }
        }

        cell.textContent = value != null ? String(value) : '';
        rowEl.appendChild(cell);
      }
    }

    container.appendChild(rowEl);
  }
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
  filterState?: { cachedResult: unknown[] | null } | null
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
