/**
 * Server-Side Data Plugin (Class-based)
 *
 * Provides server-side data loading with caching and lazy loading.
 */

import { BaseGridPlugin, ScrollEvent } from '../../core/plugin/base-plugin';
import { getBlockNumber, getRequiredBlocks, getRowFromCache, loadBlock } from './datasource';
import type { ServerSideConfig, ServerSideDataSource } from './types';

/** Scroll debounce delay in ms */
const SCROLL_DEBOUNCE_MS = 100;

/**
 * Server-Side Plugin for tbw-grid
 *
 * @example
 * ```ts
 * const plugin = new ServerSidePlugin({ cacheBlockSize: 100 });
 * plugin.setDataSource(myDataSource);
 * ```
 */
export class ServerSidePlugin extends BaseGridPlugin<ServerSideConfig> {
  readonly name = 'serverSide';
  override readonly version = '1.0.0';

  protected override get defaultConfig(): Partial<ServerSideConfig> {
    return {
      pageSize: 100,
      cacheBlockSize: 100,
      maxConcurrentRequests: 2,
    };
  }

  // #region Internal State
  private dataSource: ServerSideDataSource | null = null;
  private totalRowCount = 0;
  private loadedBlocks = new Map<number, unknown[]>();
  private loadingBlocks = new Set<number>();
  private lastRequestId = 0;
  private scrollDebounceTimer?: ReturnType<typeof setTimeout>;
  // #endregion

  // #region Lifecycle

  override detach(): void {
    this.dataSource = null;
    this.totalRowCount = 0;
    this.loadedBlocks.clear();
    this.loadingBlocks.clear();
    this.lastRequestId = 0;
    if (this.scrollDebounceTimer) {
      clearTimeout(this.scrollDebounceTimer);
      this.scrollDebounceTimer = undefined;
    }
  }
  // #endregion

  // #region Private Methods

  /**
   * Check current viewport and load any missing blocks.
   */
  private loadRequiredBlocks(): void {
    if (!this.dataSource) return;

    // Get fresh viewport from grid's virtualization state
    const gridRef = this.grid as unknown as { virtualization: { start: number; end: number } };
    const blockSize = this.config.cacheBlockSize ?? 100;
    const viewport = { startRow: gridRef.virtualization.start, endRow: gridRef.virtualization.end };

    // Determine which blocks are needed for current viewport
    const requiredBlocks = getRequiredBlocks(viewport.startRow, viewport.endRow, blockSize);

    // Load missing blocks
    for (const blockNum of requiredBlocks) {
      if (this.loadedBlocks.has(blockNum) || this.loadingBlocks.has(blockNum)) {
        continue;
      }

      // Check concurrent request limit
      if (this.loadingBlocks.size >= (this.config.maxConcurrentRequests ?? 2)) {
        break;
      }

      this.loadingBlocks.add(blockNum);

      loadBlock(this.dataSource, blockNum, blockSize, {})
        .then((result) => {
          this.loadedBlocks.set(blockNum, result.rows);
          this.totalRowCount = result.totalRowCount;
          this.loadingBlocks.delete(blockNum);
          this.requestRender();
          // Re-check with fresh viewport: user may have scrolled further
          this.loadRequiredBlocks();
        })
        .catch(() => {
          this.loadingBlocks.delete(blockNum);
        });
    }
  }
  // #endregion

  // #region Hooks

  override processRows(rows: readonly unknown[]): unknown[] {
    if (!this.dataSource) return [...rows];

    // Create placeholder rows for total count
    const result: unknown[] = [];
    for (let i = 0; i < this.totalRowCount; i++) {
      const cached = getRowFromCache(i, this.config.cacheBlockSize ?? 100, this.loadedBlocks);
      result.push(cached ?? { __loading: true, __index: i });
    }

    return result;
  }

  override onScroll(event: ScrollEvent): void {
    if (!this.dataSource) return;

    // Immediate check for blocks
    this.loadRequiredBlocks();

    // Debounce: when scrolling stops, do a final check with fresh viewport
    if (this.scrollDebounceTimer) {
      clearTimeout(this.scrollDebounceTimer);
    }
    this.scrollDebounceTimer = setTimeout(() => {
      this.loadRequiredBlocks();
    }, SCROLL_DEBOUNCE_MS);
  }
  // #endregion

  // #region Public API

  /**
   * Set the data source for server-side loading.
   * @param dataSource - Data source implementing the getRows method
   */
  setDataSource(dataSource: ServerSideDataSource): void {
    this.dataSource = dataSource;
    this.loadedBlocks.clear();
    this.loadingBlocks.clear();

    // Load first block
    const blockSize = this.config.cacheBlockSize ?? 100;
    loadBlock(dataSource, 0, blockSize, {}).then((result) => {
      this.loadedBlocks.set(0, result.rows);
      this.totalRowCount = result.totalRowCount;
      this.requestRender();
    });
  }

  /**
   * Refresh all data from the server.
   */
  refresh(): void {
    if (!this.dataSource) return;
    this.loadedBlocks.clear();
    this.loadingBlocks.clear();
    this.requestRender();
  }

  /**
   * Clear all cached data without refreshing.
   */
  purgeCache(): void {
    this.loadedBlocks.clear();
  }

  /**
   * Get the total row count from the server.
   */
  getTotalRowCount(): number {
    return this.totalRowCount;
  }

  /**
   * Check if a specific row is loaded in the cache.
   * @param rowIndex - Row index to check
   */
  isRowLoaded(rowIndex: number): boolean {
    const blockSize = this.config.cacheBlockSize ?? 100;
    const blockNum = getBlockNumber(rowIndex, blockSize);
    return this.loadedBlocks.has(blockNum);
  }

  /**
   * Get the number of loaded cache blocks.
   */
  getLoadedBlockCount(): number {
    return this.loadedBlocks.size;
  }
  // #endregion
}
