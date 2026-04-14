/**
 * Server-Side Data Plugin (Class-based)
 *
 * Provides server-side data loading with caching and lazy loading.
 */

import { BaseGridPlugin, ScrollEvent, type PluginManifest } from '../../core/plugin/base-plugin';
import type { GridHost } from '../../core/types';
import { getBlockNumber, getRequiredBlocks, getRowFromCache, loadBlock } from './datasource';
import type { ServerSideConfig, ServerSideDataSource } from './types';

/** Scroll debounce delay in ms */
const SCROLL_DEBOUNCE_MS = 100;

/**
 * Server-Side Data Plugin for tbw-grid
 *
 * Enables lazy loading of data from a remote server with caching and block-based fetching.
 * Ideal for large datasets where loading all data upfront is impractical.
 *
 * ## Installation
 *
 * ```ts
 * import { ServerSidePlugin } from '@toolbox-web/grid/plugins/server-side';
 * ```
 *
 * ## DataSource Interface
 *
 * ```ts
 * interface ServerSideDataSource {
 *   getRows(params: GetRowsParams): Promise<GetRowsResult>;
 * }
 * ```
 *
 * @example Basic Server-Side Loading
 * ```ts
 * import '@toolbox-web/grid';
 * import { ServerSidePlugin } from '@toolbox-web/grid/plugins/server-side';
 *
 * const dataSource = {
 *   async getRows(params) {
 *     const response = await fetch(
 *       `/api/data?start=${params.startRow}&end=${params.endRow}`
 *     );
 *     const data = await response.json();
 *     return { rows: data.rows, totalRowCount: data.total };
 *   },
 * };
 *
 * const plugin = new ServerSidePlugin({ pageSize: 50 });
 * grid.gridConfig = {
 *   columns: [...],
 *   plugins: [plugin],
 * };
 *
 * grid.ready().then(() => plugin.setDataSource(dataSource));
 * ```
 *
 * @see {@link ServerSideConfig} for configuration options
 * @see {@link ServerSideDataSource} for data source interface
 *
 * @internal Extends BaseGridPlugin
 */
export class ServerSidePlugin extends BaseGridPlugin<ServerSideConfig> {
  /**
   * Plugin manifest declaring incompatibilities with other plugins.
   * @internal
   */
  static override readonly manifest: PluginManifest = {
    incompatibleWith: [
      {
        name: 'tree',
        reason:
          'TreePlugin requires the full hierarchy to flatten and manage expansion state. ' +
          'ServerSidePlugin lazy-loads rows in blocks and cannot provide nested children on demand. ' +
          'Server-side tree would require lazy child loading as nodes expand.',
      },
      {
        name: 'pivot',
        reason:
          'PivotPlugin requires the full dataset to compute aggregations. ' +
          'ServerSidePlugin lazy-loads rows in blocks, so pivot aggregation cannot be performed client-side.',
      },
    ],
  };

  /** @internal */
  readonly name = 'serverSide';

  /** @internal */
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
  /** Persistent row array with stable placeholder references to avoid unnecessary DOM rebuilds. */
  private managedRows: unknown[] = [];
  // #endregion

  // #region Lifecycle

  /** @internal */
  override detach(): void {
    this.dataSource = null;
    this.totalRowCount = 0;
    this.loadedBlocks.clear();
    this.loadingBlocks.clear();
    this.managedRows = [];
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
    const gridRef = this.grid as unknown as GridHost;
    const blockSize = this.config.cacheBlockSize ?? 100;
    const viewport = { startRow: gridRef._virtualization.start, endRow: gridRef._virtualization.end };

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

          // Update managed rows in place for this block (avoids full processRows rebuild)
          const start = blockNum * blockSize;
          for (let i = 0; i < result.rows.length; i++) {
            if (start + i < this.managedRows.length) {
              this.managedRows[start + i] = result.rows[i];
            }
          }

          // Re-render visible rows without force geometry recalculation.
          // requestVirtualRefresh() skips spacer height writes that cause oscillation
          // with the scheduler's afterRender microtask. Row count hasn't changed —
          // only cached data replaced placeholders — so geometry is stable.
          this.requestVirtualRefresh();

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

  /** @internal */
  override processRows(rows: readonly unknown[]): unknown[] {
    if (!this.dataSource) return [...rows];

    const blockSize = this.config.cacheBlockSize ?? 100;

    // Grow array with stable placeholder objects (created once, reused across renders)
    while (this.managedRows.length < this.totalRowCount) {
      const i = this.managedRows.length;
      this.managedRows.push({ __loading: true, __index: i });
    }
    // Shrink if total decreased
    this.managedRows.length = this.totalRowCount;

    // Replace placeholders with cached data (stable refs for unchanged entries)
    for (let i = 0; i < this.totalRowCount; i++) {
      const cached = getRowFromCache(i, blockSize, this.loadedBlocks);
      if (cached) {
        this.managedRows[i] = cached;
      }
    }

    return this.managedRows;
  }

  /** @internal */
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
    this.managedRows = [];

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
    this.managedRows = [];
    this.requestRender();
  }

  /**
   * Clear all cached data without refreshing.
   */
  purgeCache(): void {
    this.loadedBlocks.clear();
    this.managedRows = [];
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
