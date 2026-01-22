import type { ColumnInternal, ColumnViewRenderer, InternalGrid, RowElementInternal } from '../types';
import { ensureCellVisible } from './keyboard';
import { evalTemplateString, finalCellScrub, sanitizeHTML } from './sanitize';
import { booleanCellHTML, clearCellFocus, formatDateValue, getRowIndexFromCell } from './utils';

/** Callback type for plugin row rendering hook */
export type RenderRowHook = (row: any, rowEl: HTMLElement, rowIndex: number) => boolean;

// ============================================================================
// Type Defaults Resolution
// ============================================================================

/**
 * Resolves the renderer for a column using the priority chain:
 * 1. Column-level (`column.renderer` / `column.viewRenderer`)
 * 2. Grid-level (`gridConfig.typeDefaults[column.type]`)
 * 3. App-level (framework adapter's `getTypeDefault`)
 * 4. Returns undefined (caller uses built-in or fallback)
 */
export function resolveRenderer<TRow>(
  grid: InternalGrid<TRow>,
  col: ColumnInternal<TRow>,
): ColumnViewRenderer<TRow, unknown> | undefined {
  // 1. Column-level renderer (highest priority)
  const columnRenderer = col.renderer || col.viewRenderer;
  if (columnRenderer) return columnRenderer;

  // No type specified - no type defaults to check
  if (!col.type) return undefined;

  // 2. Grid-level typeDefaults (access via effectiveConfig)
  const gridTypeDefaults = (grid as any).effectiveConfig?.typeDefaults;
  if (gridTypeDefaults?.[col.type]?.renderer) {
    return gridTypeDefaults[col.type].renderer;
  }

  // 3. App-level registry (via framework adapter)
  const adapter = grid.__frameworkAdapter;
  if (adapter?.getTypeDefault) {
    const appDefault = adapter.getTypeDefault<TRow>(col.type);
    if (appDefault?.renderer) {
      return appDefault.renderer;
    }
  }

  // 4. No custom renderer - caller uses built-in/fallback
  return undefined;
}

// ============================================================================
// DOM State Helpers (used for virtualization cleanup)
// ============================================================================

/**
 * CSS selector for focusable editor elements within a cell.
 * Used by EditingPlugin and keyboard navigation.
 */
export const FOCUSABLE_EDITOR_SELECTOR =
  'input,select,textarea,[contenteditable="true"],[contenteditable=""],[tabindex]:not([tabindex="-1"])';

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
  const cells = rowEl.querySelectorAll('.cell.editing');
  cells.forEach((cell) => cell.classList.remove('editing'));
}

// ============== Template Cloning System ==============
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

// ============== End Template Cloning System ==============

/**
 * Invalidate the cell cache (call when rows or columns change).
 */
