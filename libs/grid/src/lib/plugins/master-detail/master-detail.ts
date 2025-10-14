/**
 * Master/Detail Core Logic
 *
 * Pure functions for managing detail row expansion state.
 */

/* eslint-disable @typescript-eslint/no-explicit-any */
// Uses `any` for maximum flexibility with user-defined row types.

/**
 * Toggle the expansion state of a detail row.
 * Returns a new Set with the updated state.
 */
export function toggleDetailRow(expandedRows: Set<object>, row: object): Set<object> {
  const newExpanded = new Set(expandedRows);
  if (newExpanded.has(row)) {
    newExpanded.delete(row);
  } else {
    newExpanded.add(row);
  }
  return newExpanded;
}

/**
 * Expand a detail row.
 * Returns a new Set with the row added.
 */
export function expandDetailRow(expandedRows: Set<object>, row: object): Set<object> {
  const newExpanded = new Set(expandedRows);
  newExpanded.add(row);
  return newExpanded;
}

/**
 * Collapse a detail row.
 * Returns a new Set with the row removed.
 */
export function collapseDetailRow(expandedRows: Set<object>, row: object): Set<object> {
  const newExpanded = new Set(expandedRows);
  newExpanded.delete(row);
  return newExpanded;
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
  columnCount: number
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
