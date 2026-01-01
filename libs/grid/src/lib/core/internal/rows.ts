import type { ColumnConfig, InternalGrid } from '../types';
import { addPart } from './columns';
import { commitCellValue, inlineEnterEdit, startRowEdit } from './editing';
import { ensureCellVisible } from './keyboard';
import { evalTemplateString, finalCellScrub, sanitizeHTML } from './sanitize';

/** Callback type for plugin row rendering hook */
export type RenderRowHook = (row: any, rowEl: HTMLElement, rowIndex: number) => boolean;

/**
 * Cell display value cache key on grid instance.
 * Structure: Map<rowIndex, Map<colIndex, displayString>>
 * This cache is invalidated when rows or columns change (epoch bump).
 */
const CELL_CACHE_KEY = '__cellDisplayCache';
const CELL_CACHE_EPOCH_KEY = '__cellCacheEpoch';

/**
 * Get the cached display value for a cell, computing it if not cached.
 * This is the hot path during scroll - must be as fast as possible.
 */
function getCellDisplayValue(
  grid: InternalGrid,
  rowIndex: number,
  colIndex: number,
  rowData: any,
  col: ColumnConfig<any>,
  epoch: number | undefined,
): string {
  // Fast path: check cache first
  let cache = (grid as any)[CELL_CACHE_KEY] as Map<number, string[]> | undefined;
  const cacheEpoch = (grid as any)[CELL_CACHE_EPOCH_KEY];

  // Invalidate cache if epoch changed
  if (cache && cacheEpoch !== epoch) {
    cache = undefined;
    (grid as any)[CELL_CACHE_KEY] = undefined;
  }

  if (!cache) {
    cache = new Map();
    (grid as any)[CELL_CACHE_KEY] = cache;
    (grid as any)[CELL_CACHE_EPOCH_KEY] = epoch;
  }

  let rowCache = cache.get(rowIndex);
  if (rowCache && rowCache[colIndex] !== undefined) {
    return rowCache[colIndex];
  }

  // Compute the display value
  const displayValue = computeCellDisplayValue(rowData, col);

  // Cache it
  if (!rowCache) {
    rowCache = [];
    cache.set(rowIndex, rowCache);
  }
  rowCache[colIndex] = displayValue;

  return displayValue;
}

/**
 * Compute the display string for a cell value.
 * Handles formatting, date conversion, boolean display, etc.
 */
function computeCellDisplayValue(rowData: any, col: ColumnConfig<any>): string {
  let value = rowData[col.field];

  // Apply format function if present
  const format = (col as any).format;
  if (format) {
    try {
      value = format(value, rowData);
    } catch {
      // Keep original value on format error
    }
  }

  // Type-specific conversion
  if (col.type === 'date') {
    if (value == null || value === '') return '';
    if (value instanceof Date) {
      return isNaN(value.getTime()) ? '' : value.toLocaleDateString();
    }
    if (typeof value === 'number' || typeof value === 'string') {
      const d = new Date(value);
      return isNaN(d.getTime()) ? '' : d.toLocaleDateString();
    }
    return '';
  }

  if (col.type === 'boolean') {
    return value ? '\u{1F5F9}' : '\u2610';
  }

  return value == null ? '' : String(value);
}

/**
 * Pre-compute display values for a range of rows.
 * Call this after rows change to warm the cache for visible + overscan rows.
 */
export function precomputeCellCache(
  grid: InternalGrid,
  startRow: number,
  endRow: number,
  epoch: number | undefined,
): void {
  const columns = grid.visibleColumns;
  const rows = grid._rows;

  for (let r = startRow; r < endRow && r < rows.length; r++) {
    const rowData = rows[r];
    if (!rowData) continue;
    for (let c = 0; c < columns.length; c++) {
      // This will compute and cache
      getCellDisplayValue(grid, r, c, rowData, columns[c], epoch);
    }
  }
}

