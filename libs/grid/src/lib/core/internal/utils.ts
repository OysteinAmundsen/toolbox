// #region Environment Helpers

/**
 * Check if we're running in a development environment.
 * Returns true for localhost or when NODE_ENV !== 'production'.
 * Used to show warnings only in development.
 */
export function isDevelopment(): boolean {
  // Check for localhost (browser environment)
  if (typeof window !== 'undefined' && window.location) {
    const hostname = window.location.hostname;
    if (hostname === 'localhost' || hostname === '127.0.0.1' || hostname === '::1') {
      return true;
    }
  }
  // Check for NODE_ENV (build-time or SSR)
  if (typeof process !== 'undefined' && process.env?.NODE_ENV !== 'production') {
    return true;
  }
  return false;
}

// #endregion

// #region Cell Rendering Helpers

/**
 * Generate accessible HTML for a boolean cell.
 * Uses role="checkbox" with proper aria attributes.
 */
export function booleanCellHTML(value: boolean): string {
  return `<span role="checkbox" aria-checked="${value}" aria-label="${value}">${value ? '&#x1F5F9;' : '&#9744;'}</span>`;
}

/**
 * Format a date value for display.
 * Handles Date objects, timestamps, and date strings.
 * Returns empty string for invalid dates.
 */
export function formatDateValue(value: unknown): string {
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

/**
 * Get the row index from a cell element's data-row attribute.
 *
 * Fallbacks, in order: a sibling cell's `data-row` (custom-rendered cells may
 * omit it), then the row's `aria-rowindex` (written by `renderVisibleRows` on
 * every pooled row BEFORE the `renderRow` hook, so plugin-rendered rows such as
 * group headers resolve too). Returns -1 if no valid row index is found.
 *
 * Never derives the index from the row's DOM position: pooled rows start at the
 * virtual window's first row, so position ≠ data index once the grid scrolls.
 */
export function getRowIndexFromCell(cell: Element | null): number {
  if (!cell) return -1;
  const attr = cell.getAttribute('data-row');
  if (attr) return parseInt(attr, 10);

  const rowEl = cell.closest('.data-grid-row');
  if (!rowEl) return -1;
  const sibling = rowEl.querySelector(':scope > .cell[data-row]');
  if (sibling) return parseInt(sibling.getAttribute('data-row') ?? '-1', 10);

  // aria-rowindex is 1-based and offset by the header-row count `renderVisibleRows`
  // used when it stamped the attribute. Decode with the SAME cached value
  // (`__cachedHeaderRowCount` on the host): it is computed once, before
  // GroupingColumns inserts its `.header-group-row`, so a fresh DOM count can
  // disagree with it by one. The DOM derivation is only a fallback for hosts
  // that never rendered (test mocks).
  const ariaIndex = rowEl.getAttribute('aria-rowindex');
  if (!ariaIndex) return -1;
  const host = rowEl.closest('tbw-grid, [data-tbw-grid]');
  const cached = host && '__cachedHeaderRowCount' in host ? host.__cachedHeaderRowCount : undefined;
  const headerRowCount =
    typeof cached === 'number'
      ? cached
      : rowEl.closest('.rows-body')?.querySelector(':scope > .header .header-group-row')
        ? 2
        : 1;
  return parseInt(ariaIndex, 10) - headerRowCount - 1;
}

/**
 * Get the column index from a cell element's data-col attribute.
 * Returns -1 if no valid column index is found.
 */
export function getColIndexFromCell(cell: Element | null): number {
  if (!cell) return -1;
  const attr = cell.getAttribute('data-col');
  return attr ? parseInt(attr, 10) : -1;
}

/**
 * Clear cell-focus styling from the grid's own data cells.
 *
 * `body` is the grid's `.rows` container (`grid._bodyEl`). Only cells of rows
 * that are DIRECT children of it are touched: the grid renders in light DOM,
 * so a nested `<tbw-grid>` (master-detail panel, cell renderer) lives inside
 * this container and a descendant query would strip ITS focus marker (#581).
 */
export function clearCellFocus(body: Element | null): void {
  if (!body) return;
  body.querySelectorAll(':scope > .data-grid-row > .cell.cell-focus').forEach((el) => el.classList.remove('cell-focus'));
}
// #endregion

// #region RTL Helpers

/** Text direction */
export type TextDirection = 'ltr' | 'rtl';

/**
 * Get the text direction for an element.
 * Reads from the computed style, which respects the `dir` attribute on the element
 * or any ancestor, as well as CSS `direction` property.
 *
 * @param element - The element to check direction for
 * @returns 'ltr' or 'rtl'
 *
 * @example
 * ```typescript
 * // Detect grid's direction
 * const dir = getDirection(gridElement);
 * if (dir === 'rtl') {
 *   // Handle RTL layout
 * }
 * ```
 */
export function getDirection(element: Element): TextDirection {
  // Try computed style first (works in real browsers)
  try {
    const computedDir = getComputedStyle(element).direction;
    if (computedDir === 'rtl') return 'rtl';
  } catch {
    // getComputedStyle may fail in some test environments
  }

  // Fallback: check dir attribute on element or ancestors
  // This handles test environments where getComputedStyle may not reflect dir attribute
  try {
    const dirAttr = element.closest?.('[dir]')?.getAttribute('dir');
    if (dirAttr === 'rtl') return 'rtl';
  } catch {
    // closest may not be available on mock elements
  }

  return 'ltr';
}

/**
 * Check if an element is in RTL mode.
 *
 * @param element - The element to check
 * @returns true if the element's text direction is right-to-left
 */
export function isRTL(element: Element): boolean {
  return getDirection(element) === 'rtl';
}

/**
 * Resolve a logical inline position to a physical position based on text direction.
 *
 * - `'start'` → `'left'` in LTR, `'right'` in RTL
 * - `'end'` → `'right'` in LTR, `'left'` in RTL
 * - `'left'` / `'right'` → unchanged (physical values)
 *
 * @param position - Logical or physical position
 * @param direction - Text direction ('ltr' or 'rtl')
 * @returns Physical position ('left' or 'right')
 *
 * @example
 * ```typescript
 * resolveInlinePosition('start', 'ltr'); // 'left'
 * resolveInlinePosition('start', 'rtl'); // 'right'
 * resolveInlinePosition('left', 'rtl');  // 'left' (unchanged)
 * ```
 */
export function resolveInlinePosition(
  position: 'left' | 'right' | 'start' | 'end',
  direction: TextDirection,
): 'left' | 'right' {
  if (position === 'left' || position === 'right') {
    return position;
  }
  if (direction === 'rtl') {
    return position === 'start' ? 'right' : 'left';
  }
  return position === 'start' ? 'left' : 'right';
}
// #endregion
