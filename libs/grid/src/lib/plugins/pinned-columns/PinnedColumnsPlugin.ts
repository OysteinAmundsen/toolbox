/**
 * Pinned Columns Plugin (Class-based)
 *
 * Enables column pinning (sticky left/right positioning).
 */

import { BaseGridPlugin } from '../../core/plugin/base-plugin';
import type { ColumnConfig } from '../../core/types';
import {
  applyStickyOffsets,
  clearStickyOffsets,
  getLeftStickyColumns,
  getRightStickyColumns,
  hasStickyColumns,
} from './pinned-columns';
import type { PinnedColumnsConfig } from './types';

/**
 * Pinned Columns Plugin for tbw-grid
 *
 * @example
 * ```ts
 * new PinnedColumnsPlugin({ enabled: true })
 * ```
 */
export class PinnedColumnsPlugin extends BaseGridPlugin<PinnedColumnsConfig> {
  readonly name = 'pinnedColumns';
  override readonly version = '1.0.0';

  protected override get defaultConfig(): Partial<PinnedColumnsConfig> {
    return {
      enabled: true,
    };
  }

  // ===== Internal State =====
  private isApplied = false;
  private leftOffsets = new Map<string, number>();
  private rightOffsets = new Map<string, number>();

  // ===== Lifecycle =====

  override detach(): void {
    this.leftOffsets.clear();
    this.rightOffsets.clear();
    this.isApplied = false;
  }

  // ===== Detection =====

  /**
   * Auto-detect sticky columns from column configuration.
   */
  static detect(rows: readonly unknown[], config: { columns?: ColumnConfig[] }): boolean {
    const columns = config?.columns;
    if (!Array.isArray(columns)) return false;
    return hasStickyColumns(columns);
  }

  // ===== Hooks =====

  override processColumns(columns: readonly ColumnConfig[]): ColumnConfig[] {
    if (!this.config.enabled) {
      this.isApplied = false;
      return [...columns];
    }

    // Mark that we have sticky columns to apply
    this.isApplied = hasStickyColumns([...columns]);
    return [...columns];
  }

  override afterRender(): void {
    if (!this.config.enabled || !this.isApplied) {
      return;
    }

    const host = this.grid as unknown as HTMLElement;
    const columns = [...this.columns];

    if (!hasStickyColumns(columns)) {
      clearStickyOffsets(host);
      this.isApplied = false;
      return;
    }

    // Apply sticky offsets after a microtask to ensure DOM is ready
    queueMicrotask(() => {
      applyStickyOffsets(host, columns);
    });
  }

  // ===== Public API =====

  /**
   * Re-apply sticky offsets (e.g., after column resize).
   */
  refreshStickyOffsets(): void {
    const columns = [...this.columns];
    applyStickyOffsets(this.grid as unknown as HTMLElement, columns);
  }

  /**
   * Get columns pinned to the left.
   */
  getLeftPinnedColumns(): ColumnConfig[] {
    const columns = [...this.columns];
    return getLeftStickyColumns(columns);
  }

  /**
   * Get columns pinned to the right.
   */
  getRightPinnedColumns(): ColumnConfig[] {
    const columns = [...this.columns];
    return getRightStickyColumns(columns);
  }

  /**
   * Clear all sticky positioning.
   */
  clearStickyPositions(): void {
    clearStickyOffsets(this.grid as unknown as HTMLElement);
  }
}
