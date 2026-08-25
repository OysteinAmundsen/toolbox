import { FOCUSABLE_EDITOR_SELECTOR, GridClasses } from '../constants';
import type { ColumnInternal, ColumnViewRenderer, GridHost, InternalGrid, RowElementInternal } from '../types';
import {
  CELL_CLASS_ERROR,
  FORMAT_ERROR,
  ROW_CLASS_ERROR,
  VIEW_DISPATCH_ERROR,
  VIEW_MOUNT_ERROR,
  warnDiagnostic,
} from './diagnostics';
import { ensureCellVisible } from './keyboard';
import { evalTemplateString, finalCellScrub, setSanitizedHTML } from './sanitize';
import { booleanCellHTML, clearCellFocus, formatDateValue, getRowIndexFromCell } from './utils';
import { resolveCellValue } from './value-accessor';

/** Callback type for plugin row rendering hook */
export type RenderRowHook = (row: any, rowEl: HTMLElement, rowIndex: number) => boolean;

// #region Type Defaults Resolution
/**
 * Resolves the renderer for a column using the priority chain:
 * 1. Column-level (`column.renderer` / `column.viewRenderer`)
 *    NOTE: typeDefaults are applied to columns at config merge time,
 *    so columns with matching types already have their renderer set.
 * 2. App-level (framework adapter's `getTypeDefault`)
 * 3. Returns undefined (caller uses built-in or fallback)
 */
export function resolveRenderer<TRow>(
  grid: InternalGrid<TRow>,
  col: ColumnInternal<TRow>,
): ColumnViewRenderer<TRow, unknown> | undefined {
  // 1. Column-level renderer (highest priority)
  // NOTE: typeDefaults from gridConfig are applied to columns at config merge time
  // by ConfigManager.#applyTypeDefaultsToColumns(), so they appear here as col.renderer
  const columnRenderer = col.renderer || col.viewRenderer;
  if (columnRenderer) return columnRenderer;

  // No type specified - no type defaults to check
  if (!col.type) return undefined;

  // 2. App-level registry (via framework adapter)
  // This is for framework adapters that register type defaults dynamically
  const adapter = grid.__frameworkAdapter;
  if (adapter?.getTypeDefault) {
    const appDefault = adapter.getTypeDefault<TRow>(col.type, grid._hostElement);
    if (appDefault?.renderer) {
      return appDefault.renderer;
    }
  }

  // 3. No custom renderer - caller uses built-in/fallback
  return undefined;
}

/**
 * Resolves the format function for a column using the priority chain:
 * 1. Column-level (`column.format`)
 *    NOTE: typeDefaults are applied to columns at config merge time,
 *    so columns with matching types already have their format set.
 * 2. App-level (framework adapter's `getTypeDefault`)
 * 3. Returns undefined (caller uses built-in or fallback)
 */
export function resolveFormat<TRow>(
  grid: InternalGrid<TRow>,
  col: ColumnInternal<TRow>,
): ((value: unknown, row: TRow) => string) | undefined {
  // 1. Column-level format (highest priority)
  // NOTE: typeDefaults from gridConfig are applied to columns at config merge time
  // by ConfigManager.#applyTypeDefaultsToColumns(), so they appear here as col.format
  if (col.format) return col.format;

  // No type specified - no type defaults to check
  if (!col.type) return undefined;

  // 2. App-level registry (via framework adapter)
  // This is for framework adapters that register type defaults dynamically
  const adapter = grid.__frameworkAdapter;
  if (adapter?.getTypeDefault) {
    const appDefault = adapter.getTypeDefault<TRow>(col.type, grid._hostElement);
    if (appDefault?.format) {
      return appDefault.format as (value: unknown, row: TRow) => string;
    }
  }

  // 3. No custom format - caller uses built-in/fallback
  return undefined;
}
// #endregion

// #region DOM State Helpers
// `FOCUSABLE_EDITOR_SELECTOR` now lives in `../constants` (a leaf module) to break
// the rows ↔ keyboard cycle; re-exported here for backward-compatible importers.
export { FOCUSABLE_EDITOR_SELECTOR };

/**
 * Check if a row element has any cells in editing mode.
 * This is a DOM-level check used for virtualization recycling.
 */
function hasEditingCells(rowEl: RowElementInternal): boolean {
  return (rowEl.__editingCellCount ?? 0) > 0;
}

/**
 * Clear all editing state from a row element.
 * Called when a row element is recycled for a different data row.
 */
function clearEditingState(rowEl: RowElementInternal): void {
  rowEl.__editingCellCount = 0;
  rowEl.removeAttribute('data-has-editing');
  // Clear editing class from all cells
  const cells = rowEl.querySelectorAll(`.cell.${GridClasses.EDITING}`);
  cells.forEach((cell) => cell.classList.remove(GridClasses.EDITING));
}
// #endregion

// #region Template Cloning System
// Using template cloning is 3-4x faster than document.createElement + setAttribute
// for repetitive element creation because the browser can skip parsing.

/**
 * Cell template for cloning. Pre-configured with static attributes.
 * Dynamic attributes (data-col, data-row, etc.) are set after cloning.
 */
const cellTemplate = document.createElement('template');
cellTemplate.innerHTML = '<div class="cell" role="gridcell" part="cell"></div>';

/**
 * Row template for cloning. Pre-configured with static attributes.
 * Dynamic attributes (data-row) and children (cells) are set after cloning.
 */
const rowTemplate = document.createElement('template');
rowTemplate.innerHTML = '<div class="data-grid-row" role="row" part="row"></div>';

/**
 * Create a cell element from template. Significantly faster than createElement + setAttribute.
 */
