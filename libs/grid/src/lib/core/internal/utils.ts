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
 * Falls back to calculating from parent row's DOM position if data-row is missing.
 * Returns -1 if no valid row index is found.
 */
export function getRowIndexFromCell(cell: Element | null): number {
  if (!cell) return -1;
  const attr = cell.getAttribute('data-row');
  if (attr) return parseInt(attr, 10);

  // Fallback: find the parent .data-grid-row and calculate index from siblings
  const rowEl = cell.closest('.data-grid-row');
  if (!rowEl) return -1;

  const parent = rowEl.parentElement;
  if (!parent) return -1;

  // Get all data-grid-row siblings and find this row's index
  const rows = parent.querySelectorAll(':scope > .data-grid-row');
  for (let i = 0; i < rows.length; i++) {
    if (rows[i] === rowEl) return i;
  }
  return -1;
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
 * Clear all cell-focus styling from a root element.
 * Used when changing focus or when selection plugin takes over focus management.
 */
export function clearCellFocus(root: Element | null): void {
  if (!root) return;
  root.querySelectorAll('.cell-focus').forEach((el) => el.classList.remove('cell-focus'));
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