/**
 * Invalidate the cell cache (call when rows or columns change).
 */
export function invalidateCellCache(grid: InternalGrid): void {
  (grid as any)[CELL_CACHE_KEY] = undefined;
  (grid as any)[CELL_CACHE_EPOCH_KEY] = undefined;
  (grid as any).__hasSpecialColumns = undefined; // Reset fast-path check
}

/**
 * Render / patch the visible window of rows [start, end) using a recyclable DOM pool.
 * Newly required row elements are created and appended; excess are detached.
 * Uses an epoch counter to force full row rebuilds when structural changes (like columns) occur.
 * @param renderRowHook - Optional callback that plugins can use to render custom rows (e.g., group rows).
 *                        If it returns true, default rendering is skipped for that row.
 */
export function renderVisibleRows(
  grid: InternalGrid,
  start: number,
  end: number,
  epoch?: number,
  renderRowHook?: RenderRowHook,
): void {
  const needed = Math.max(0, end - start);
  const bodyEl = grid.bodyEl;
  const columns = grid.visibleColumns;
  const colLen = columns.length;

  // Cache header row count once (check for group header row existence)
  let headerRowCount = (grid as any).__cachedHeaderRowCount;
  if (headerRowCount === undefined) {
    headerRowCount = grid.shadowRoot?.querySelector('.header-group-row') ? 2 : 1;
    (grid as any).__cachedHeaderRowCount = headerRowCount;
  }

  // Pool management: grow pool if needed
  while (grid.rowPool.length < needed) {
    const rowEl = document.createElement('div');
    rowEl.className = 'data-grid-row';
    rowEl.setAttribute('role', 'row');
    rowEl.addEventListener('click', (e) => handleRowClick(grid, e, rowEl, false));
    rowEl.addEventListener('dblclick', (e) => handleRowClick(grid, e, rowEl, true));
    grid.rowPool.push(rowEl);
  }

  // Remove excess pool elements from DOM and shrink pool
  if (grid.rowPool.length > needed) {
    for (let i = needed; i < grid.rowPool.length; i++) {
      const el = grid.rowPool[i];
      if (el.parentNode === bodyEl) el.remove();
    }
    grid.rowPool.length = needed;
  }

  // Check if any plugin has a renderRow hook (cache this)
  const hasRenderRowPlugins = renderRowHook && (grid as any).__hasRenderRowPlugins !== false;

  for (let i = 0; i < needed; i++) {
    const rowIndex = start + i;
    const rowData = grid._rows[rowIndex];
    const rowEl = grid.rowPool[i];

    // Always set aria-rowindex (1-based, accounting for header rows)
    rowEl.setAttribute('aria-rowindex', String(rowIndex + headerRowCount + 1));

    // Let plugins handle custom row rendering (e.g., group rows)
    if (hasRenderRowPlugins && renderRowHook!(rowData, rowEl, rowIndex)) {
      (rowEl as any).__epoch = epoch;
      (rowEl as any).__rowDataRef = rowData;
      if (rowEl.parentNode !== bodyEl) bodyEl.appendChild(rowEl);
      continue;
    }

    const rowEpoch = (rowEl as any).__epoch;
    const prevRef = (rowEl as any).__rowDataRef;
    const cellCount = rowEl.children.length;

    // Check if we need a full rebuild vs fast update
    const epochMatch = rowEpoch === epoch;
    const structureValid = epochMatch && cellCount === colLen;
    const dataRefChanged = prevRef !== rowData;

    // Need external view rebuild check when structure is valid but data changed
    let needsExternalRebuild = false;
    if (structureValid && dataRefChanged) {
      for (let c = 0; c < colLen; c++) {
        const col = columns[c];
        if ((col as any).externalView) {
          const cellCheck = rowEl.querySelector(`.cell[data-col="${c}"] [data-external-view]`);
          if (!cellCheck) {
            needsExternalRebuild = true;
            break;
          }
        }
      }
    }

    if (!structureValid || needsExternalRebuild) {
      // Full rebuild needed - epoch changed, cell count mismatch, or external view missing
      const hasEditingCell = rowEl.querySelector('.cell.editing');
      const isActivelyEditedRow = grid.activeEditRows === rowIndex;

      // If DOM element has editors but this is NOT the actively edited row, clear them
      // (This happens when virtualization recycles the DOM element for a different row)
      if (hasEditingCell && !isActivelyEditedRow) {
        // Force full rebuild to clear stale editors
        if ((rowEl as any).__isCustomRow) {
          rowEl.className = 'data-grid-row';
          rowEl.setAttribute('role', 'row');
          (rowEl as any).__isCustomRow = false;
        }
        renderInlineRow(grid, rowEl, rowData, rowIndex);
        (rowEl as any).__epoch = epoch;
        (rowEl as any).__rowDataRef = rowData;
      } else if (hasEditingCell && isActivelyEditedRow) {
        // Row is in editing mode AND this is the correct row - preserve editors
        fastPatchRow(grid, rowEl, rowData, rowIndex);
        (rowEl as any).__rowDataRef = rowData;
      } else {
        if ((rowEl as any).__isCustomRow) {
          rowEl.className = 'data-grid-row';
          rowEl.setAttribute('role', 'row');
          (rowEl as any).__isCustomRow = false;
        }
        renderInlineRow(grid, rowEl, rowData, rowIndex);
        (rowEl as any).__epoch = epoch;
        (rowEl as any).__rowDataRef = rowData;

        // If this is the actively edited row but DOM doesn't have editors, create them
        if (isActivelyEditedRow) {
          const children = rowEl.children;
          for (let c = 0; c < children.length; c++) {
            const col = grid.visibleColumns[c];
            if (col && (col as any).editable) {
              inlineEnterEdit(grid, rowData, rowIndex, col, children[c] as HTMLElement);
            }
          }
        }
      }
    } else if (dataRefChanged) {
      // Same structure, different row data - fast update
      const hasEditingCell = rowEl.querySelector('.cell.editing');
      const isActivelyEditedRow = grid.activeEditRows === rowIndex;

      // If DOM element has editors but this is NOT the actively edited row, clear them
      if (hasEditingCell && !isActivelyEditedRow) {
        renderInlineRow(grid, rowEl, rowData, rowIndex);
        (rowEl as any).__epoch = epoch;
        (rowEl as any).__rowDataRef = rowData;
      } else {
        fastPatchRow(grid, rowEl, rowData, rowIndex);
        (rowEl as any).__rowDataRef = rowData;

        // If this is the actively edited row but DOM doesn't have editors, create them
        if (isActivelyEditedRow && !hasEditingCell) {
          const children = rowEl.children;
          for (let c = 0; c < children.length; c++) {
            const col = grid.visibleColumns[c];
            if (col && (col as any).editable) {
              inlineEnterEdit(grid, rowData, rowIndex, col, children[c] as HTMLElement);
            }
          }
        }
      }
    } else {
      // Same row data reference - just patch if any values changed
      const hasEditingCell = rowEl.querySelector('.cell.editing');
      const isActivelyEditedRow = grid.activeEditRows === rowIndex;

      // If DOM element has editors but this is NOT the actively edited row, clear them
      if (hasEditingCell && !isActivelyEditedRow) {
        renderInlineRow(grid, rowEl, rowData, rowIndex);
        (rowEl as any).__epoch = epoch;
        (rowEl as any).__rowDataRef = rowData;
      } else {
        fastPatchRow(grid, rowEl, rowData, rowIndex);

        // If this is the actively edited row but DOM doesn't have editors, create them
        if (isActivelyEditedRow && !hasEditingCell) {
          const children = rowEl.children;
          for (let c = 0; c < children.length; c++) {
            const col = grid.visibleColumns[c];
            if (col && (col as any).editable) {
              inlineEnterEdit(grid, rowData, rowIndex, col, children[c] as HTMLElement);
            }
          }
        }
      }
    }

    // Changed class toggle
    const isChanged = grid._changedRowIndices.has(rowIndex);
    const hasChangedClass = rowEl.classList.contains('changed');
    if (isChanged !== hasChangedClass) {
      rowEl.classList.toggle('changed', isChanged);
    }

    if (rowEl.parentNode !== bodyEl) bodyEl.appendChild(rowEl);
  }
}

