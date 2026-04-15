/**
 * Server-Side Data Plugin (Class-based)
 *
 * Central data orchestrator for the grid. Owns fetch + cache + row-model management.
 * Structural plugins (Tree, GroupingRows) claim data via events; core grid uses it
 * as flat rows when unclaimed.
 */

import {
  DATASOURCE_CHILD_FETCH_ERROR,
  DATASOURCE_FETCH_ERROR,
  DATASOURCE_NO_CHILD_HANDLER,
  DATASOURCE_THROTTLED,
  debugDiagnostic,
  errorDiagnostic,
  warnDiagnostic,
} from '../../core/internal/diagnostics';
import { BaseGridPlugin, ScrollEvent, type PluginManifest, type PluginQuery } from '../../core/plugin/base-plugin';
import type { GridHost } from '../../core/types';
import { getBlockNumber, getRequiredBlocks, getRowFromCache, loadBlock } from './datasource';
import type {
  DataSourceChildrenDetail,
  DataSourceDataDetail,
  DataSourceErrorDetail,
  DataSourceLoadingDetail,
  FetchChildrenQuery,
  GetRowsParams,
  ServerSideDataSource,
  ViewportMappingQuery,
  ViewportMappingResponse,
} from './datasource-types';
import type { ServerSideConfig } from './types';

/** Scroll debounce delay in ms */
const SCROLL_DEBOUNCE_MS = 100;