function createCellFromTemplate(): HTMLDivElement {
  return cellTemplate.content.firstElementChild!.cloneNode(true) as HTMLDivElement;
}

/**
 * Create a row element from template. Significantly faster than createElement + setAttribute.
 */
export function createRowFromTemplate(): HTMLDivElement {
  return rowTemplate.content.firstElementChild!.cloneNode(true) as HTMLDivElement;
}
// #endregion

// #region Row Rendering
/**
 * Invalidate the cell cache (call when rows or columns change).
 */
export function invalidateCellCache(grid: InternalGrid): void {
  grid.__cellDisplayCache = undefined;
  grid.__cellCacheEpoch = undefined;
  grid.__hasSpecialColumns = undefined; // Reset fast-path check
}

/**
 * Remove the classes a previous `rowClass` / `cellClass` invocation applied.
 * The applied set is recorded on the element as `data-dynamic-classes` so we can
 * drop exactly those and leave structural classes (`cell`, `cell-focus`, …) alone.
 */
function clearDynamicClasses(el: HTMLElement): void {
  const prev = el.getAttribute('data-dynamic-classes');
  if (!prev) return;
  const parts = prev.split(' ');
  for (let i = 0; i < parts.length; i++) {
    if (parts[i]) el.classList.remove(parts[i]);
  }
}

/**
 * Apply the result of a `rowClass` / `cellClass` callback and record the applied
 * set so the next render can remove it. Accepts the raw callback return value
 * (space-separated string or array).
 */
function applyDynamicClasses(el: HTMLElement, result: string | string[] | undefined | null): void {
  const classes = typeof result === 'string' ? result.split(/\s+/) : result;
  if (!classes || classes.length === 0) {
    el.removeAttribute('data-dynamic-classes');
    return;
  }
  let applied = '';
  for (let i = 0; i < classes.length; i++) {
    const c = classes[i];
    if (c && typeof c === 'string') {
      el.classList.add(c);
      applied += (applied ? ' ' : '') + c;
    }
  }
  el.setAttribute('data-dynamic-classes', applied);
}

/** Invoke the `afterCellRender` plugin hook for a freshly rendered/patched cell. */
function emitAfterCellRender(
  grid: GridHost,
  rowEl: HTMLElement,
  cell: HTMLElement,
  col: ColumnInternal,
  colIndex: number,
  rowData: any,
  rowIndex: number,
  value: unknown,
): void {
  grid._afterCellRender?.({
    row: rowData,
    rowIndex,
    column: col,
    colIndex,
    value,
    cellElement: cell,
    rowElement: rowEl,
  });
}

/**
 * Number of header rows above the data rows (1, or 2 when a column-group header
 * row is present). Cached on the grid — used to offset `aria-rowindex`.
 */
function resolveHeaderRowCount(grid: GridHost): number {
  let headerRowCount = grid.__cachedHeaderRowCount;
  if (headerRowCount === undefined) {
    headerRowCount = grid.querySelector('.header-group-row') ? 2 : 1;
    grid.__cachedHeaderRowCount = headerRowCount;
  }
  return headerRowCount;
}

/**
 * Grow / shrink the recyclable row pool to exactly `needed` elements.
 *
 * Excess elements are released BEFORE detaching so framework adapters (React
 * portals, Vue teleports, Angular EmbeddedViewRefs) can unmount cleanly.
 * Skipping this leaves portals tracked against detached containers, causing
 * `removeChild` crashes on the next commit (#250). The whole shrink is wrapped
 * in `beginBatch` / `endBatch` so adapters can defer per-cell sync commits to a
 * single render at the end (#330).
 */
function syncRowPool(grid: GridHost, needed: number, bodyEl: HTMLElement | null): void {
  // Note: click/dblclick handlers are delegated at grid level, so pooled rows
  // need no per-element listeners. Template cloning beats createElement 3-4x.
  while (grid._rowPool.length < needed) {
    grid._rowPool.push(createRowFromTemplate());
  }
  if (grid._rowPool.length <= needed) return;

  const adapter = grid.__frameworkAdapter;
  const release = adapter?.releaseCell;
  adapter?.beginBatch?.(grid);
  try {
    for (let i = needed; i < grid._rowPool.length; i++) {
      const el = grid._rowPool[i];
      if (release) {
        const cells = el.children;
        for (let c = 0; c < cells.length; c++) {
          const cell = cells[c] as HTMLElement;
          if (cell.firstElementChild) release.call(adapter, cell);
        }
      }
      if (el.parentNode === bodyEl) el.remove();
    }
    grid._rowPool.length = needed;
  } finally {
    adapter?.endBatch?.(grid);
  }
}

/** Restore a plugin-owned custom row element (group row, detail row, …) to the default row shape. */
function resetCustomRow(rowEl: RowElementInternal): void {
  if (!rowEl.__isCustomRow) return;
  rowEl.className = 'data-grid-row';
  rowEl.setAttribute('role', 'row');
  rowEl.__isCustomRow = false;
}

/**
 * True when the row's structure looks valid but an `externalView` placeholder has
 * gone missing — the cell must be rebuilt so the placeholder can be re-mounted.
 * Matches cells by their `data-col` attribute (the row may not have been rendered
 * by the default path).
 */
function hasMissingExternalView(rowEl: HTMLElement, columns: ColumnInternal[], colLen: number): boolean {
  for (let c = 0; c < colLen; c++) {
    if (!columns[c].externalView) continue;
    if (!rowEl.querySelector(`.cell[data-col="${c}"] [data-external-view]`)) return true;
  }
  return false;
}

/**
 * Positional variant of {@link hasMissingExternalView} for the patch path, where
 * the cell list is known to be in column order.
 */