/**
 * Fast patch path for an already-rendered row: updates plain text cells whose data changed
 * while skipping cells with external views, templates, or active editors.
 *
 * Optimized for scroll performance - avoids querySelectorAll in favor of children access.
 */
function fastPatchRow(grid: InternalGrid, rowEl: HTMLElement, rowData: any, rowIndex: number): void {
  const children = rowEl.children;
  const columns = grid.visibleColumns;
  const colsLen = columns.length;
  const childLen = children.length;
  const minLen = colsLen < childLen ? colsLen : childLen;
  const focusRow = grid.focusRow;
  const focusCol = grid.focusCol;

  // Ultra-fast path: if no special columns (templates, formatters, etc.), use direct assignment
  // Check is cached on grid to avoid repeated iteration
  let hasSpecialCols = (grid as any).__hasSpecialColumns;
  if (hasSpecialCols === undefined) {
    hasSpecialCols = false;
    for (let i = 0; i < colsLen; i++) {
      const col = columns[i] as any;
      if (
        col.__viewTemplate ||
        col.__compiledView ||
        col.viewRenderer ||
        col.externalView ||
        col.format ||
        col.type === 'date' ||
        col.type === 'boolean'
      ) {
        hasSpecialCols = true;
        break;
      }
    }
    (grid as any).__hasSpecialColumns = hasSpecialCols;
  }

  const rowIndexStr = String(rowIndex);

  // Ultra-fast path for plain text grids - just set textContent directly
  if (!hasSpecialCols) {
    for (let i = 0; i < minLen; i++) {
      const cell = children[i] as HTMLElement;
      const value = rowData[columns[i].field];
      cell.textContent = value == null ? '' : String(value);
      // Update data-row for click handling
      if (cell.getAttribute('data-row') !== rowIndexStr) {
        cell.setAttribute('data-row', rowIndexStr);
      }
      // Update focus state - must be data-driven, not DOM-element-driven
      const shouldHaveFocus = focusRow === rowIndex && focusCol === i;
      const hasFocus = cell.classList.contains('cell-focus');
      if (shouldHaveFocus !== hasFocus) {
        cell.classList.toggle('cell-focus', shouldHaveFocus);
        // aria-selected only valid for gridcell, not checkbox (but ultra-fast path has no special cols)
        cell.setAttribute('aria-selected', String(shouldHaveFocus));
      }
    }
    return;
  }

  // Check if any external view placeholder is missing - if so, do full rebuild
  for (let i = 0; i < minLen; i++) {
    const col = columns[i] as any;
    if (col.externalView) {
      const cell = children[i] as HTMLElement;
      if (!cell.querySelector('[data-external-view]')) {
        renderInlineRow(grid, rowEl, rowData, rowIndex);
        return;
      }
    }
  }

  // Standard path for grids with special columns
  for (let i = 0; i < minLen; i++) {
    const col = columns[i] as any;
    const cell = children[i] as HTMLElement;

    // Update data-row for click handling
    if (cell.getAttribute('data-row') !== rowIndexStr) {
      cell.setAttribute('data-row', rowIndexStr);
    }

    // Update focus state - must be data-driven, not DOM-element-driven
    const shouldHaveFocus = focusRow === rowIndex && focusCol === i;
    const hasFocus = cell.classList.contains('cell-focus');
    if (shouldHaveFocus !== hasFocus) {
      cell.classList.toggle('cell-focus', shouldHaveFocus);
      cell.setAttribute('aria-selected', String(shouldHaveFocus));
    }

    // Skip cells in edit mode
    if (cell.classList.contains('editing')) continue;

    // Handle viewRenderer - must re-invoke to get updated content
    if (col.viewRenderer) {
      const value = rowData[col.field];
      const produced = col.viewRenderer({ row: rowData, value, field: col.field, column: col });
      if (typeof produced === 'string') {
        cell.innerHTML = sanitizeHTML(produced);
      } else if (produced) {
        cell.innerHTML = '';
        cell.appendChild(produced);
      } else {
        cell.textContent = value == null ? '' : String(value);
      }
      continue;
    }

    // Skip templated / external cells (these need full rebuild to remount)
    if (col.__viewTemplate || col.__compiledView || col.externalView) {
      continue;
    }

    // Compute and set display value
    const value = rowData[col.field];
    let displayStr: string;

    if (col.format) {
      try {
        const formatted = col.format(value, rowData);
        displayStr = formatted == null ? '' : String(formatted);
      } catch {
        displayStr = value == null ? '' : String(value);
      }
    } else if (col.type === 'date') {
      if (value == null || value === '') {
        displayStr = '';
      } else if (value instanceof Date) {
        displayStr = isNaN(value.getTime()) ? '' : value.toLocaleDateString();
      } else {
        const d = new Date(value);
        displayStr = isNaN(d.getTime()) ? '' : d.toLocaleDateString();
      }
      cell.textContent = displayStr;
    } else if (col.type === 'boolean') {
      const isTrue = !!value;
      // Boolean cells have inner span with checkbox role for ARIA compliance
      cell.innerHTML = `<span role="checkbox" aria-checked="${isTrue}" aria-label="${isTrue}">${isTrue ? '&#x1F5F9;' : '&#9744;'}</span>`;
    } else {
      displayStr = value == null ? '' : String(value);
      cell.textContent = displayStr;
    }
  }
}