/**
 * Server-Side Data Plugin for tbw-grid
 *
 * Central data orchestrator for the grid. Manages fetch, cache, and row-model for
 * server-side data loading. Structural plugins (Tree, GroupingRows) can claim data
 * via events; the core grid uses it as flat rows when unclaimed.
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
 *   getChildRows?(params: GetChildRowsParams): Promise<GetChildRowsResult>;
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
 *       `/api/data?start=${params.startNode}&end=${params.endNode}`
 *     );
 *     const data = await response.json();
 *     return { rows: data.rows, totalNodeCount: data.total };
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
   * Plugin manifest declaring capabilities, hooks, events, and queries.
   * @internal
   */
  static override readonly manifest: PluginManifest = {
    modifiesRowStructure: true,
    hookPriority: {
      processRows: -10, // Run before structural plugins (Tree, GroupingRows)
    },
    incompatibleWith: [
      {
        name: 'pivot',
        reason:
          'PivotPlugin requires the full dataset to compute aggregations. ' +
          'ServerSidePlugin lazy-loads rows in blocks, so pivot aggregation cannot be performed client-side.',
      },
    ],
    events: [
      { type: 'datasource:data', description: 'Root data page/block loaded' },
      { type: 'datasource:children', description: 'Child data loaded for a parent context' },
      { type: 'datasource:loading', description: 'Loading state changed' },
      { type: 'datasource:error', description: 'Fetch operation failed' },
    ],
    queries: [
      { type: 'datasource:fetch-children', description: 'Request child rows for a parent context' },
      { type: 'datasource:is-active', description: 'Check if ServerSide plugin has an active data source' },
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
  private totalNodeCount = 0;
  private loadedBlocks = new Map<number, unknown[]>();
  private loadingBlocks = new Set<number>();
  private lastRequestId = 0;
  private scrollDebounceTimer?: ReturnType<typeof setTimeout>;
  /** Persistent node array with stable placeholder references to avoid unnecessary DOM rebuilds. */
  private managedNodes: unknown[] = [];
  // #endregion

  // #region Lifecycle

  /** @internal */
  override attach(grid: import('../../core/plugin/base-plugin').GridElement): void {
    super.attach(grid);

    // Invalidate cache and refetch on sort/filter changes
    this.on('sort-change', () => this.onModelChange());
    this.on('filter-change', () => this.onModelChange());
  }

  /** @internal */
  override detach(): void {
    this.dataSource = null;
    this.totalNodeCount = 0;
    this.loadedBlocks.clear();
    this.loadingBlocks.clear();
    this.managedNodes = [];
    this.lastRequestId = 0;
    if (this.scrollDebounceTimer) {
      clearTimeout(this.scrollDebounceTimer);
      this.scrollDebounceTimer = undefined;
    }
  }
  // #endregion

  // #region Private Methods

  /**
   * Build enrichment params by querying sort/filter models from loaded plugins.
   */
  private getEnrichmentParams(): Partial<GetRowsParams> {
    const sortResults = this.grid?.query?.('sort:get-model', null) as
      | Array<{ field: string; direction: 'asc' | 'desc' }>[]
      | undefined;
    const filterResults = this.grid?.query?.('filter:get-model', null) as Record<string, unknown>[] | undefined;

    return {
      sortModel: sortResults?.[0],
      filterModel: filterResults?.[0],
    };
  }

  /**
   * Translate visible viewport indices to node-space indices via structural plugins.
   * Falls back to 1:1 mapping (flat data) when no structural plugin responds.
   */
  private getViewportMapping(viewportStart: number, viewportEnd: number): ViewportMappingResponse {
    const query: ViewportMappingQuery = { viewportStart, viewportEnd };
    const results = this.grid?.query?.('datasource:viewport-mapping', query) as ViewportMappingResponse[] | undefined;

    // Structural plugin responded — use its mapping
    if (results?.[0]) return results[0];

    // No structural plugin → 1:1 mapping (flat data)
    return {
      startNode: viewportStart,
      endNode: viewportEnd,
      totalLoadedNodes: this.totalNodeCount,
    };
  }

  /**
   * Handle sort or filter model changes.
   * Purge cache and refetch current viewport with new enrichment params.
   */
  private onModelChange(): void {
    if (!this.dataSource) return;
    this.loadedBlocks.clear();
    this.loadingBlocks.clear();
    this.managedNodes = [];
    this.totalNodeCount = 0;
    this.requestRender();
  }

  /**
   * Check current viewport and load any missing blocks.
   */
  private loadRequiredBlocks(): void {
    if (!this.dataSource) return;

    const gridRef = this.grid as unknown as GridHost;
    const blockSize = this.config.cacheBlockSize ?? 100;

    // Translate viewport to node space via structural plugins
    const viewport = this.getViewportMapping(gridRef._virtualization.start, gridRef._virtualization.end);

    // Determine which blocks are needed for current viewport (in node space)
    const requiredBlocks = getRequiredBlocks(viewport.startNode, viewport.endNode, blockSize);
    const enrichment = this.getEnrichmentParams();
    const gridId = this.grid?.getAttribute?.('id') ?? undefined;

    // Load missing blocks
    for (const blockNum of requiredBlocks) {
      if (this.loadedBlocks.has(blockNum) || this.loadingBlocks.has(blockNum)) {
        continue;
      }

      // Check concurrent request limit
      if (this.loadingBlocks.size >= (this.config.maxConcurrentRequests ?? 2)) {
        debugDiagnostic(DATASOURCE_THROTTLED, 'Concurrent request limit reached, deferring block load', gridId);
        break;
      }

      this.loadingBlocks.add(blockNum);
      this.broadcast<DataSourceLoadingDetail>('datasource:loading', { loading: true });

      loadBlock(this.dataSource, blockNum, blockSize, enrichment)
        .then((result) => {
          this.loadedBlocks.set(blockNum, result.rows);
          this.totalNodeCount = result.totalNodeCount;
          this.loadingBlocks.delete(blockNum);

          // Update managed nodes in place for this block (avoids full processRows rebuild)
          const start = blockNum * blockSize;
          for (let i = 0; i < result.rows.length; i++) {
            if (start + i < this.managedNodes.length) {
              this.managedNodes[start + i] = result.rows[i];
            }
          }

          // Broadcast data event with claimed flag
          const detail: DataSourceDataDetail = {
            rows: result.rows,
            totalNodeCount: result.totalNodeCount,
            startNode: start,
            endNode: start + result.rows.length,
            claimed: false,
          };
          this.broadcast('datasource:data', detail);

          if (this.loadingBlocks.size === 0) {
            this.broadcast<DataSourceLoadingDetail>('datasource:loading', { loading: false });
          }

          // Re-render visible rows without force geometry recalculation.
          // requestVirtualRefresh() skips spacer height writes that cause oscillation
          // with the scheduler's afterRender microtask. Node count hasn't changed —
          // only cached data replaced placeholders — so geometry is stable.
          this.requestVirtualRefresh();

          // Re-check with fresh viewport: user may have scrolled further
          this.loadRequiredBlocks();
        })
        .catch((error: unknown) => {
          this.loadingBlocks.delete(blockNum);
          const err = error instanceof Error ? error : new Error(String(error));
          errorDiagnostic(DATASOURCE_FETCH_ERROR, `getRows() failed: ${err.message}`, gridId);
          this.broadcast<DataSourceErrorDetail>('datasource:error', { error: err });

          if (this.loadingBlocks.size === 0) {
            this.broadcast<DataSourceLoadingDetail>('datasource:loading', { loading: false });
          }
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
    while (this.managedNodes.length < this.totalNodeCount) {
      const i = this.managedNodes.length;
      this.managedNodes.push({ __loading: true, __index: i });
    }
    // Shrink if total decreased
    this.managedNodes.length = this.totalNodeCount;

    // Replace placeholders with cached data (stable refs for unchanged entries)
    for (let i = 0; i < this.totalNodeCount; i++) {
      const cached = getRowFromCache(i, blockSize, this.loadedBlocks);
      if (cached) {
        this.managedNodes[i] = cached;
      }
    }

    return this.managedNodes;
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

  /** @internal */
  override handleQuery(query: PluginQuery): unknown {
    switch (query.type) {
      case 'datasource:is-active':
        return this.dataSource != null;

      case 'datasource:fetch-children': {
        const { context } = query.context as FetchChildrenQuery;
        this.fetchChildren(context);
        return undefined;
      }
    }
    return undefined;
  }
  // #endregion

  // #region Child Data Fetching

  /**
   * Fetch child rows via the datasource and broadcast the result.
   */
  private fetchChildren(context: { source: string; [key: string]: unknown }): void {
    if (!this.dataSource) return;

    const gridId = this.grid?.getAttribute?.('id') ?? undefined;

    if (!this.dataSource.getChildRows) {
      warnDiagnostic(
        DATASOURCE_NO_CHILD_HANDLER,
        `Plugin "${context.source}" requested child rows but getChildRows() is not implemented on the dataSource`,
        gridId,
      );
      return;
    }

    const enrichment = this.getEnrichmentParams();
    this.broadcast<DataSourceLoadingDetail>('datasource:loading', { loading: true, context });

    this.dataSource
      .getChildRows({ context, sortModel: enrichment.sortModel, filterModel: enrichment.filterModel })
      .then((result) => {
        const detail: DataSourceChildrenDetail = {
          rows: result.rows,
          context,
          claimed: false,
        };
        this.broadcast('datasource:children', detail);
        this.broadcast<DataSourceLoadingDetail>('datasource:loading', { loading: false, context });
      })
      .catch((error: unknown) => {
        const err = error instanceof Error ? error : new Error(String(error));
        errorDiagnostic(DATASOURCE_CHILD_FETCH_ERROR, `getChildRows() failed: ${err.message}`, gridId);
        this.broadcast<DataSourceErrorDetail>('datasource:error', { error: err, context });
        this.broadcast<DataSourceLoadingDetail>('datasource:loading', { loading: false, context });
      });
  }
  // #endregion

  // #region Public API

  /**
   * Set the data source for server-side loading.
   * @param dataSource - Data source implementing the getRows method (and optionally getChildRows)
   */
  setDataSource(dataSource: ServerSideDataSource): void {
    this.dataSource = dataSource;
    this.loadedBlocks.clear();
    this.loadingBlocks.clear();
    this.managedNodes = [];
    this.totalNodeCount = 0;

    // Load first block with enrichment params
    const blockSize = this.config.cacheBlockSize ?? 100;
    const enrichment = this.getEnrichmentParams();
    const gridId = this.grid?.getAttribute?.('id') ?? undefined;

    this.broadcast<DataSourceLoadingDetail>('datasource:loading', { loading: true });

    loadBlock(dataSource, 0, blockSize, enrichment)
      .then((result) => {
        this.loadedBlocks.set(0, result.rows);
        this.totalNodeCount = result.totalNodeCount;

        const detail: DataSourceDataDetail = {
          rows: result.rows,
          totalNodeCount: result.totalNodeCount,
          startNode: 0,
          endNode: result.rows.length,
          claimed: false,
        };
        this.broadcast('datasource:data', detail);
        this.broadcast<DataSourceLoadingDetail>('datasource:loading', { loading: false });
        this.requestRender();
      })
      .catch((error: unknown) => {
        const err = error instanceof Error ? error : new Error(String(error));
        errorDiagnostic(DATASOURCE_FETCH_ERROR, `getRows() failed: ${err.message}`, gridId);
        this.broadcast<DataSourceErrorDetail>('datasource:error', { error: err });
        this.broadcast<DataSourceLoadingDetail>('datasource:loading', { loading: false });
      });
  }

  /**
   * Refresh all data from the server.
   * Purges cache and refetches from block 0.
   */
  refresh(): void {
    if (!this.dataSource) return;
    const ds = this.dataSource;
    this.loadedBlocks.clear();
    this.loadingBlocks.clear();
    this.managedNodes = [];
    this.totalNodeCount = 0;
    // Re-trigger load via setDataSource which handles enrichment and broadcasting
    this.setDataSource(ds);
  }

  /**
   * Clear all cached data without refreshing.
   */
  purgeCache(): void {
    this.loadedBlocks.clear();
    this.managedNodes = [];
  }

  /**
   * Get the total node count from the server.
   */
  getTotalNodeCount(): number {
    return this.totalNodeCount;
  }

  /**
   * @deprecated Use {@link getTotalNodeCount} instead. Will be removed in a future version.
   */
  getTotalRowCount(): number {
    return this.totalNodeCount;
  }

  /**
   * Check if a specific node is loaded in the cache.
   * @param nodeIndex - Node index to check
   */
  isNodeLoaded(nodeIndex: number): boolean {
    const blockSize = this.config.cacheBlockSize ?? 100;
    const blockNum = getBlockNumber(nodeIndex, blockSize);
    return this.loadedBlocks.has(blockNum);
  }

  /**
   * @deprecated Use {@link isNodeLoaded} instead. Will be removed in a future version.
   */
  isRowLoaded(rowIndex: number): boolean {
    return this.isNodeLoaded(rowIndex);
  }

  /**
   * Get the number of loaded cache blocks.
   */
  getLoadedBlockCount(): number {
    return this.loadedBlocks.size;
  }
  // #endregion
}