function hasMissingExternalViewCell(children: HTMLCollection, columns: ColumnInternal[], len: number): boolean {
  for (let i = 0; i < len; i++) {
    if (!columns[i].externalView) continue;
    if (!(children[i] as HTMLElement).querySelector('[data-external-view]')) return true;
  }
  return false;
}

/**
 * Bring a pooled row element in sync with `rowData`, choosing between a full
 * rebuild (`renderInlineRow`) and an in-place patch (`fastPatchRow`).
 *
 * Live editors are the complicating factor: a recycled element may still carry
 * editors belonging to a *different* data row, in which case they must be cleared
 * and the row rebuilt. If this IS the actively edited row, `EditingPlugin`'s
 * `onScrollRender()` re-injects editors after this returns.
 */
function reconcileRow(
  grid: GridHost,
  rowEl: RowElementInternal,
  rowData: any,
  rowIndex: number,
  epoch: number | undefined,
  structureValid: boolean,
  dataRefChanged: boolean,
): void {
  const hasEditing = hasEditingCells(rowEl);
  // In grid edit mode every row carries editors — but only rows that were NOT
  // recycled (same data ref) still own them. A recycled row must rebuild so
  // afterCellRender can re-evaluate per-cell editability for the new row data.
  const isActivelyEditedRow = (!!grid._isGridEditMode && !dataRefChanged) || grid._activeEditRows === rowIndex;

  if (!structureValid) {
    if (hasEditing && isActivelyEditedRow) {
      // Correct row and it owns live editors — preserve them.
      fastPatchRow(grid, rowEl, rowData, rowIndex);
      rowEl.__rowDataRef = rowData;
      return;
    }
    resetCustomRow(rowEl);
    if (hasEditing) clearEditingState(rowEl);
    renderInlineRow(grid, rowEl, rowData, rowIndex);
    rowEl.__epoch = epoch;
    rowEl.__rowDataRef = rowData;
    return;
  }

  if (hasEditing && !isActivelyEditedRow) {
    clearEditingState(rowEl);
    renderInlineRow(grid, rowEl, rowData, rowIndex);
    rowEl.__epoch = epoch;
    rowEl.__rowDataRef = rowData;
    return;
  }

  fastPatchRow(grid, rowEl, rowData, rowIndex);
  if (dataRefChanged) rowEl.__rowDataRef = rowData;
}

/** Toggle the `changed` class from EditingPlugin's dirty-row id set. */
function applyChangedClass(grid: GridHost, rowEl: HTMLElement, rowData: any): void {
  let isChanged = false;
  const changedRowIdSet = grid._changedRowIdSet;
  if (changedRowIdSet && changedRowIdSet.size > 0) {
    try {
      const rowId = grid.getRowId?.(rowData);
      if (rowId) isChanged = changedRowIdSet.has(rowId);
    } catch {
      // Row has no ID - not tracked as changed
    }
  }
  if (isChanged !== rowEl.classList.contains('changed')) {
    rowEl.classList.toggle('changed', isChanged);
  }
}

/** Apply the configured `rowClass` callback, replacing any classes it added last render. */
function applyRowClass(grid: GridHost, rowEl: HTMLElement, rowData: any): void {
  const rowClassFn = grid.effectiveConfig?.rowClass;
  if (!rowClassFn) return;
  clearDynamicClasses(rowEl);
  try {
    applyDynamicClasses(rowEl, rowClassFn(rowData));
  } catch (e) {
    warnDiagnostic(ROW_CLASS_ERROR, `rowClass callback error: ${e}`, grid.id);
    rowEl.removeAttribute('data-dynamic-classes');
  }
}

/**
 * Render / patch the visible window of rows [start, end) using a recyclable DOM pool.
 * Newly required row elements are created and appended; excess are detached.
 * Uses an epoch counter to force full row rebuilds when structural changes (like columns) occur.
 * @param renderRowHook - Optional callback that plugins can use to render custom rows (e.g., group rows).
 *                        If it returns true, default rendering is skipped for that row.
 */