/**
 * Full reconstruction of a row's set of cells including templated, external view, and formatted content.
 * Attaches event handlers for editing and accessibility per cell.
 */
export function renderInlineRow(grid: InternalGrid, rowEl: HTMLElement, rowData: any, rowIndex: number): void {
  rowEl.innerHTML = '';

  // Pre-cache values used in the loop
  const columns = grid.visibleColumns;
  const colsLen = columns.length;
  const focusRow = grid.focusRow;
  const focusCol = grid.focusCol;
  const editMode = (grid as any).effectiveConfig?.editOn || grid.editOn;
  const gridEl = grid as unknown as HTMLElement;

  // Use DocumentFragment for batch DOM insertion
  const fragment = document.createDocumentFragment();

  for (let colIndex = 0; colIndex < colsLen; colIndex++) {
    const col: ColumnConfig<any> = columns[colIndex];
    const cell = document.createElement('div');
    cell.className = 'cell';
    addPart(cell, 'cell');

    // All cells get role=gridcell (required by role=row)
    cell.setAttribute('role', 'gridcell');
    // aria-colindex is 1-based
    cell.setAttribute('aria-colindex', String(colIndex + 1));
    cell.setAttribute('data-col', String(colIndex));
    cell.setAttribute('data-row', String(rowIndex));
    const isCheckbox = col.type === 'boolean';
    if (col.type) cell.setAttribute('data-type', col.type as any);

    // Apply sticky class if column has sticky property
    const sticky = (col as any).sticky;
    if (sticky === 'left') {
      cell.classList.add('sticky-left');
    } else if (sticky === 'right') {
      cell.classList.add('sticky-right');
    }

    let value = (rowData as any)[col.field];
    const format = (col as any).format;
    if (format) {
      try {
        value = format(value, rowData);
      } catch {
        /* empty */
      }
    }

    const compiled = (col as any).__compiledView as ((ctx: any) => string) | undefined;
    const tplHolder = (col as any).__viewTemplate as HTMLElement | undefined;
    const viewRenderer = (col as any).viewRenderer;
    const externalView = (col as any).externalView;

    // Track if we used a template that needs sanitization
    let needsSanitization = false;

    if (viewRenderer) {
      const produced = viewRenderer({ row: rowData, value, field: col.field, column: col });
      if (typeof produced === 'string') {
        // Sanitize HTML from viewRenderer to prevent XSS from user-controlled data
        cell.innerHTML = sanitizeHTML(produced);
        needsSanitization = true;
      } else if (produced) cell.appendChild(produced);
      else cell.textContent = value == null ? '' : String(value);
    } else if (externalView) {
      const spec = externalView;
      const placeholder = document.createElement('div');
      placeholder.setAttribute('data-external-view', '');
      placeholder.setAttribute('data-field', col.field);
      cell.appendChild(placeholder);
      const context = { row: rowData, value, field: col.field, column: col };
      if (spec.mount) {
        try {
          spec.mount({ placeholder, context, spec });
        } catch {
          /* empty */
        }
      } else {
        queueMicrotask(() => {
          try {
            gridEl.dispatchEvent(
              new CustomEvent('mount-external-view', {
                bubbles: true,
                composed: true,
                detail: { placeholder, spec, context },
              }),
            );
          } catch {
            /* empty */
          }
        });
      }
      placeholder.setAttribute('data-mounted', '');
    } else if (compiled) {
      const output = compiled({ row: rowData, value, field: col.field, column: col });
      const blocked = (compiled as any).__blocked;
      // Sanitize compiled template output to prevent XSS
      cell.innerHTML = blocked ? '' : sanitizeHTML(output);
      needsSanitization = true;
      if (blocked) {
        // Forcefully clear any residual whitespace text nodes for deterministic emptiness
        cell.textContent = '';
        cell.setAttribute('data-blocked-template', '');
      }
    } else if (tplHolder) {
      const rawTpl = tplHolder.innerHTML;
      if (/Reflect\.|\bProxy\b|ownKeys\(/.test(rawTpl)) {
        cell.textContent = '';
        cell.setAttribute('data-blocked-template', '');
      } else {
        // Sanitize inline template output to prevent XSS
        cell.innerHTML = sanitizeHTML(evalTemplateString(rawTpl, { row: rowData, value }));
        needsSanitization = true;
      }
    } else {
      // Plain value rendering - compute display directly (matches Stencil performance)
      if (col.type === 'date') {
        if (value == null || value === '') {
          cell.textContent = '';
        } else {
          let d: Date | null = null;
          if (value instanceof Date) d = value;
          else if (typeof value === 'number' || typeof value === 'string') {
            const tentative = new Date(value);
            if (!isNaN(tentative.getTime())) d = tentative;
          }
          cell.textContent = d ? d.toLocaleDateString() : '';
        }
      } else if (col.type === 'boolean') {
        const isTrue = !!value;
        // Wrap checkbox in span to satisfy ARIA: gridcell can contain checkbox
        cell.innerHTML = `<span role="checkbox" aria-checked="${isTrue}" aria-label="${isTrue}">${isTrue ? '&#x1F5F9;' : '&#9744;'}</span>`;
      } else {
        cell.textContent = value == null ? '' : String(value);
      }
    }

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

    if (cell.hasAttribute('data-blocked-template')) {
      // If anything at all remains (e.g., 'function () { [native code] }'), blank it completely.
      if ((cell.textContent || '').trim().length) cell.textContent = '';
    }
    if ((col as any).editable) {
      cell.tabIndex = 0;
      cell.addEventListener('mousedown', () => {
        // Skip if cell is already in editing mode - avoid refreshVirtualWindow wiping editors
        if (cell.classList.contains('editing')) return;
        // Read row/col index from data attributes to handle virtualization row reuse
        const currentRowIndex = Number(cell.getAttribute('data-row'));
        const currentColIndex = Number(cell.getAttribute('data-col'));
        if (isNaN(currentRowIndex) || isNaN(currentColIndex)) return;
        grid.focusRow = currentRowIndex;
        grid.focusCol = currentColIndex;
        ensureCellVisible(grid);
      });
      if (editMode === 'click') {
        cell.addEventListener('click', (e) => {
          if (cell.classList.contains('editing')) return;
          e.stopPropagation();
          // Read row/col index from data attributes to handle virtualization row reuse
          const currentRowIndex = Number(cell.getAttribute('data-row'));
          const currentColIndex = Number(cell.getAttribute('data-col'));
          if (isNaN(currentRowIndex) || isNaN(currentColIndex)) return;
          const currentRowData = grid._rows[currentRowIndex];
          const currentCol = grid.visibleColumns[currentColIndex];
          if (!currentRowData || !currentCol) return;
          grid.focusRow = currentRowIndex;
          grid.focusCol = currentColIndex;
          inlineEnterEdit(grid, currentRowData, currentRowIndex, currentCol, cell);
        });
      } else {
        cell.addEventListener('dblclick', (e) => {
          e.stopPropagation();
          // Read row index from data attribute to handle virtualization row reuse
          const currentRowIndex = Number(cell.getAttribute('data-row'));
          if (isNaN(currentRowIndex)) return;
          const currentRowData = grid._rows[currentRowIndex];
          if (!currentRowData) return;
          startRowEdit(grid, currentRowIndex, currentRowData);
          const rowElCurrent = grid.findRenderedRowElement?.(currentRowIndex);
          if (rowElCurrent) {
            const children = rowElCurrent.children;
            for (let i = 0; i < children.length; i++) {
              const col2 = grid.visibleColumns[i];
              if (col2 && (col2 as any).editable)
                inlineEnterEdit(grid, currentRowData, currentRowIndex, col2, children[i] as HTMLElement);
            }
          }
        });
      }
      cell.addEventListener('keydown', (e) => {
        // Read row/col index from data attributes to handle virtualization row reuse
        const currentRowIndex = Number(cell.getAttribute('data-row'));
        const currentColIndex = Number(cell.getAttribute('data-col'));
        if (isNaN(currentRowIndex) || isNaN(currentColIndex)) return;
        const currentRowData = grid._rows[currentRowIndex];
        const currentCol = grid.visibleColumns[currentColIndex];
        if (!currentRowData || !currentCol) return;
        if (
          (currentCol.type === 'select' || currentCol.type === 'typeahead') &&
          !cell.classList.contains('editing') &&
          e.key === 'Enter'
        ) {
          e.preventDefault();
          if (grid.activeEditRows !== currentRowIndex) startRowEdit(grid, currentRowIndex, currentRowData);
          inlineEnterEdit(grid, currentRowData, currentRowIndex, currentCol, cell);
          setTimeout(() => {
            const selectEl = cell.querySelector('select') as HTMLSelectElement | null;
            try {
              (selectEl as any)?.showPicker?.();
            } catch {
              /* empty */
            }
            selectEl?.focus();
          }, 0);
          return;
        }
        if (currentCol.type === 'boolean' && e.key === ' ' && !cell.classList.contains('editing')) {
          e.preventDefault();
          if (grid.activeEditRows !== currentRowIndex) startRowEdit(grid, currentRowIndex, currentRowData);
          const newVal = !currentRowData[currentCol.field];
          commitCellValue(grid, currentRowIndex, currentCol, newVal, currentRowData);
          cell.innerHTML = `<span role="checkbox" aria-checked="${newVal}" aria-label="${newVal}">${newVal ? '&#x1F5F9;' : '&#9744;'}</span>`;
          return;
        }
        if (e.key === 'Enter' && !cell.classList.contains('editing')) {
          e.preventDefault();
          e.stopPropagation(); // Prevent grid-level handler from also processing Enter
          grid.focusRow = currentRowIndex;
          grid.focusCol = currentColIndex;
          if (typeof grid.beginBulkEdit === 'function') grid.beginBulkEdit(currentRowIndex);
          else inlineEnterEdit(grid, currentRowData, currentRowIndex, currentCol, cell);
          return;
        }
        if (e.key === 'F2' && !cell.classList.contains('editing')) {
          e.preventDefault();
          inlineEnterEdit(grid, currentRowData, currentRowIndex, currentCol, cell);
          return;
        }
      });
    } else if (col.type === 'boolean') {
      // Non-editable boolean cells should NOT toggle on space key
      // They are read-only, only set tabindex for focus navigation
      if (!cell.hasAttribute('tabindex')) cell.tabIndex = 0;
    }

    // Initialize selection attributes (valid for gridcell)
    if (focusRow === rowIndex && focusCol === colIndex) cell.setAttribute('aria-selected', 'true');
    else cell.setAttribute('aria-selected', 'false');

    fragment.appendChild(cell);
  }

  // Single DOM operation to append all cells
  rowEl.appendChild(fragment);
}

/**
 * Handle click / double click interaction to focus cells and optionally start row editing
 * according to the grid's configured edit activation mode.
 */
export function handleRowClick(grid: InternalGrid, e: MouseEvent, rowEl: HTMLElement, isDbl: boolean): void {
  if ((e.target as HTMLElement)?.closest('.resize-handle')) return;
  const firstCell = rowEl.querySelector('.cell[data-row]') as HTMLElement | null;
  if (!firstCell) return;
  const rowIndex = Number(firstCell.getAttribute('data-row'));
  if (isNaN(rowIndex)) return;
  const rowData = grid._rows[rowIndex];
  if (!rowData) return;
  const cellEl = (e.target as HTMLElement)?.closest('.cell[data-col]') as HTMLElement | null;
  if (cellEl) {
    // Skip focus/ensureCellVisible if cell is already editing - avoid wiping editors
    if (cellEl.classList.contains('editing')) return;
    const colIndex = Number(cellEl.getAttribute('data-col'));
    if (!isNaN(colIndex)) {
      // Dispatch to plugin system first - if handled, stop propagation
      if (grid.dispatchCellClick?.(e, rowIndex, colIndex, cellEl)) {
        return;
      }
      grid.focusRow = rowIndex;
      grid.focusCol = colIndex;
      ensureCellVisible(grid);
    }
  }
  if (rowEl.querySelector('.cell.editing')) {
    const active = rowEl.querySelectorAll('.cell.editing');
    if (!isDbl) return;
    active.forEach((n: any) => n.classList.remove('editing'));
  }
  const mode: 'click' | 'doubleClick' = ((grid as any).effectiveConfig?.editOn || grid.editOn || 'doubleClick') as any;
  if (mode === 'click' || (mode === 'doubleClick' && isDbl)) startRowEdit(grid, rowIndex, rowData);
  else return;
  Array.from(rowEl.children).forEach((c: any, i: number) => {
    const col = grid.visibleColumns[i];
    if (col && (col as any).editable) inlineEnterEdit(grid, rowData, rowIndex, col, c as HTMLElement);
  });
  if (cellEl) {
    queueMicrotask(() => {
      const targetCell = rowEl.querySelector(`.cell[data-col="${grid.focusCol}"]`);
      if (targetCell?.classList.contains('editing')) {
        const editor = (targetCell as HTMLElement).querySelector(
          'input,select,textarea,[contenteditable="true"],[contenteditable=""],[tabindex]:not([tabindex="-1"])',
        ) as HTMLElement | null;
        try {
          editor?.focus();
        } catch {
          /* empty */
        }
      }
    });
  }
}
