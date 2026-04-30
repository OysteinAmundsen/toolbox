/**
 * Status Bar Rendering Logic
 *
 * Pure functions for creating and updating the status bar UI.
 * Includes both info bar and aggregation row rendering.
 */

import { aggregatorRegistry } from '../../core/internal/aggregators';
import type { ColumnConfig } from '../../core/types';
import type {
  AggregationRowConfig,
  AggregatorConfig,
  AggregatorDefinition,
  PanelRender,
  PanelSlot,
  PanelZone,
  PinnedRowSlot,
  PinnedRowsConfig,
  PinnedRowsContext,
  PinnedRowsPanel,
  ZonedPanelRender,
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

  // Overlay label: positioned at the left edge, independent of column alignment
  const labelValue = typeof rowConfig.label === 'function' ? rowConfig.label(dataRows, columns) : rowConfig.label;
  if (labelValue) {
    const labelEl = document.createElement('span');
    labelEl.className = 'tbw-aggregation-label';
    labelEl.textContent = labelValue;
    rowEl.appendChild(labelEl);
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
      const aggFn = aggregatorRegistry.get(aggDef.aggFunc);
      if (aggFn) {
        value = aggFn(dataRows, col.field, col);
      }
      formatter = aggDef.formatter;
    } else {
      const aggFn = aggregatorRegistry.get(aggDef);
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
  // Prefer live counts from the grid element so filteredRows reflects the
  // actual processed row count regardless of which mechanism did the
  // filtering (built-in filter plugin, column filters, custom pipeline, etc.).
  // Fall back to the passed `rows` when the grid element does not expose
  // these properties (e.g. in unit tests using a plain <div>).
  //
  // When `sourceRows` is empty (e.g. ServerSidePlugin owns the data and the
  // user never assigned `grid.rows = ...`), fall back to the processed count
  // so we report a meaningful total instead of 0.
  const gridSourceRows = (grid as unknown as { sourceRows?: unknown[] })?.sourceRows;
  const gridProcessedRows = (grid as unknown as { rows?: unknown[] })?.rows;
  const sourceLen = Array.isArray(gridSourceRows) ? gridSourceRows.length : rows.length;
  const processedCount = Array.isArray(gridProcessedRows) ? gridProcessedRows.length : rows.length;
  const totalRows = sourceLen > 0 ? sourceLen : processedCount;

  // filteredRows resolution (in priority order):
  // 1. Plugin filter state's cachedResult (authoritative when filtering plugin owns the data)
  // 2. Custom pipeline signal: processed < source means the host filtered rows itself
  // 3. Default to totalRows so the renderer's `filteredRows !== totalRows` check
  //    hides the panel when no filter is active. This is critical for the
  //    server-side case where processedCount > sourceLen (placeholders inflate
  //    grid.rows beyond grid.sourceRows.length) and would otherwise show a
  //    spurious "Filtered: N" panel.
  const filteredRows = filterState?.cachedResult?.length ?? (processedCount < sourceLen ? processedCount : totalRows);

  return {
    totalRows,
    filteredRows,
    selectedRows: selectionState?.selected?.size ?? 0,
    columns: columns as PinnedRowsContext['columns'],
    rows,
    grid,
  };
}

// #region Slot-aware (issue #255) renderers

/**
 * Built-in panel renderer: total row count.
 * Always renders. Output: `<span class="tbw-status-panel tbw-status-panel-row-count">Total: N rows</span>`.
 */
export function rowCountPanel(): PanelRender {
  return (ctx) => {
    const el = document.createElement('span');
    el.className = 'tbw-status-panel tbw-status-panel-row-count';
    el.textContent = `Total: ${ctx.totalRows} rows`;
    return el;
  };
}

/**
 * Built-in panel renderer: selected row count.
 * Returns `null` (skipped) when no rows are selected.
 */
export function selectedCountPanel(): PanelRender {
  return (ctx) => {
    if (ctx.selectedRows <= 0) return null;
    const el = document.createElement('span');
    el.className = 'tbw-status-panel tbw-status-panel-selected-count';
    el.textContent = `Selected: ${ctx.selectedRows}`;
    return el;
  };
}

/**
 * Built-in panel renderer: filtered row count.
 * Returns `null` (skipped) when the filtered count equals the total (no filter active).
 */
export function filteredCountPanel(): PanelRender {
  return (ctx) => {
    if (ctx.filteredRows === ctx.totalRows) return null;
    const el = document.createElement('span');
    el.className = 'tbw-status-panel tbw-status-panel-filtered-count';
    el.textContent = `Filtered: ${ctx.filteredRows}`;
    return el;
  };
}

/**
 * Wraps the user's panel HTMLElement in the standard `.tbw-status-panel` envelope.
 * Mirrors the legacy custom-panel DOM shape so consumer CSS keeps working.
 */
function wrapCustomPanelElement(element: HTMLElement, id?: string): HTMLElement {
  const panelEl = document.createElement('div');
  panelEl.className = 'tbw-status-panel tbw-status-panel-custom';
  if (id) panelEl.id = `status-panel-${id}`;
  panelEl.appendChild(element);
  return panelEl;
}

/**
 * Renders a single {@link PanelSlot} as a `.tbw-pinned-rows` row with three zones.
 * Returns `null` if no panel content was produced (all renders returned null).
 */
export function renderPanelSlot(slot: PanelSlot, context: PinnedRowsContext): HTMLElement | null {
  // Build the three zones up-front so we can drop the row entirely if everything is null.
  const row = document.createElement('div');
  row.className = 'tbw-pinned-rows';
  row.setAttribute('role', 'presentation');
  row.setAttribute('aria-live', 'polite');
  if (slot.id) row.setAttribute('data-pinned-row-id', slot.id);

  const left = document.createElement('div');
  left.className = 'tbw-pinned-rows-left';
  const center = document.createElement('div');
  center.className = 'tbw-pinned-rows-center';
  const right = document.createElement('div');
  right.className = 'tbw-pinned-rows-right';

  const zoneOf: Record<PanelZone, HTMLElement> = { left, center, right };

  const renderers: ZonedPanelRender[] = Array.isArray(slot.render)
    ? slot.render
    : [{ zone: 'left', render: slot.render }];

  for (const entry of renderers) {
    const zone = entry.zone ?? 'left';
    const out = entry.render(context);
    if (out == null) continue;
    // Built-in panels return their element ready-to-append; wrap others
    // (user-supplied via render array) consistently in .tbw-status-panel only
    // when not already a status panel, to preserve existing semantics.
    const isAlreadyStatusPanel = out.classList?.contains('tbw-status-panel');
    zoneOf[zone].appendChild(isAlreadyStatusPanel ? out : wrapCustomPanelElement(out, slot.id));
  }

  if (left.children.length === 0 && center.children.length === 0 && right.children.length === 0) {
    return null;
  }

  row.appendChild(left);
  row.appendChild(center);
  row.appendChild(right);
  return row;
}

/**
 * Renders a single {@link AggregationRowConfig} (slot variant) as one
 * `.tbw-aggregation-rows` container holding one `.tbw-aggregation-row`.
 *
 * The container class includes `-top` or `-bottom` to preserve existing CSS
 * (e.g. border-top vs border-bottom).
 */
export function renderAggregationSlot(
  slot: AggregationRowConfig,
  position: 'top' | 'bottom',
  columns: ColumnConfig[],
  dataRows: unknown[],
  globalFullWidth = false,
): HTMLElement {
  const container = createAggregationContainer(position);
  renderAggregationRows(container, [slot], columns, dataRows, globalFullWidth);
  return container;
}

/**
 * Synthesizes a slot list from the legacy {@link PinnedRowsConfig} fields.
 * Preserves the exact legacy DOM ordering so untouched consumers see no change:
 * - Top area: aggregation rows with `position === 'top'`.
 * - Bottom area: aggregation rows with `position !== 'top'`, then the info bar
 *   (built-in counts + custom panels) when `config.position !== 'top'`.
 * - When `config.position === 'top'`, the info bar is emitted as a top-area
 *   PanelSlot positioned BEFORE the top aggregation rows (mirrors the legacy
 *   `container.insertBefore(infoBar, container.firstChild)` placement).
 *
 * Returns `null` if `slots[]` is provided on the config (no synthesis needed).
 */
export function synthesizeLegacySlots(config: PinnedRowsConfig): PinnedRowSlot[] | null {
  if (config.slots) return null;

  const slots: PinnedRowSlot[] = [];

  // Build the info-bar PanelSlot from the legacy boolean flags + customPanels.
  const infoBarRenderers: ZonedPanelRender[] = [];
  if (config.showRowCount !== false) {
    infoBarRenderers.push({ zone: 'left', render: rowCountPanel() });
  }
  if (config.showFilteredCount !== false) {
    infoBarRenderers.push({ zone: 'left', render: filteredCountPanel() });
  }
  if (config.showSelectedCount !== false) {
    infoBarRenderers.push({ zone: 'right', render: selectedCountPanel() });
  }
  for (const panel of config.customPanels ?? []) {
    infoBarRenderers.push({
      zone: panel.position,
      render: legacyPanelRender(panel),
    });
  }

  const infoBarPosition: 'top' | 'bottom' = config.position === 'top' ? 'top' : 'bottom';
  const infoBarSlot: PanelSlot | null =
    infoBarRenderers.length > 0
      ? { id: '__legacy_info_bar', position: infoBarPosition, render: infoBarRenderers }
      : null;

  // When info bar is at top, it must come BEFORE top aggregation rows
  // (mirrors legacy insertBefore(container.firstChild) placement).
  if (infoBarSlot && infoBarPosition === 'top') {
    slots.push(infoBarSlot);
  }

  for (const row of config.aggregationRows ?? []) {
    slots.push(row);
  }

  if (infoBarSlot && infoBarPosition === 'bottom') {
    slots.push(infoBarSlot);
  }

  return slots;
}

/**
 * Adapts a legacy {@link PinnedRowsPanel} (which may return string or HTMLElement)
 * into the new {@link PanelRender} signature. Wraps string output in a div, mirroring
 * the legacy `renderCustomPanel` behavior.
 */
function legacyPanelRender(panel: PinnedRowsPanel): PanelRender {
  return (ctx) => {
    const content = panel.render(ctx);
    const wrap = document.createElement('div');
    wrap.className = 'tbw-status-panel tbw-status-panel-custom';
    wrap.id = `status-panel-${panel.id}`;
    if (typeof content === 'string') {
      wrap.innerHTML = content;
    } else {
      wrap.appendChild(content);
    }
    return wrap;
  };
}

// #endregion
