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
import styles from './master-detail.css?inline';
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
    columns: readonly import('../../core/types').ColumnConfig[],
  ): import('../../core/types').ColumnConfig[] {
    if (!this.config.detailRenderer) {
      return [...columns];
    }

    // Wrap first column's renderer to add expand/collapse toggle
    const cols = [...columns];
    if (cols.length > 0) {
      const firstCol = { ...cols[0] };
      const originalRenderer = firstCol.viewRenderer;

      // Skip if already wrapped by this plugin (prevents double-wrapping on re-render)
      if ((originalRenderer as any)?.__masterDetailWrapped) {
        return cols;
      }

      const wrappedRenderer = (renderCtx: Parameters<NonNullable<typeof originalRenderer>>[0]) => {
        const { value, row } = renderCtx;
        const isExpanded = this.expandedRows.has(row);

        const container = document.createElement('span');
        container.className = 'master-detail-cell-wrapper';

        // Expand/collapse toggle icon
        const toggle = document.createElement('span');
        toggle.className = 'master-detail-toggle';
        // Use grid-level icons (fall back to defaults)
        this.setIcon(toggle, this.resolveIcon(isExpanded ? 'collapse' : 'expand'));
        // role="button" is required for aria-expanded to be valid
        toggle.setAttribute('role', 'button');
        toggle.setAttribute('tabindex', '0');
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

      // Mark renderer as wrapped to prevent double-wrapping
      (wrappedRenderer as any).__masterDetailWrapped = true;
      firstCol.viewRenderer = wrappedRenderer;

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

  override onCellClick(): boolean | void {
    // Sync detail rows after cell click triggers refreshVirtualWindow
    // This runs in microtask to ensure DOM updates are complete
    if (this.expandedRows.size > 0) {
      queueMicrotask(() => this.#syncDetailRows());
    }
    return; // Don't prevent default
  }

  override afterRender(): void {
    this.#syncDetailRows();
  }

  /**
   * Called on scroll to sync detail elements with visible rows.
   * Removes details for rows that scrolled out of view and reattaches for visible rows.
   */
  override onScrollRender(): void {
    if (!this.config.detailRenderer || this.expandedRows.size === 0) return;
    // Full sync needed on scroll to clean up orphaned details
    this.#syncDetailRows();
  }

  /**
   * Full sync of detail rows - cleans up stale elements and creates new ones.
   * Detail rows are inserted as siblings AFTER their master row to survive row rebuilds.
   */
  #syncDetailRows(): void {
    if (!this.config.detailRenderer) return;

    const body = this.shadowRoot?.querySelector('.rows');
    if (!body) return;

    // Build a map of row index -> row element for visible rows
    const visibleRowMap = new Map<number, Element>();
    const dataRows = body.querySelectorAll('.data-grid-row');
    const columnCount = this.columns.length;

    for (const rowEl of dataRows) {
      const firstCell = rowEl.querySelector('.cell[data-row]');
      const rowIndex = firstCell ? parseInt(firstCell.getAttribute('data-row') ?? '-1', 10) : -1;
      if (rowIndex >= 0) {
        visibleRowMap.set(rowIndex, rowEl);
      }
    }

    // Remove detail rows whose parent row is no longer visible or no longer expanded
    const existingDetails = body.querySelectorAll('.master-detail-row');
    for (const detailEl of existingDetails) {
      const forIndex = parseInt(detailEl.getAttribute('data-detail-for') ?? '-1', 10);
      const row = forIndex >= 0 ? this.rows[forIndex] : undefined;
      const isStillExpanded = row && this.expandedRows.has(row);
      const isRowVisible = visibleRowMap.has(forIndex);

      // Remove detail if not expanded or if parent row scrolled out
      if (!isStillExpanded || !isRowVisible) {
        detailEl.remove();
        if (row) this.detailElements.delete(row);
      }
    }

    // Insert detail rows for expanded rows that are visible
    for (const [rowIndex, rowEl] of visibleRowMap) {
      const row = this.rows[rowIndex];
      if (!row || !this.expandedRows.has(row)) continue;

      // Check if detail already exists for this row
      const existingDetail = this.detailElements.get(row);
      if (existingDetail) {
        // Ensure it's positioned correctly (as next sibling of row element)
        if (existingDetail.previousElementSibling !== rowEl) {
          rowEl.after(existingDetail);
        }
        continue;
      }

      // Create new detail element
      const detailEl = createDetailElement(row, rowIndex, this.config.detailRenderer, columnCount);

      if (typeof this.config.detailHeight === 'number') {
        detailEl.style.height = `${this.config.detailHeight}px`;
      }

      // Insert as sibling after the row element (not as child)
      rowEl.after(detailEl);
      this.detailElements.set(row, detailEl);
    }
  }

  /**
   * Return total extra height from all expanded detail rows.
   * Used by grid virtualization to adjust scrollbar height.
   */
  override getExtraHeight(): number {
    let totalHeight = 0;
    for (const row of this.expandedRows) {
      const detailEl = this.detailElements.get(row);
      if (detailEl) {
        totalHeight += detailEl.offsetHeight;
      } else {
        // Detail not yet rendered - estimate based on config or default
        const configHeight = this.config?.detailHeight;
        totalHeight += typeof configHeight === 'number' ? configHeight : 150;
      }
    }
    return totalHeight;
  }

  /**
   * Return extra height that appears before a given row index.
   * This is the sum of heights of all expanded details whose parent row is before the given index.
   */
  override getExtraHeightBefore(beforeRowIndex: number): number {
    let totalHeight = 0;
    for (const row of this.expandedRows) {
      const rowIndex = this.rows.indexOf(row);
      // Include detail if it's for a row before the given index
      if (rowIndex >= 0 && rowIndex < beforeRowIndex) {
        const detailEl = this.detailElements.get(row);
        if (detailEl) {
          totalHeight += detailEl.offsetHeight;
        } else {
          const configHeight = this.config?.detailHeight;
          totalHeight += typeof configHeight === 'number' ? configHeight : 150;
        }
      }
    }
    return totalHeight;
  }

  /**
   * Adjust the virtualization start index to keep expanded row visible while its detail is visible.
   * This ensures the detail scrolls smoothly out of view instead of disappearing abruptly.
   */
  override adjustVirtualStart(start: number, scrollTop: number, rowHeight: number): number {
    if (this.expandedRows.size === 0) return start;

    // Build sorted list of expanded row indices for cumulative height calculation
    const expandedIndices: Array<{ index: number; row: any }> = [];
    for (const row of this.expandedRows) {
      const index = this.rows.indexOf(row);
      if (index >= 0) {
        expandedIndices.push({ index, row });
      }
    }
    expandedIndices.sort((a, b) => a.index - b.index);

    let minStart = start;

    // Calculate actual scroll position for each expanded row,
    // accounting for cumulative detail heights before it
    let cumulativeExtraHeight = 0;

    for (const { index: rowIndex, row } of expandedIndices) {
      // Actual position includes all detail heights before this row
      const actualRowTop = rowIndex * rowHeight + cumulativeExtraHeight;
      const detailEl = this.detailElements.get(row);
      const detailHeight =
        detailEl?.offsetHeight ?? (typeof this.config?.detailHeight === 'number' ? this.config.detailHeight : 150);
      const actualDetailBottom = actualRowTop + rowHeight + detailHeight;

      // Update cumulative height for next iteration
      cumulativeExtraHeight += detailHeight;

      // Skip rows that are at or after the calculated start
      if (rowIndex >= start) continue;

      // If any part of the detail is still visible (below the scroll position),
      // we need to keep the parent row in the render range
      if (actualDetailBottom > scrollTop) {
        if (rowIndex < minStart) {
          minStart = rowIndex;
        }
      }
    }

    return minStart;
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

  override readonly styles = styles;
}
