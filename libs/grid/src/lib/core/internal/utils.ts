// ────────────────────────────────────────────────────────────────────────────
// Cell Rendering Helpers (reduces duplicate code in rows.ts)
// ────────────────────────────────────────────────────────────────────────────

/** Unicode checkmark for true boolean values */
const BOOL_TRUE = '\u{1F5F9}';
/** Unicode empty checkbox for false boolean values */
const BOOL_FALSE = '\u2610';

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
 * Format a boolean value for text display (not HTML).
 */
export function formatBooleanValue(value: unknown): string {
  return value ? BOOL_TRUE : BOOL_FALSE;
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
 * Clear all cell-focus styling from a root element (shadowRoot or bodyEl).
 * Used when changing focus or when selection plugin takes over focus management.
 */
export function clearCellFocus(root: Element | ShadowRoot | null): void {
  if (!root) return;
  root.querySelectorAll('.cell-focus').forEach((el) => el.classList.remove('cell-focus'));
}