export function renderVisibleRows(
  grid: GridHost,
  start: number,
  end: number,
  epoch?: number,
  renderRowHook?: RenderRowHook,
): void {
  const needed = Math.max(0, end - start);
  const bodyEl = grid._bodyEl;
  const columns = grid._visibleColumns;
  const colLen = columns.length;
  const headerRowCount = resolveHeaderRowCount(grid);

  syncRowPool(grid, needed, bodyEl);

  // Check if any plugin has a renderRow hook (cache this)
  const hasRenderRowPlugins = renderRowHook && grid.__hasRenderRowPlugins !== false;

  // Check if any plugin wants row-level hooks (avoid overhead when not needed)
  const hasRowHook = grid._hasAfterRowRenderHook?.() ?? false;

  // Cache variable-height function for per-row CSS variable override
  const varHeightFn =
    grid._virtualization?.variableHeights && typeof grid.effectiveConfig?.rowHeight === 'function'
      ? (grid.effectiveConfig.rowHeight as (row: unknown, index: number) => number | undefined)
      : null;

  for (let i = 0; i < needed; i++) {
    const rowIndex = start + i;
    const rowData = grid._rows[rowIndex];
    const rowEl = grid._rowPool[i] as RowElementInternal;

    // aria-rowindex is 1-based and accounts for header rows. Pooled rows keep the
    // same index across most renders (only scrolling shifts them), so guard the
    // write — an unconditional `setAttribute` costs a string allocation plus an
    // attribute mutation per row per frame.
    const ariaRowIndex = rowIndex + headerRowCount + 1;
    if (rowEl.__ariaRowIndex !== ariaRowIndex) {
      rowEl.__ariaRowIndex = ariaRowIndex;
      rowEl.setAttribute('aria-rowindex', String(ariaRowIndex));
    }

    // Let plugins handle custom row rendering (e.g., group rows)
    if (hasRenderRowPlugins && renderRowHook!(rowData, rowEl, rowIndex)) {
      rowEl.__epoch = epoch;
      rowEl.__rowDataRef = rowData;
      if (rowEl.parentNode !== bodyEl) bodyEl.appendChild(rowEl);
      continue;
    }

    let cellCount = rowEl.children.length;
    // Loading overlay is a non-cell child appended at the end — exclude from cell count
    // to avoid false structure-invalid detection that causes unnecessary full rebuilds.
    if (cellCount > colLen && rowEl.lastElementChild?.classList.contains('tbw-row-loading-overlay')) {
      cellCount--;
    }

    const dataRefChanged = rowEl.__rowDataRef !== rowData;
    let structureValid = rowEl.__epoch === epoch && cellCount === colLen;
    // A valid-looking structure can still have lost an external-view placeholder
    // when the element was recycled for a different row.
    if (structureValid && dataRefChanged && hasMissingExternalView(rowEl, columns, colLen)) {
      structureValid = false;
    }

    reconcileRow(grid, rowEl, rowData, rowIndex, epoch, structureValid, dataRefChanged);

    applyChangedClass(grid, rowEl, rowData);
    applyRowClass(grid, rowEl, rowData);

    // Apply per-row variable height via --tbw-row-height CSS custom property.
    // Cells bind to this variable (min-height: var(--tbw-row-height)), so setting
    // it on the row element makes both the row and its cells respect the override.
    // The `measureRowHeight` guard in virtualization-manager.ts prevents this from corrupting s.rowHeight.
    if (varHeightFn) {
      const h = varHeightFn(rowData, rowIndex);
      if (h !== undefined && h > 0) {
        rowEl.style.setProperty('--tbw-row-height', `${h}px`);
      } else {
        rowEl.style.removeProperty('--tbw-row-height');
      }
    }

    // Call row-level plugin hook if any plugin registered it
    if (hasRowHook) {
      grid._afterRowRender?.({
        row: rowData,
        rowIndex,
        rowElement: rowEl,
      });
    }

    if (rowEl.parentNode !== bodyEl) bodyEl.appendChild(rowEl);
  }
}
// #endregion

// #region Row Patching
/**
 * True when at least one visible column needs the full render path (custom
 * renderer, template, external view, formatter, cell class, or a `date`/`boolean`
 * built-in). Cached on the grid — `invalidateCellCache()` resets it.
 *
 * NOTE: typeDefaults are applied to columns at config merge time by
 * `ConfigManager.#applyTypeDefaultsToColumns()`, so a matching typeDefault already
 * shows up as `col.renderer`/`col.format`. Only adapter-level defaults need a lookup.
 */
function hasSpecialColumns(grid: GridHost, columns: ColumnInternal[], colsLen: number): boolean {
  const cached = grid.__hasSpecialColumns;
  if (cached !== undefined) return cached;

  let special = false;
  const adapter = grid.__frameworkAdapter;
  for (let i = 0; i < colsLen; i++) {
    const col = columns[i];
    if (
      col.__viewTemplate ||
      col.__compiledView ||
      col.renderer ||
      col.viewRenderer ||
      col.externalView ||
      col.format ||
      col.cellClass ||
      col.type === 'date' ||
      col.type === 'boolean' ||
      // Check for adapter-level type defaults (framework adapters)
      (col.type && adapter?.getTypeDefault?.(col.type, grid._hostElement)?.renderer) ||
      (col.type && adapter?.getTypeDefault?.(col.type, grid._hostElement)?.format)
    ) {
      special = true;
      break;
    }
  }
  grid.__hasSpecialColumns = special;
  return special;
}

/**
 * Sync a cell's focus ring. Must be data-driven (from `_focusRow`/`_focusCol`),
 * never derived from the DOM element, because pooled elements are recycled.
 */
function patchCellFocus(cell: HTMLElement, shouldHaveFocus: boolean): void {
  const hasFocus = cell.classList.contains('cell-focus');
  if (shouldHaveFocus === hasFocus) return;
  cell.classList.toggle('cell-focus', shouldHaveFocus);
  cell.setAttribute('aria-selected', String(shouldHaveFocus));
}

/** Apply the column's `cellClass` callback, replacing any classes it added last render. */
function applyCellClass(grid: GridHost, cell: HTMLElement, col: ColumnInternal, rowData: any, rowIndex: number): void {
  const cellClassFn = col.cellClass;
  if (!cellClassFn) return;
  clearDynamicClasses(cell);
  try {
    const value = resolveCellValue(rowData, col, rowIndex);
    applyDynamicClasses(cell, cellClassFn(value, rowData, col));
  } catch (e) {
    warnDiagnostic(CELL_CLASS_ERROR, `cellClass callback error for column '${col.field}': ${e}`, grid.id);
    cell.removeAttribute('data-dynamic-classes');
  }
}

/**
 * Ultra-fast patch loop for grids with no special columns — plain `textContent`
 * assignment with no renderer/format/template resolution at all.
 */