export function invalidateCellCache(grid: InternalGrid): void {
  grid.__cellDisplayCache = undefined;
  grid.__cellCacheEpoch = undefined;
  grid.__hasSpecialColumns = undefined; // Reset fast-path check
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
  const bodyEl = grid._bodyEl;
  const columns = grid._visibleColumns;
  const colLen = columns.length;

  // Cache header row count once (check for group header row existence)
  let headerRowCount = grid.__cachedHeaderRowCount;
  if (headerRowCount === undefined) {
    headerRowCount = grid.querySelector('.header-group-row') ? 2 : 1;
    grid.__cachedHeaderRowCount = headerRowCount;
  }

  // Pool management: grow pool if needed
  // Note: click/dblclick handlers are delegated at grid level for efficiency
  while (grid._rowPool.length < needed) {
    // Use template cloning - 3-4x faster than createElement + setAttribute
    const rowEl = createRowFromTemplate();
    grid._rowPool.push(rowEl);
  }

  // Remove excess pool elements from DOM and shrink pool
  if (grid._rowPool.length > needed) {
    for (let i = needed; i < grid._rowPool.length; i++) {
      const el = grid._rowPool[i];
      if (el.parentNode === bodyEl) el.remove();
    }
    grid._rowPool.length = needed;
  }

  // Check if any plugin has a renderRow hook (cache this)
  const hasRenderRowPlugins = renderRowHook && grid.__hasRenderRowPlugins !== false;

  for (let i = 0; i < needed; i++) {
    const rowIndex = start + i;
    const rowData = grid._rows[rowIndex];
    const rowEl = grid._rowPool[i] as RowElementInternal;

    // Always set aria-rowindex (1-based, accounting for header rows)
    rowEl.setAttribute('aria-rowindex', String(rowIndex + headerRowCount + 1));

    // Let plugins handle custom row rendering (e.g., group rows)
    if (hasRenderRowPlugins && renderRowHook!(rowData, rowEl, rowIndex)) {
      rowEl.__epoch = epoch;
      rowEl.__rowDataRef = rowData;
      if (rowEl.parentNode !== bodyEl) bodyEl.appendChild(rowEl);
      continue;
    }

    const rowEpoch = rowEl.__epoch;
    const prevRef = rowEl.__rowDataRef;
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
        if (col.externalView) {
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
      // Use cached editing state for O(1) check instead of querySelector
      const hasEditing = hasEditingCells(rowEl);
      const isActivelyEditedRow = grid._activeEditRows === rowIndex;

      // If DOM element has editors but this is NOT the actively edited row, clear them
      // (This happens when virtualization recycles the DOM element for a different row)
      if (hasEditing && !isActivelyEditedRow) {
        // Force full rebuild to clear stale editors
        if (rowEl.__isCustomRow) {
          rowEl.className = 'data-grid-row';
          rowEl.setAttribute('role', 'row');
          rowEl.__isCustomRow = false;
        }
        clearEditingState(rowEl); // Clear editing state before rebuild
        renderInlineRow(grid, rowEl, rowData, rowIndex);
        rowEl.__epoch = epoch;
        rowEl.__rowDataRef = rowData;
      } else if (hasEditing && isActivelyEditedRow) {
        // Row is in editing mode AND this is the correct row - preserve editors
        fastPatchRow(grid, rowEl, rowData, rowIndex);
        rowEl.__rowDataRef = rowData;
      } else {
        if (rowEl.__isCustomRow) {
          rowEl.className = 'data-grid-row';
          rowEl.setAttribute('role', 'row');
          rowEl.__isCustomRow = false;
        }
        renderInlineRow(grid, rowEl, rowData, rowIndex);
        rowEl.__epoch = epoch;
        rowEl.__rowDataRef = rowData;
        // NOTE: If this is the actively edited row, EditingPlugin's onScrollRender() will inject editors
      }
    } else if (dataRefChanged) {
      // Same structure, different row data - fast update
      // Use cached editing state for O(1) check instead of querySelector
      const hasEditing = hasEditingCells(rowEl);
      const isActivelyEditedRow = grid._activeEditRows === rowIndex;

      // If DOM element has editors but this is NOT the actively edited row, clear them
      if (hasEditing && !isActivelyEditedRow) {
        clearEditingState(rowEl); // Clear editing state before rebuild
        renderInlineRow(grid, rowEl, rowData, rowIndex);
        rowEl.__epoch = epoch;
        rowEl.__rowDataRef = rowData;
      } else {
        fastPatchRow(grid, rowEl, rowData, rowIndex);
        rowEl.__rowDataRef = rowData;
        // NOTE: If this is the actively edited row, EditingPlugin's onScrollRender() will inject editors
      }
    } else {
      // Same row data reference - just patch if any values changed
      // Use cached editing state for O(1) check instead of querySelector
      const hasEditing = hasEditingCells(rowEl);
      const isActivelyEditedRow = grid._activeEditRows === rowIndex;

      // If DOM element has editors but this is NOT the actively edited row, clear them
      if (hasEditing && !isActivelyEditedRow) {
        clearEditingState(rowEl); // Clear editing state before rebuild
        renderInlineRow(grid, rowEl, rowData, rowIndex);
        rowEl.__epoch = epoch;
        rowEl.__rowDataRef = rowData;
      } else {
        fastPatchRow(grid, rowEl, rowData, rowIndex);
        // NOTE: If this is the actively edited row, EditingPlugin's onScrollRender() will inject editors
      }
    }

    // Changed class toggle - check if row ID is in changedRowIds Set (EditingPlugin)
    let isChanged = false;
    const changedRowIds = grid.changedRowIds;
    if (changedRowIds && changedRowIds.length > 0) {
      try {
        const rowId = grid.getRowId?.(rowData);
        if (rowId) {
          isChanged = changedRowIds.includes(rowId);
        }
      } catch {
        // Row has no ID - not tracked as changed
      }
    }
    const hasChangedClass = rowEl.classList.contains('changed');
    if (isChanged !== hasChangedClass) {
      rowEl.classList.toggle('changed', isChanged);
    }

    // Apply rowClass callback if configured
    const rowClassFn = grid.effectiveConfig?.rowClass;
    if (rowClassFn) {
      // Remove previous dynamic classes (stored in data attribute)
      const prevClasses = rowEl.getAttribute('data-dynamic-classes');
      if (prevClasses) {
        prevClasses.split(' ').forEach((cls) => cls && rowEl.classList.remove(cls));
      }
      try {
        const newClasses = rowClassFn(rowData);
        if (newClasses && newClasses.length > 0) {
          const validClasses = newClasses.filter((c) => c && typeof c === 'string');
          validClasses.forEach((cls) => rowEl.classList.add(cls));
          rowEl.setAttribute('data-dynamic-classes', validClasses.join(' '));
        } else {
          rowEl.removeAttribute('data-dynamic-classes');
        }
      } catch (e) {
        console.warn(`[tbw-grid] rowClass callback error:`, e);
        rowEl.removeAttribute('data-dynamic-classes');
      }
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
  const columns = grid._visibleColumns;
  const colsLen = columns.length;
  const childLen = children.length;
  const minLen = colsLen < childLen ? colsLen : childLen;
  const focusRow = grid._focusRow;
  const focusCol = grid._focusCol;

  // Ultra-fast path: if no special columns (templates, formatters, etc.), use direct assignment
  // Check is cached on grid to avoid repeated iteration
  let hasSpecialCols = grid.__hasSpecialColumns;
  if (hasSpecialCols === undefined) {
    hasSpecialCols = false;
    const typeDefaults = (grid as any).effectiveConfig?.typeDefaults;
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
        col.type === 'date' ||
        col.type === 'boolean' ||
        // Check for type-level renderers (grid-level or adapter-level)
        (col.type && typeDefaults?.[col.type]?.renderer) ||
        (col.type && adapter?.getTypeDefault?.(col.type)?.renderer)
      ) {
        hasSpecialCols = true;
        break;
      }
    }
    grid.__hasSpecialColumns = hasSpecialCols;
  }

  const rowIndexStr = String(rowIndex);

  // Ultra-fast path for plain text grids - just set textContent directly
  if (!hasSpecialCols) {
    for (let i = 0; i < minLen; i++) {
      const cell = children[i] as HTMLElement;

      // Skip cells in edit mode - they have editors that must be preserved
      if (cell.classList.contains('editing')) continue;

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
    const col = columns[i];
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
    const col = columns[i];
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

    // Apply cellClass callback if configured
    const cellClassFn = col.cellClass;
    if (cellClassFn) {
      // Remove previous dynamic classes
      const prevClasses = cell.getAttribute('data-dynamic-classes');
      if (prevClasses) {
        prevClasses.split(' ').forEach((cls) => cls && cell.classList.remove(cls));
      }
      try {
        const value = rowData[col.field];
        const cellClasses = cellClassFn(value, rowData, col);
        if (cellClasses && cellClasses.length > 0) {
          const validClasses = cellClasses.filter((c: string) => c && typeof c === 'string');
          validClasses.forEach((cls: string) => cell.classList.add(cls));
          cell.setAttribute('data-dynamic-classes', validClasses.join(' '));
        } else {
          cell.removeAttribute('data-dynamic-classes');
        }
      } catch (e) {
        console.warn(`[tbw-grid] cellClass callback error for column '${col.field}':`, e);
        cell.removeAttribute('data-dynamic-classes');
      }
    }

    // Skip cells in edit mode
    if (cell.classList.contains('editing')) continue;

    // Handle viewRenderer/renderer - must re-invoke to get updated content
    // Uses priority chain: column → typeDefaults → adapter → built-in
    const cellRenderer = resolveRenderer(grid, col);
    if (cellRenderer) {
      const value = rowData[col.field];
      // Pass cellEl for framework adapters that want to cache per-cell
      const produced = cellRenderer({ row: rowData, value, field: col.field, column: col, cellEl: cell });
      if (typeof produced === 'string') {
        cell.innerHTML = sanitizeHTML(produced);
      } else if (produced instanceof Node) {
        // Check if this container is already a child of the cell (reused by framework adapter)
        if (produced.parentElement !== cell) {
          cell.innerHTML = '';
          cell.appendChild(produced);
        }
        // If already a child, the framework adapter has re-rendered in place
      } else if (produced == null) {
        // Renderer returned null/undefined - show raw value
        cell.textContent = value == null ? '' : String(value);
      }
      // If produced is truthy but not a string or Node, the framework handles it
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
      } catch (e) {
        // Log format errors as warnings (user configuration issue)
        console.warn(`[tbw-grid] Format error in column '${col.field}':`, e);
        displayStr = value == null ? '' : String(value);
      }
    } else if (col.type === 'date') {
      displayStr = formatDateValue(value);
      cell.textContent = displayStr;
    } else if (col.type === 'boolean') {
      // Boolean cells have inner span with checkbox role for ARIA compliance
      cell.innerHTML = booleanCellHTML(!!value);
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
  const columns = grid._visibleColumns;
  const colsLen = columns.length;
  const focusRow = grid._focusRow;
  const focusCol = grid._focusCol;
  const gridEl = grid as unknown as HTMLElement;

  // Use DocumentFragment for batch DOM insertion
  const fragment = document.createDocumentFragment();

  for (let colIndex = 0; colIndex < colsLen; colIndex++) {
    const col = columns[colIndex];
    // Use template cloning - 3-4x faster than createElement + setAttribute
    const cell = createCellFromTemplate();

    // Only set dynamic attributes (role, class, part are already set in template)
    // aria-colindex is 1-based
    cell.setAttribute('aria-colindex', String(colIndex + 1));
    cell.setAttribute('data-col', String(colIndex));
    cell.setAttribute('data-row', String(rowIndex));
    cell.setAttribute('data-field', col.field); // Field name for column identification
    cell.setAttribute('data-header', col.header ?? col.field); // Header text for responsive CSS
    if (col.type) cell.setAttribute('data-type', col.type);

    let value = (rowData as Record<string, unknown>)[col.field];
    if (col.format) {
      try {
        value = col.format(value, rowData);
      } catch (e) {
        // Log format errors as warnings (user configuration issue)
        console.warn(`[tbw-grid] Format error in column '${col.field}':`, e);
      }
    }

    const compiled = col.__compiledView;
    const tplHolder = col.__viewTemplate;
    // Resolve renderer using priority chain: column → typeDefaults → adapter → built-in
    const viewRenderer = resolveRenderer(grid, col);
    const externalView = col.externalView;

    // Track if we used a template that needs sanitization
    let needsSanitization = false;

    if (viewRenderer) {
      // Pass cellEl for framework adapters that want to cache per-cell
      const produced = viewRenderer({ row: rowData, value, field: col.field, column: col, cellEl: cell });
      if (typeof produced === 'string') {
        // Sanitize HTML from viewRenderer to prevent XSS from user-controlled data
        cell.innerHTML = sanitizeHTML(produced);
        needsSanitization = true;
      } else if (produced instanceof Node) {
        // Check if this container is already a child of the cell (reused by framework adapter)
        if (produced.parentElement !== cell) {
          // Clear any existing content before appending new container
          cell.textContent = '';
          cell.appendChild(produced);
        }
        // If already a child, the framework adapter has re-rendered in place
      } else if (produced == null) {
        // Renderer returned null/undefined - show raw value
        cell.textContent = value == null ? '' : String(value);
      }
      // If produced is truthy but not a string or Node (e.g., framework placeholder),
      // don't modify the cell - the framework adapter handles rendering
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
        } catch (e) {
          // Log mount errors as warnings (user configuration issue)
          console.warn(`[tbw-grid] External view mount error for column '${col.field}':`, e);
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
          } catch (e) {
            // Log dispatch errors as warnings
            console.warn(`[tbw-grid] External view event dispatch error for column '${col.field}':`, e);
          }
        });
      }
      placeholder.setAttribute('data-mounted', '');
    } else if (compiled) {
      const output = compiled({ row: rowData, value, field: col.field, column: col });
      const blocked = compiled.__blocked;
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
        cell.textContent = formatDateValue(value);
      } else if (col.type === 'boolean') {
        // Wrap checkbox in span to satisfy ARIA: gridcell can contain checkbox
        cell.innerHTML = booleanCellHTML(!!value);
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
    // Mark editable cells with tabindex for keyboard navigation
    // Event handlers are set up via delegation in setupCellEventDelegation()
    if (col.editable) {
      cell.tabIndex = 0;
    } else if (col.type === 'boolean') {
      // Non-editable boolean cells should NOT toggle on space key
      // They are read-only, only set tabindex for focus navigation
      if (!cell.hasAttribute('tabindex')) cell.tabIndex = 0;
    }

    // Initialize focus state (must match fastPatchRow for consistent behavior)
    if (focusRow === rowIndex && focusCol === colIndex) {
      cell.classList.add('cell-focus');
      cell.setAttribute('aria-selected', 'true');
    } else {
      cell.setAttribute('aria-selected', 'false');
    }

    // Apply cellClass callback if configured
    const cellClassFn = col.cellClass;
    if (cellClassFn) {
      try {
        const cellValue = (rowData as Record<string, unknown>)[col.field];
        const cellClasses = cellClassFn(cellValue, rowData, col);
        if (cellClasses && cellClasses.length > 0) {
          const validClasses = cellClasses.filter((c) => c && typeof c === 'string');
          validClasses.forEach((cls) => cell.classList.add(cls));
          cell.setAttribute('data-dynamic-classes', validClasses.join(' '));
        }
      } catch (e) {
        console.warn(`[tbw-grid] cellClass callback error for column '${col.field}':`, e);
      }
    }

    fragment.appendChild(cell);
  }

  // Single DOM operation to append all cells
  rowEl.appendChild(fragment);
}

/**
 * Handle click / double click interaction to focus cells.
 * Edit triggering is handled by EditingPlugin via onCellClick hook.
 */
export function handleRowClick(grid: InternalGrid, e: MouseEvent, rowEl: HTMLElement): void {
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
      if (cellEl.classList.contains('editing')) {
        if (focusChanged) {
          // Update .cell-focus class to reflect new focus (clear from grid element)
          clearCellFocus(grid._bodyEl ?? grid);
          cellEl.classList.add('cell-focus');
        }
        // Focus the editor in the cell
        const editor = cellEl.querySelector(FOCUSABLE_EDITOR_SELECTOR) as HTMLElement | null;
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
