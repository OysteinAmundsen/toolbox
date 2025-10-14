/**
 * Master/Detail Plugin (Class-based)
 *
 * Enables expandable detail rows showing additional content for each row.
 */

/* eslint-disable @typescript-eslint/no-explicit-any */

import { BaseGridPlugin, RowClickEvent } from '../../core/plugin/base-plugin';
import {
  collapseDetailRow,
  createDetailElement,
  expandDetailRow,
  isDetailExpanded,
  toggleDetailRow,
} from './master-detail';
import type { DetailExpandDetail, MasterDetailConfig } from './types';

/**
 * Master/Detail Plugin for tbw-grid
 *
 * @example
 * ```ts
 * new MasterDetailPlugin({
 *   enabled: true,
 *   detailRenderer: (row) => `<div>Details for ${row.name}</div>`,
 *   expandOnRowClick: true,
 * })
 * ```
 */
export class MasterDetailPlugin extends BaseGridPlugin<MasterDetailConfig> {
  readonly name = 'masterDetail';
  override readonly version = '1.0.0';

  protected override get defaultConfig(): Partial<MasterDetailConfig> {
    return {
      enabled: true,
      detailHeight: 'auto',
      expandOnRowClick: false,
      collapseOnClickOutside: false,
      showExpandColumn: true,
    };
  }

  // ===== Internal State =====
  private expandedRows: Set<any> = new Set();
  private detailElements: Map<any, HTMLElement> = new Map();

  // ===== Lifecycle =====

  override detach(): void {
    this.expandedRows.clear();
    this.detailElements.clear();
  }

  // ===== Hooks =====

  override processColumns(
    columns: readonly import('../../core/types').ColumnConfig[]
  ): import('../../core/types').ColumnConfig[] {
    if (!this.config.detailRenderer) {
      return [...columns];
    }

    // Wrap first column's renderer to add expand/collapse toggle
    const cols = [...columns];
    if (cols.length > 0) {
      const firstCol = { ...cols[0] };
      const originalRenderer = firstCol.viewRenderer;

      firstCol.viewRenderer = (renderCtx) => {
        const { value, row } = renderCtx;
        const isExpanded = this.expandedRows.has(row);

        const container = document.createElement('span');
        container.className = 'master-detail-cell-wrapper';

        // Expand/collapse toggle icon
        const toggle = document.createElement('span');
        toggle.className = 'master-detail-toggle';
        toggle.textContent = isExpanded ? '▼' : '▶';
        toggle.setAttribute('aria-expanded', String(isExpanded));
        toggle.setAttribute('aria-label', isExpanded ? 'Collapse details' : 'Expand details');
        toggle.addEventListener('click', (e) => {
          e.stopPropagation();
          const rowIndex = this.rows.indexOf(row);
          this.expandedRows = toggleDetailRow(this.expandedRows, row);
          this.emit<DetailExpandDetail>('detail-expand', {
            rowIndex,
            row,
            expanded: this.expandedRows.has(row),
          });
          this.requestRender();
        });
        container.appendChild(toggle);

        // Cell content
        const content = document.createElement('span');
        if (originalRenderer) {
          const rendered = originalRenderer(renderCtx);
          if (rendered instanceof Node) {
            content.appendChild(rendered);
          } else {
            content.textContent = String(rendered ?? value ?? '');
          }
        } else {
          content.textContent = String(value ?? '');
        }
        container.appendChild(content);

        return container;
      };

      cols[0] = firstCol;
    }

    return cols;
  }

  override onRowClick(event: RowClickEvent): boolean | void {
    if (!this.config.expandOnRowClick || !this.config.detailRenderer) return;

    this.expandedRows = toggleDetailRow(this.expandedRows, event.row);

    this.emit<DetailExpandDetail>('detail-expand', {
      rowIndex: event.rowIndex,
      row: event.row,
      expanded: this.expandedRows.has(event.row),
    });

    this.requestRender();
    return false;
  }