function patchPlainCells(
  grid: GridHost,
  rowEl: HTMLElement,
  children: HTMLCollection,
  columns: ColumnInternal[],
  minLen: number,
  rowData: any,
  rowIndex: number,
  rowIndexStr: string,
  hasCellHook: boolean,
): void {
  const focusRow = grid._focusRow;
  const focusCol = grid._focusCol;

  for (let i = 0; i < minLen; i++) {
    const cell = children[i] as HTMLElement;

    // Skip cells in edit mode - they have editors that must be preserved
    if (cell.classList.contains(GridClasses.EDITING)) continue;

    // Release editor views if cell has element children (indicating prior editor/renderer DOM).
    // Plain text cells (textContent-only) have no element children, so this is a fast O(1) skip.
    if (cell.firstElementChild) grid.__frameworkAdapter?.releaseCell?.(cell);

    const col = columns[i];
    const value = resolveCellValue(rowData, col, rowIndex);
    cell.textContent = value == null ? '' : String(value);
    // Update data-row for click handling
    if (cell.getAttribute('data-row') !== rowIndexStr) {
      cell.setAttribute('data-row', rowIndexStr);
    }
    // aria-selected only valid for gridcell, not checkbox (but this path has no special cols)
    patchCellFocus(cell, focusRow === rowIndex && focusCol === i);

    if (hasCellHook) emitAfterCellRender(grid, rowEl, cell, col, i, rowData, rowIndex, value);
  }
}

