/**
 * Pivot Row Rendering
 *
 * Pure functions for rendering pivot rows (group rows, leaf rows, grand total).
 * Separated from PivotPlugin for better code organization.
 */

import type { ColumnConfig, IconValue } from '../../core/types';

/** Row data with pivot metadata */
export interface PivotRowData {
  __pivotRowKey?: string;
  __pivotLabel?: string;
  __pivotDepth?: number;
  __pivotIndent?: number;
  __pivotExpanded?: boolean;
  __pivotHasChildren?: boolean;
  __pivotRowCount?: number;
  __pivotIsGrandTotal?: boolean;
  [key: string]: unknown;
}

/** Context for row rendering */
export interface RowRenderContext {
  columns: ColumnConfig[];
  rowIndex: number;
  onToggle: (key: string) => void;
  resolveIcon: (iconKey: 'expand' | 'collapse') => IconValue;
  setIcon: (element: HTMLElement, icon: IconValue) => void;
}

/**
 * Render a pivot group row (has children, can expand/collapse).
 */
export function renderPivotGroupRow(row: PivotRowData, rowEl: HTMLElement, ctx: RowRenderContext): boolean {
  rowEl.className = 'data-grid-row pivot-group-row';
  rowEl.setAttribute('data-pivot-depth', String(row.__pivotDepth ?? 0));
  rowEl.setAttribute('data-pivot-key', String(row.__pivotRowKey ?? ''));
  rowEl.setAttribute('role', 'row');
  // Note: aria-expanded is not set here because it's only valid in treegrid, not grid
  // The expand/collapse state is conveyed via the toggle button's aria-label
  rowEl.innerHTML = '';

  ctx.columns.forEach((col, colIdx) => {
    const cell = document.createElement('div');
    cell.className = 'cell';
    cell.setAttribute('data-col', String(colIdx));
    cell.setAttribute('data-row', String(ctx.rowIndex));
    cell.setAttribute('role', 'gridcell');

    if (colIdx === 0) {
      // First column: indent + toggle + label + count
      const indent = Number(row.__pivotIndent) || 0;
      cell.style.paddingLeft = `${indent}px`;

      // Toggle button
      const rowKey = String(row.__pivotRowKey);
      const btn = document.createElement('button');
      btn.type = 'button';
      btn.className = 'pivot-toggle';
      btn.setAttribute('aria-label', row.__pivotExpanded ? 'Collapse group' : 'Expand group');
      ctx.setIcon(btn, ctx.resolveIcon(row.__pivotExpanded ? 'collapse' : 'expand'));
      btn.addEventListener('click', (e) => {
        e.stopPropagation();
        ctx.onToggle(rowKey);
      });
      cell.appendChild(btn);

      // Group label
      const label = document.createElement('span');
      label.className = 'pivot-label';
      label.textContent = String(row.__pivotLabel ?? '');
      cell.appendChild(label);

      // Row count
      const count = document.createElement('span');
      count.className = 'pivot-count';
      count.textContent = ` (${Number(row.__pivotRowCount) || 0})`;
      cell.appendChild(count);
    } else {
      // Other columns: render value
      const value = row[col.field];
      cell.textContent = value != null ? String(value) : '';
    }

    rowEl.appendChild(cell);
  });

  return true;
}

/**
 * Render a pivot leaf row (no children, just indentation).
 */
export function renderPivotLeafRow(
  row: PivotRowData,
  rowEl: HTMLElement,
  columns: ColumnConfig[],
  rowIndex: number,
): boolean {
  rowEl.className = 'data-grid-row pivot-leaf-row';
  rowEl.setAttribute('data-pivot-depth', String(row.__pivotDepth ?? 0));
  rowEl.setAttribute('data-pivot-key', String(row.__pivotRowKey ?? ''));
  rowEl.innerHTML = '';

  columns.forEach((col, colIdx) => {
    const cell = document.createElement('div');
    cell.className = 'cell';
    cell.setAttribute('data-col', String(colIdx));
    cell.setAttribute('data-row', String(rowIndex));
    cell.setAttribute('role', 'gridcell');

    if (colIdx === 0) {
      // First column: indent + label (no toggle for leaves)
      const indent = Number(row.__pivotIndent) || 0;
      // Add extra indent for alignment with toggle button
      cell.style.paddingLeft = `${indent + 20}px`;

      const label = document.createElement('span');
      label.className = 'pivot-label';
      label.textContent = String(row.__pivotLabel ?? '');
      cell.appendChild(label);
    } else {
      // Other columns: render value
      const value = row[col.field];
      cell.textContent = value != null ? String(value) : '';
    }

    rowEl.appendChild(cell);
  });

  return true;
}

/**
 * Render the grand total row.
 */
export function renderPivotGrandTotalRow(row: PivotRowData, rowEl: HTMLElement, columns: ColumnConfig[]): boolean {
  rowEl.className = 'pivot-grand-total-row';
  // Use role=presentation since grand total is rendered outside the role=grid element
  rowEl.setAttribute('role', 'presentation');
  rowEl.innerHTML = '';

  columns.forEach((col, colIdx) => {
    const cell = document.createElement('div');
    cell.className = 'cell';
    cell.setAttribute('data-col', String(colIdx));
    // No role attribute - parent row has role=presentation so children don't need grid semantics

    if (colIdx === 0) {
      // First column: Grand Total label
      const label = document.createElement('span');
      label.className = 'pivot-label';
      label.textContent = 'Grand Total';
      cell.appendChild(label);
    } else {
      // Other columns: render totals
      const value = row[col.field];
      cell.textContent = value != null ? String(value) : '';
    }

    rowEl.appendChild(cell);
  });

  return true;
}