  override afterRender(): void {
    if (!this.config.detailRenderer) return;

    const body = this.shadowRoot?.querySelector('.rows');
    if (!body) return;

    // Remove old detail rows
    body.querySelectorAll('.master-detail-row').forEach((el) => el.remove());
    this.detailElements.clear();

    // Insert detail rows as last child of expanded row elements
    const dataRows = body.querySelectorAll('.data-grid-row');
    const columnCount = this.columns.length;

    for (const rowEl of dataRows) {
      const firstCell = rowEl.querySelector('.cell[data-row]');
      const rowIndex = firstCell ? parseInt(firstCell.getAttribute('data-row') ?? '-1', 10) : -1;
      if (rowIndex < 0) continue;

      const row = this.rows[rowIndex];
      if (!row || !this.expandedRows.has(row)) continue;

      const detailEl = createDetailElement(row, rowIndex, this.config.detailRenderer, columnCount);

      if (typeof this.config.detailHeight === 'number') {
        detailEl.style.height = `${this.config.detailHeight}px`;
      }

      rowEl.appendChild(detailEl);
      this.detailElements.set(row, detailEl);
    }
  }

  // ===== Public API =====

  /**
   * Expand the detail row at the given index.
   * @param rowIndex - Index of the row to expand
   */
  expand(rowIndex: number): void {
    const row = this.rows[rowIndex];
    if (row) {
      this.expandedRows = expandDetailRow(this.expandedRows, row);
      this.requestRender();
    }
  }

  /**
   * Collapse the detail row at the given index.
   * @param rowIndex - Index of the row to collapse
   */
  collapse(rowIndex: number): void {
    const row = this.rows[rowIndex];
    if (row) {
      this.expandedRows = collapseDetailRow(this.expandedRows, row);
      this.requestRender();
    }
  }

  /**
   * Toggle the detail row at the given index.
   * @param rowIndex - Index of the row to toggle
   */
  toggle(rowIndex: number): void {
    const row = this.rows[rowIndex];
    if (row) {
      this.expandedRows = toggleDetailRow(this.expandedRows, row);
      this.requestRender();
    }
  }

  /**
   * Check if the detail row at the given index is expanded.
   * @param rowIndex - Index of the row to check
   * @returns Whether the detail row is expanded
   */
  isExpanded(rowIndex: number): boolean {
    const row = this.rows[rowIndex];
    return row ? isDetailExpanded(this.expandedRows, row) : false;
  }

  /**
   * Expand all detail rows.
   */
  expandAll(): void {
    for (const row of this.rows) {
      this.expandedRows.add(row);
    }
    this.requestRender();
  }

  /**
   * Collapse all detail rows.
   */
  collapseAll(): void {
    this.expandedRows.clear();
    this.requestRender();
  }

  /**
   * Get the indices of all expanded rows.
   * @returns Array of row indices that are expanded
   */
  getExpandedRows(): number[] {
    const indices: number[] = [];
    for (const row of this.expandedRows) {
      const idx = this.rows.indexOf(row);
      if (idx >= 0) indices.push(idx);
    }
    return indices;
  }

  /**
   * Get the detail element for a specific row.
   * @param rowIndex - Index of the row
   * @returns The detail HTMLElement or undefined
   */
  getDetailElement(rowIndex: number): HTMLElement | undefined {
    const row = this.rows[rowIndex];
    return row ? this.detailElements.get(row) : undefined;
  }

  // ===== Styles =====

  override readonly styles = `
    .master-detail-cell-wrapper {
      display: flex;
      align-items: center;
      gap: 4px;
    }
    .master-detail-toggle {
      cursor: pointer;
      font-size: 10px;
      opacity: 0.7;
      user-select: none;
    }
    .master-detail-toggle:hover {
      opacity: 1;
    }
    .master-detail-row {
      grid-column: 1 / -1;
      display: grid;
      background: var(--tbw-master-detail-bg, var(--tbw-color-row-alt));
      border-bottom: 1px solid var(--tbw-master-detail-border, var(--tbw-color-border));
    }
    .master-detail-cell {
      padding: 16px;
      overflow: auto;
    }
  `;
}