/** Matches template source that tries to reach the prototype/proxy machinery. */
const UNSAFE_TEMPLATE_RE = /Reflect\.|\bProxy\b|ownKeys\(/;

/**
 * Write the output of a column renderer into the cell.
 *
 * Renderers may return a string (sanitized HTML), a `Node` (adopted directly),
 * `null`/`undefined` (fall back to the raw value), or a framework-owned handle
 * (left alone — the adapter has already rendered in place).
 */
function applyRendererOutput(
  grid: GridHost,
  cell: HTMLElement,
  col: ColumnInternal,
  rowData: any,
  value: unknown,
  cellRenderer: ColumnViewRenderer<any, unknown>,
): void {
  // Pass cellEl for framework adapters that want to cache per-cell
  const produced = cellRenderer({
    row: rowData,
    value,
    field: col.field,
    column: col,
    grid: grid as any,
    cellEl: cell,
  });
  if (typeof produced === 'string') {
    // Release editor views before wiping cell content
    grid.__frameworkAdapter?.releaseCell?.(cell);
    setSanitizedHTML(cell, produced);
  } else if (produced instanceof Node) {
    // Skip when the container is already a child of the cell — the framework
    // adapter reused it and re-rendered in place.
    if (produced.parentElement !== cell) {
      grid.__frameworkAdapter?.releaseCell?.(cell);
      cell.innerHTML = '';
      cell.appendChild(produced);
    }
  } else if (produced == null) {
    // Renderer returned null/undefined - show raw value
    grid.__frameworkAdapter?.releaseCell?.(cell);
    cell.textContent = value == null ? '' : String(value);
  }
  // If produced is truthy but not a string or Node, the framework handles it
}

/**
 * Write the output of a compiled or inline view template into the cell.
 *
 * `html` is `null` when the template was rejected by the sanitizer's static
 * analysis (compiled templates) or by {@link UNSAFE_TEMPLATE_RE} (inline
 * templates); the cell is then blanked rather than rendered.
 */
function applyTemplateOutput(grid: GridHost, cell: HTMLElement, html: string | null): void {
  if (html === null) {
    cell.textContent = '';
    return;
  }
  // Release any framework views before replacing innerHTML
  if (cell.firstElementChild) grid.__frameworkAdapter?.releaseCell?.(cell);
  setSanitizedHTML(cell, html);
  finalCellScrub(cell);
}

/**
 * Write a plain (non-rendered, non-templated) value into the cell using the
 * format priority chain: `column.format` → `typeDefaults` → adapter → built-in
 * type formatting.
 */
function applyFormattedValue(grid: GridHost, cell: HTMLElement, col: ColumnInternal, rowData: any, value: unknown) {
  // Release editor views if cell has element children (indicating prior editor/renderer DOM).
  // Plain text cells (textContent-only) have no element children, so this is a fast O(1) skip.
  if (cell.firstElementChild) grid.__frameworkAdapter?.releaseCell?.(cell);

  const formatFn = resolveFormat(grid, col);
  if (formatFn) {
    let displayStr: string;
    try {
      const formatted = formatFn(value, rowData);
      displayStr = formatted == null ? '' : String(formatted);
    } catch (e) {
      // Log format errors as warnings (user configuration issue)
      warnDiagnostic(FORMAT_ERROR, `Format error in column '${col.field}': ${e}`, grid.id);
      displayStr = value == null ? '' : String(value);
    }
    cell.textContent = displayStr;
  } else if (col.type === 'date') {
    cell.textContent = formatDateValue(value);
  } else if (col.type === 'boolean') {
    // Boolean cells have inner span with checkbox role for ARIA compliance
    cell.innerHTML = booleanCellHTML(!!value);
  } else {
    cell.textContent = value == null ? '' : String(value);
  }
}

/**
 * Re-render a single cell's content on the standard (special-column) patch path.
 * Dispatches over the renderer → compiled template → inline template → external
 * view → formatted/plain value priority chain, then fires `afterCellRender` once
 * for whichever branch produced the content.
 *
 * Parameters are kept flat rather than bundled into a context object: this runs
 * once per cell on the patch path, so an options object would allocate per cell.
 */
function patchCellContent(
  grid: GridHost,
  rowEl: HTMLElement,
  cell: HTMLElement,
  col: ColumnInternal,
  colIndex: number,
  rowData: any,
  rowIndex: number,
  hasCellHook: boolean,
): void {
  // Renderer priority chain: column → typeDefaults → adapter → built-in.
  const cellRenderer = resolveRenderer(grid, col);
  let value: unknown;

  if (cellRenderer) {
    // Must re-invoke to get updated content.
    value = resolveCellValue(rowData, col, rowIndex);
    applyRendererOutput(grid, cell, col, rowData, value, cellRenderer);
  } else if (col.__compiledView) {
    // Compiled view template — re-evaluate with current row data.
    value = resolveCellValue(rowData, col, rowIndex);
    const output = col.__compiledView({ row: rowData, value, field: col.field, column: col });
    applyTemplateOutput(grid, cell, col.__compiledView.__blocked ? null : output);
  } else if (col.__viewTemplate) {
    // Inline view template — re-evaluate with current row data.
    value = resolveCellValue(rowData, col, rowIndex);
    const rawTpl = col.__viewTemplate.innerHTML;
    const html = UNSAFE_TEMPLATE_RE.test(rawTpl) ? null : evalTemplateString(rawTpl, { row: rowData, value });
    applyTemplateOutput(grid, cell, html);
  } else if (col.externalView) {
    // External view cells are mounted once and manage their own state.
    return;
  } else {
    value = resolveCellValue(rowData, col, rowIndex);
    applyFormattedValue(grid, cell, col, rowData, value);
  }

  if (hasCellHook) emitAfterCellRender(grid, rowEl, cell, col, colIndex, rowData, rowIndex, value);
}

/**
 * Fast patch path for an already-rendered row: updates plain text cells whose data changed
 * while skipping cells with external views, templates, or active editors.
 *
 * Optimized for scroll performance - avoids querySelectorAll in favor of children access.
 */
function fastPatchRow(grid: GridHost, rowEl: HTMLElement, rowData: any, rowIndex: number): void {
  const children = rowEl.children;
  const columns = grid._visibleColumns;
  const colsLen = columns.length;
  const childLen = children.length;
  const minLen = colsLen < childLen ? colsLen : childLen;
  const rowIndexStr = String(rowIndex);

  // Check if any plugin wants cell-level hooks (avoid overhead when not needed)
  const hasCellHook = grid._hasAfterCellRenderHook?.() ?? false;

  if (!hasSpecialColumns(grid, columns, colsLen)) {
    patchPlainCells(grid, rowEl, children, columns, minLen, rowData, rowIndex, rowIndexStr, hasCellHook);
    return;
  }

  // A missing external-view placeholder means the row must be rebuilt wholesale.
  if (hasMissingExternalViewCell(children, columns, minLen)) {
    renderInlineRow(grid, rowEl, rowData, rowIndex);
    return;
  }

  const focusRow = grid._focusRow;
  const focusCol = grid._focusCol;

  for (let i = 0; i < minLen; i++) {
    const col = columns[i];
    const cell = children[i] as HTMLElement;

    // Update data-row for click handling
    if (cell.getAttribute('data-row') !== rowIndexStr) {
      cell.setAttribute('data-row', rowIndexStr);
    }

    // Check editing state once — reused for the focus guard and the content skip below.
    const isEditing = cell.classList.contains(GridClasses.EDITING);

    // Skip focus sync for editing cells — their focus state is managed by the
    // navigation system (ensureCellVisible), not the render pipeline. Toggling
    // here would fire MutationObservers (e.g., overlay editors) causing
    // premature overlay teardown during re-renders triggered by resize.
    if (!isEditing) patchCellFocus(cell, focusRow === rowIndex && focusCol === i);

    applyCellClass(grid, cell, col, rowData, rowIndex);

    // Skip content update for cells in edit mode — the editor owns the DOM.
    if (isEditing) continue;

    patchCellContent(grid, rowEl, cell, col, i, rowData, rowIndex, hasCellHook);
  }
}
// #endregion

// #region Cell Rendering
/**
 * Wipe a pooled row's cells ahead of a full rebuild.
 *
 * Framework editor views are released BEFORE the DOM is wiped — without this,
 * Angular EmbeddedViewRefs / React roots / Vue apps created by editor factories
 * stay alive in the adapter's tracking arrays after their DOM is destroyed,
 * leaking memory on every edit cycle. Wrapped in `beginBatch`/`endBatch` because
 * `innerHTML = ''` detaches every cell as a group, letting adapters defer
 * per-cell sync commits to a single render once detachment completes (#330).
 */
function clearRowForRebuild(grid: GridHost, rowEl: HTMLElement): void {
  // Clear loading state before rebuild — grid re-applies it after render for
  // actually-loading rows. Prevents a stale tbw-row-loading class from
  // persisting when pool elements are recycled.
  rowEl.classList.remove('tbw-row-loading');
  rowEl.removeAttribute('aria-busy');

  const adapter = grid.__frameworkAdapter;
  if (!adapter?.releaseCell) {
    rowEl.innerHTML = '';
    return;
  }
  adapter.beginBatch?.(grid);
  try {
    const children = rowEl.children;
    for (let i = children.length - 1; i >= 0; i--) {
      adapter.releaseCell(children[i] as HTMLElement);
    }
    rowEl.innerHTML = '';
  } finally {
    adapter.endBatch?.(grid);
  }
}

/** Clone the cell template and stamp the per-cell identity attributes. */
function buildCellElement(col: ColumnInternal, colIndex: number, rowIndex: number): HTMLDivElement {
  // Template cloning is 3-4x faster than createElement + setAttribute.
  const cell = createCellFromTemplate();
  // role/class/part are already set in the template; only dynamic attrs here.
  cell.setAttribute('aria-colindex', String(colIndex + 1)); // aria-colindex is 1-based
  cell.setAttribute('data-col', String(colIndex));
  cell.setAttribute('data-row', String(rowIndex));
  cell.setAttribute('data-field', col.field); // Field name for column identification
  cell.setAttribute('data-header', col.header ?? col.field); // Header text for responsive CSS
  if (col.type) cell.setAttribute('data-type', col.type);
  return cell;
}

/** Render via a column/type/adapter view renderer. Returns true if innerHTML was used. */
function renderViaRenderer(
  grid: GridHost,
  cell: HTMLElement,
  col: ColumnInternal,
  viewRenderer: ColumnViewRenderer<any>,
  value: unknown,
  rowData: any,
): boolean {
  // Pass cellEl for framework adapters that want to cache per-cell
  const produced = viewRenderer({
    row: rowData,
    value,
    field: col.field,
    column: col,
    grid: grid as any,
    cellEl: cell,
  });
  if (typeof produced === 'string') {
    // Sanitize HTML from viewRenderer to prevent XSS from user-controlled data
    setSanitizedHTML(cell, produced);
    return true;
  }
  if (produced instanceof Node) {
    // Skip when the container is already a child of the cell — the framework
    // adapter reused it and has re-rendered in place.
    if (produced.parentElement !== cell) {
      cell.textContent = '';
      cell.appendChild(produced);
    }
  } else if (produced == null) {
    // Renderer returned null/undefined - show raw value
    cell.textContent = value == null ? '' : String(value);
  }
  // If produced is truthy but not a string or Node (e.g., framework placeholder),
  // don't modify the cell - the framework adapter handles rendering.
  return false;
}

/** Insert an external-view placeholder and mount it (directly or via event). */
function mountExternalView(grid: GridHost, cell: HTMLElement, col: ColumnInternal, value: unknown, rowData: any): void {
  const spec = col.externalView!;
  const placeholder = document.createElement('div');
  placeholder.setAttribute('data-external-view', '');
  placeholder.setAttribute('data-field', col.field);
  cell.appendChild(placeholder);
  const context = { row: rowData, value, field: col.field, column: col, grid: grid as any };

  if (spec.mount) {
    try {
      spec.mount({ placeholder, context, spec });
    } catch (e) {
      // Log mount errors as warnings (user configuration issue)
      warnDiagnostic(VIEW_MOUNT_ERROR, `External view mount error for column '${col.field}': ${e}`, grid.id);
    }
  } else {
    queueMicrotask(() => {
      try {
        grid.dispatchEvent(
          new CustomEvent('mount-external-view', {
            bubbles: true,
            composed: true,
            detail: { placeholder, spec, context },
          }),
        );
      } catch (e) {
        // Log dispatch errors as warnings
        warnDiagnostic(
          VIEW_DISPATCH_ERROR,
          `External view event dispatch error for column '${col.field}': ${e}`,
          grid.id,
        );
      }
    });
  }
  placeholder.setAttribute('data-mounted', '');
}

/** Plain value rendering — no renderer/template configured. */
function renderPlainValue(cell: HTMLElement, col: ColumnInternal, value: unknown, formatted: boolean): void {
  // A formatted value is already a display string; use it verbatim.
  if (!formatted && col.type === 'date') {
    cell.textContent = formatDateValue(value);
  } else if (!formatted && col.type === 'boolean') {
    // Wrap checkbox in span to satisfy ARIA: gridcell can contain checkbox
    cell.innerHTML = booleanCellHTML(!!value);
  } else {
    cell.textContent = value == null ? '' : String(value);
  }
}

/**
 * Fill a freshly built cell with content. Precedence: view renderer → external
 * view → compiled template → light-DOM template → plain value.
 * Returns true when `innerHTML` was used and the cell needs scrubbing.
 */
function renderCellContent(
  grid: GridHost,
  cell: HTMLElement,
  col: ColumnInternal,
  value: unknown,
  rowData: any,
  formatted: boolean,
): boolean {
  // Resolve renderer using priority chain: column → typeDefaults → adapter → built-in
  const viewRenderer = resolveRenderer(grid, col);
  if (viewRenderer) return renderViaRenderer(grid, cell, col, viewRenderer, value, rowData);

  if (col.externalView) {
    mountExternalView(grid, cell, col, value, rowData);
    return false;
  }

  const compiled = col.__compiledView;
  if (compiled) {
    const output = compiled({ row: rowData, value, field: col.field, column: col });
    const blocked = compiled.__blocked;
    // Sanitize compiled template output to prevent XSS
    if (blocked) {
      // Forcefully clear any residual whitespace text nodes for deterministic emptiness
      cell.textContent = '';
      cell.setAttribute('data-blocked-template', '');
    } else {
      setSanitizedHTML(cell, output);
    }
    return true;
  }

  const tplHolder = col.__viewTemplate;
  if (tplHolder) {
    const rawTpl = tplHolder.innerHTML;
    if (/Reflect\.|\bProxy\b|ownKeys\(/.test(rawTpl)) {
      cell.textContent = '';
      cell.setAttribute('data-blocked-template', '');
      return false;
    }
    // Sanitize inline template output to prevent XSS
    setSanitizedHTML(cell, evalTemplateString(rawTpl, { row: rowData, value }));
    return true;
  }

  renderPlainValue(cell, col, value, formatted);
  return false;
}

/** Post-render scrub for cells whose content came from `innerHTML`. */
function scrubRenderedCell(cell: HTMLElement, needsSanitization: boolean): void {
  // Only run expensive sanitization when we used innerHTML with user content
  if (needsSanitization) {
    finalCellScrub(cell);
    // Defensive: if forbidden tokens leaked via async or framework hydration, scrub again.
    const textContent = cell.textContent || '';
    if (/Proxy|Reflect\.ownKeys/.test(textContent)) {
      cell.textContent = textContent.replace(/Proxy|Reflect\.ownKeys/g, '').trim();
      if (/Proxy|Reflect\.ownKeys/.test(cell.textContent || '')) cell.textContent = '';
    }
  }
  // If anything at all remains (e.g. 'function () { [native code] }'), blank it.
  if (cell.hasAttribute('data-blocked-template') && (cell.textContent || '').trim().length) {
    cell.textContent = '';
  }
}

/**
 * Mark keyboard-navigable cells. Event handlers are wired by delegation in
 * `setupCellEventDelegation()`, so only tabindex is set here.
 */
function applyCellTabIndex(cell: HTMLElement, col: ColumnInternal, rowData: any): void {
  const isEditable = typeof col.editable === 'function' ? col.editable(rowData) : col.editable;
  if (isEditable) {
    cell.tabIndex = 0;
  } else if (col.type === 'boolean') {
    // Non-editable boolean cells must NOT toggle on space; they are read-only
    // and only need a tabindex for focus navigation.
    if (!cell.hasAttribute('tabindex')) cell.tabIndex = 0;
  }
}

/**
 * Full reconstruction of a row's set of cells including templated, external view, and formatted content.
 * Attaches event handlers for editing and accessibility per cell.
 */
export function renderInlineRow(grid: GridHost, rowEl: HTMLElement, rowData: any, rowIndex: number): void {
  clearRowForRebuild(grid, rowEl);

  // Pre-cache values used in the loop
  const columns = grid._visibleColumns;
  const colsLen = columns.length;
  const focusRow = grid._focusRow;
  const focusCol = grid._focusCol;

  // Check if any plugin wants cell-level hooks (avoid overhead when not needed)
  const hasCellHook = grid._hasAfterCellRenderHook?.() ?? false;

  // Use DocumentFragment for batch DOM insertion
  const fragment = document.createDocumentFragment();

  for (let colIndex = 0; colIndex < colsLen; colIndex++) {
    const col = columns[colIndex];
    const cell = buildCellElement(col, colIndex, rowIndex);

    let value = resolveCellValue(rowData, col, rowIndex);
    // Resolve format using priority chain: column → typeDefaults → adapter
    const formatFn = resolveFormat(grid, col);
    if (formatFn) {
      try {
        value = formatFn(value, rowData);
      } catch (e) {
        // Log format errors as warnings (user configuration issue)
        warnDiagnostic(FORMAT_ERROR, `Format error in column '${col.field}': ${e}`, grid.id);
      }
    }

    const needsSanitization = renderCellContent(grid, cell, col, value, rowData, !!formatFn);
    scrubRenderedCell(cell, needsSanitization);
    applyCellTabIndex(cell, col, rowData);

    // Initialize focus state (must match fastPatchRow for consistent behavior)
    if (focusRow === rowIndex && focusCol === colIndex) {
      cell.classList.add('cell-focus');
      cell.setAttribute('aria-selected', 'true');
    } else {
      cell.setAttribute('aria-selected', 'false');
    }

    // Apply cellClass callback if configured
    applyCellClass(grid, cell, col, rowData, rowIndex);

    // Call cell-level plugin hook if any plugin registered it
    if (hasCellHook) emitAfterCellRender(grid, rowEl, cell, col, colIndex, rowData, rowIndex, value);

    fragment.appendChild(cell);
  }

  // Single DOM operation to append all cells
  rowEl.appendChild(fragment);
}
// #endregion

// #region Interaction
/**
 * Handle click / double click interaction to focus cells.
 * Edit triggering is handled by EditingPlugin via onCellClick hook.
 */
export function handleRowClick(grid: GridHost, e: MouseEvent, rowEl: HTMLElement): void {
  if ((e.target as HTMLElement)?.closest('.resize-handle')) return;
  const firstCell = rowEl.querySelector('.cell[data-row]') as HTMLElement | null;
  const rowIndex = getRowIndexFromCell(firstCell);
  if (rowIndex < 0) return;
  const rowData = grid._rows[rowIndex];
  if (!rowData) return;

  // Dispatch row click to plugin system first (e.g., for master-detail expansion)
  if (grid._dispatchRowClick?.(e, rowIndex, rowData, rowEl)) {
    return;
  }

  const cellEl = (e.target as HTMLElement)?.closest('.cell[data-col]') as HTMLElement | null;
  if (cellEl) {
    const colIndex = Number(cellEl.getAttribute('data-col'));
    if (!isNaN(colIndex)) {
      // Dispatch to plugin system first - if handled (e.g., edit triggered), stop propagation
      if (grid._dispatchCellClick?.(e, rowIndex, colIndex, cellEl)) {
        return;
      }

      // Always update focus to the clicked cell
      const focusChanged = grid._focusRow !== rowIndex || grid._focusCol !== colIndex;
      grid._focusRow = rowIndex;
      grid._focusCol = colIndex;

      // If clicking an already-editing cell, just update focus styling and return
      if (cellEl.classList.contains(GridClasses.EDITING)) {
        if (focusChanged) {
          // Update .cell-focus class to reflect new focus (clear from grid element)
          clearCellFocus(grid._bodyEl ?? grid);
          cellEl.classList.add('cell-focus');
        }
        // Prefer the actual click target when it's a focusable element inside the
        // cell. This preserves user intent — e.g., clicking an <input> inside a
        // mat-chip-grid should focus that input, not the first chip row (which
        // also matches FOCUSABLE_EDITOR_SELECTOR via [tabindex]).
        const target = e.target as HTMLElement;
        const editor =
          cellEl.contains(target) && target.matches(FOCUSABLE_EDITOR_SELECTOR)
            ? target
            : (cellEl.querySelector(FOCUSABLE_EDITOR_SELECTOR) as HTMLElement | null);
        try {
          editor?.focus({ preventScroll: true });
        } catch {
          /* empty */
        }
        return;
      }

      ensureCellVisible(grid);
    }
  }
}
// #endregion
