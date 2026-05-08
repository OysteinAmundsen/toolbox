/**
 * Master/Detail Core Logic
 *
 * Pure functions for managing detail row expansion state.
 */

/* eslint-disable @typescript-eslint/no-explicit-any */
// Uses `any` for maximum flexibility with user-defined row types.

/**
 * Toggle the expansion state of a detail row.
 *
 * **Mutates the input `Set` in place and returns the same reference** (avoids
 * O(n) copy per toggle). Do NOT rely on reference inequality (`result !== input`)
 * to detect change — inspect the returned set's contents instead.
 */
export function toggleDetailRow(expandedRows: Set<object>, row: object): Set<object> {
  if (expandedRows.has(row)) {
    expandedRows.delete(row);
  } else {
    expandedRows.add(row);
  }
  return expandedRows;
}

/**
 * Expand a detail row.
 *
 * **Mutates the input `Set` in place and returns the same reference** (avoids
 * O(n) copy). Reference identity is preserved across calls.
 */
export function expandDetailRow(expandedRows: Set<object>, row: object): Set<object> {
  expandedRows.add(row);
  return expandedRows;
}

/**
 * Collapse a detail row.
 *
 * **Mutates the input `Set` in place and returns the same reference** (avoids
 * O(n) copy). Reference identity is preserved across calls.
 */
export function collapseDetailRow(expandedRows: Set<object>, row: object): Set<object> {
  expandedRows.delete(row);
  return expandedRows;
}

/**
 * Check if a detail row is expanded.
 */
export function isDetailExpanded(expandedRows: Set<object>, row: object): boolean {
  return expandedRows.has(row);
}

/**
 * Create a detail element for a given row.
 * The element spans all columns and contains the rendered content.
 */
export function createDetailElement(
  row: any,
  rowIndex: number,
  renderer: (row: any, rowIndex: number) => HTMLElement | string,
  columnCount: number,
): HTMLElement {
  const detailRow = document.createElement('div');
  detailRow.className = 'master-detail-row';
  detailRow.setAttribute('data-detail-for', String(rowIndex));
  detailRow.setAttribute('role', 'row');

  const detailCell = document.createElement('div');
  detailCell.className = 'master-detail-cell';
  detailCell.setAttribute('role', 'cell');
  detailCell.style.gridColumn = `1 / ${columnCount + 1}`;

  const content = renderer(row, rowIndex);
  if (typeof content === 'string') {
    detailCell.innerHTML = content;
  } else if (content instanceof HTMLElement) {
    detailCell.appendChild(content);
  }

  detailRow.appendChild(detailCell);
  return detailRow;
}
