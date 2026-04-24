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
import { builtInSort } from '../../core/internal/sorting';
import { BaseGridPlugin, ScrollEvent, type PluginManifest, type PluginQuery } from '../../core/plugin/base-plugin';
import type { ColumnConfig, GridHost } from '../../core/types';
import { getBlockNumber, getRequiredBlocks, getRowFromCache, loadBlock } from './datasource';
import type {
  DataSourceChildrenDetail,
  DataSourceDataDetail,
  DataSourceErrorDetail,
  DataSourceLoadingDetail,
  FetchChildrenQuery,
  GetRowsParams,
  GetRowsResult,
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
 * import '@toolbox-web/grid/features/server-side';
 *
 * grid.gridConfig = {
 *   columns: [...],
 *   features: {
 *     serverSide: {
 *       pageSize: 50,
 *       dataSource: {
 *         async getRows(params) {
 *           const response = await fetch(
 *             `/api/data?start=${params.startNode}&end=${params.endNode}`
 *           );
 *           const data = await response.json();
 *           return { rows: data.rows, totalNodeCount: data.total };
 *         },
 *       },
 *     },
 *   },
 * };
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
  private infiniteScrollMode = false;
  private loadedBlocks = new Map<number, unknown[]>();
  private loadingBlocks = new Set<number>();
  /**
   * Per-block AbortControllers for in-flight requests. Aborted when a block
   * is superseded (sort/filter change, refresh, purgeCache, detach) so data
   * sources that honor `params.signal` (e.g. `fetch`, RxJS via `fromObservable`)
   * can cancel the underlying network call.
   */
  private blockControllers = new Map<number, AbortController>();
  private lastRequestId = 0;
  private scrollDebounceTimer?: ReturnType<typeof setTimeout>;
  /** Persistent node array with stable placeholder references to avoid unnecessary DOM rebuilds. */
  private managedNodes: unknown[] = [];
  // #endregion

  // #region Lifecycle

  /** @internal */
  override attach(grid: import('../../core/plugin/base-plugin').GridElement): void {
    super.attach(grid);

    // Invalidate cache and refetch on sort/filter changes — gated by sortMode/filterMode.
    // 'local' (opt-in): keep cache; sort/filter the loaded rows in place via a re-render.
    // See getEnrichmentParams() — local-mode state is also omitted from block fetch params
    // so scroll-triggered loadRequiredBlocks() doesn't leak local state to the backend.
    this.on('sort-change', () => {
      if (this.config.sortMode === 'local') {
        this.requestRender();
      } else {
        this.onModelChange();
      }
    });
    this.on('filter-change', () => {
      if (this.config.filterMode === 'local') {
        this.requestRender();
      } else {
        this.onModelChange();
      }
    });

    // Auto-initialize from config when dataSource is provided declaratively
    if (this.config.dataSource) {
      this.setDataSource(this.config.dataSource);
    }
  }

  /** @internal */
  override detach(): void {
    this.dataSource = null;
    this.totalNodeCount = 0;
    this.infiniteScrollMode = false;
    this.loadedBlocks.clear();
    this.loadingBlocks.clear();
    this.abortAllBlocks();
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
   * Abort all in-flight block requests. Called when the plugin tears down,
   * the data source is replaced, the cache is purged, or the sort/filter
   * model changes (the previously loaded block coordinates no longer apply).
   */
  private abortAllBlocks(): void {
    for (const controller of this.blockControllers.values()) {
      controller.abort();
    }
    this.blockControllers.clear();
  }

  /**
   * Build enrichment params by querying sort/filter models from loaded plugins.
   *
   * When `sortMode === 'local'` the `sortModel` is omitted so scroll-triggered
   * block fetches don't ask the backend for an ordering it isn't applying.
   * Same for `filterMode === 'local'` and `filterModel`.
   */
  private getEnrichmentParams(): Partial<GetRowsParams> {
    const sortLocal = this.config.sortMode === 'local';
    const filterLocal = this.config.filterMode === 'local';
    const sortResults = sortLocal
      ? undefined
      : (this.grid?.query?.('sort:get-model', null) as
          | Array<{ field: string; direction: 'asc' | 'desc' }>[]
          | undefined);
    const filterResults = filterLocal
      ? undefined
      : (this.grid?.query?.('filter:get-model', null) as Record<string, unknown>[] | undefined);

    // Fallback to core single-column sort state when no plugin answers the
    // 'sort:get-model' query (e.g. MultiSortPlugin not loaded). Translate the
    // numeric direction (1/-1) to the public 'asc'/'desc' string form.
    let sortModel = sortResults?.[0];
    const host = this.grid as unknown as GridHost | undefined;
    if (!sortLocal && !sortModel && host?._sortState) {
      const { field, direction } = host._sortState;
      sortModel = [{ field, direction: direction === 1 ? 'asc' : 'desc' }];
    }

    return {
      sortModel,
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
    this.abortAllBlocks();
    this.loadedBlocks.clear();
    this.loadingBlocks.clear();
    this.managedNodes = [];
    this.totalNodeCount = 0;
    this.infiniteScrollMode = false;
    this.requestRender();
    // Eagerly fetch the current viewport with the new enrichment params.
    // Without this, the table stays blank until the user scrolls (no other
    // path triggers a fetch — processRows just rebuilds from cached blocks).
    this.loadRequiredBlocks();
  }

  /**
   * Apply server response metadata: resolve totalNodeCount and infinite scroll mode.
   * When `lastNode` is provided, it takes priority and finalizes the total.
   * When `totalNodeCount` is -1, switch to infinite scroll (growing array).
   * When a block returns fewer rows than blockSize, detect end-of-data.
   */
  private applyServerResult(result: GetRowsResult, blockNum: number, blockSize: number): void {
    if (result.lastNode !== undefined) {
      // Server declared the exact end
      this.totalNodeCount = result.lastNode + 1;
      this.infiniteScrollMode = false;
    } else if (result.totalNodeCount === -1) {
      this.infiniteScrollMode = true;
    } else {
      this.totalNodeCount = result.totalNodeCount;
      this.infiniteScrollMode = false;
    }

    // Auto-detect end of data: short block means server has no more rows
    if (this.infiniteScrollMode && result.rows.length < blockSize) {
      this.totalNodeCount = blockNum * blockSize + result.rows.length;
      this.infiniteScrollMode = false;
    }
  }

  /**
   * Estimate the row count for infinite scroll mode.
   * Returns loaded rows + one extra block of placeholders to trigger next fetch.
   */
  private getInfiniteScrollEstimate(blockSize: number): number {
    let maxLoadedEnd = 0;
    for (const [block, rows] of this.loadedBlocks) {
      const end = block * blockSize + rows.length;
      if (end > maxLoadedEnd) maxLoadedEnd = end;
    }
    return maxLoadedEnd + blockSize;
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

    // Expand the viewport by loadThreshold in both directions to prefetch
    // blocks the user is about to scroll into. The end is clamped to
    // totalNodeCount when known so we don't request blocks past the end of
    // data — but `totalNodeCount = 0` means "not yet loaded" (e.g. just after
    // purgeCache or before the first fetch resolves), in which case we leave
    // it unclamped so the initial block can be fetched.
    const threshold = Math.max(0, this.config.loadThreshold ?? 0);
    const expandedStart = Math.max(0, viewport.startNode - threshold);
    const knownTotal = this.totalNodeCount > 0 ? this.totalNodeCount : Infinity;
    const expandedEnd = Math.min(knownTotal, viewport.endNode + threshold);
    if (expandedEnd <= expandedStart) return;

    // Determine which blocks are needed for current viewport (in node space)
    const requiredBlocks = getRequiredBlocks(expandedStart, expandedEnd, blockSize);
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
      const controller = new AbortController();
      this.blockControllers.set(blockNum, controller);
      this.broadcast<DataSourceLoadingDetail>('datasource:loading', { loading: true });

      loadBlock(this.dataSource, blockNum, blockSize, enrichment, controller.signal)
        .then((result) => {
          this.blockControllers.delete(blockNum);
          // Drop results from a request that was superseded after the await
          // resolved (data source ignored the abort signal). Without this guard
          // a stale block would land in the cache after a sort/filter change.
          if (controller.signal.aborted) {
            this.loadingBlocks.delete(blockNum);
            if (this.loadingBlocks.size === 0) {
              this.broadcast<DataSourceLoadingDetail>('datasource:loading', { loading: false });
            }
            return;
          }
          this.loadedBlocks.set(blockNum, result.rows);
          // Capture pre-update length so we can detect whether processRows must
          // re-run to grow the managedNodes array (e.g. after onModelChange reset).
          const previousManagedLength = this.managedNodes.length;
          this.applyServerResult(result, blockNum, blockSize);
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

          // If managedNodes still hasn't been sized for the (possibly newly known)
          // totalNodeCount — typically because onModelChange() reset it to 0 right
          // before this fetch — we MUST run processRows to grow the array. The
          // in-place writes above are no-ops in that case (length is 0).
          // Without this, sort/filter changes leave the grid permanently blank
          // until something else triggers a ROWS phase.
          const needsRowModelRebuild =
            previousManagedLength === 0 ||
            this.managedNodes.length < (Number.isFinite(this.totalNodeCount) ? this.totalNodeCount : 0);

          if (needsRowModelRebuild) {
            this.requestRender();
          } else {
            // Re-render visible rows without force geometry recalculation.
            // requestVirtualRefresh() skips spacer height writes that cause oscillation
            // with the scheduler's afterRender microtask. Node count hasn't changed —
            // only cached data replaced placeholders — so geometry is stable.
            this.requestVirtualRefresh();
          }

          // Re-check with fresh viewport: user may have scrolled further
          this.loadRequiredBlocks();
        })
        .catch((error: unknown) => {
          this.blockControllers.delete(blockNum);
          this.loadingBlocks.delete(blockNum);
          // A superseded request may surface as either an AbortError or as a
          // user-thrown error after the data source detected the abort —
          // suppress diagnostics in both cases. Real failures still surface.
          if (controller.signal.aborted) {
            if (this.loadingBlocks.size === 0) {
              this.broadcast<DataSourceLoadingDetail>('datasource:loading', { loading: false });
            }
            return;
          }
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

    // Guard against invalid totalNodeCount (e.g. undefined from a malformed datasource response).
    // In infinite scroll mode, estimate the total from loaded data + one extra block.
    const nodeCount = this.infiniteScrollMode
      ? this.getInfiniteScrollEstimate(blockSize)
      : Number.isFinite(this.totalNodeCount) && this.totalNodeCount >= 0
        ? this.totalNodeCount
        : 0;

    // Grow array with stable placeholder objects (created once, reused across renders)
    while (this.managedNodes.length < nodeCount) {
      const i = this.managedNodes.length;
      this.managedNodes.push({ __loading: true, __index: i });
    }
    // Shrink if total decreased
    this.managedNodes.length = nodeCount;

    // Replace placeholders with cached data (stable refs for unchanged entries)
    for (let i = 0; i < nodeCount; i++) {
      const cached = getRowFromCache(i, blockSize, this.loadedBlocks);
      if (cached) {
        this.managedNodes[i] = cached;
      }
    }

    // Local-mode sort: when sortMode === 'local' the plugin owns ordering of
    // the loaded rows itself (core sort ran on the input but we discarded it
    // by returning managedNodes). Apply the current core sort state on top of
    // managedNodes so the user sees in-place sorting without a refetch.
    // Note: any plugin sort that runs after us (priority > -10, e.g. multi-sort)
    // will further re-sort our output, which is the intended chain.
    const host = this.grid as unknown as GridHost | undefined;
    if (this.config.sortMode === 'local' && host?._sortState) {
      const columns = (host._columns ?? []) as ColumnConfig[];
      // Honor user's gridConfig.sortHandler when provided — same resolution
      // as core's reapplyCoreSort/applySort. processRows is synchronous, so
      // async handlers cannot be awaited here: keep the current managedNodes
      // order for this pass and swallow any rejection so it doesn't surface
      // as an unhandled promise rejection. The next core sort cycle (or the
      // next block load) will re-invoke this path with up-to-date state.
      const handler = host.effectiveConfig?.sortHandler ?? builtInSort;
      const result = handler(this.managedNodes, host._sortState, columns);
      if (result && typeof (result as Promise<unknown[]>).then === 'function') {
        void (result as Promise<unknown[]>).catch(() => undefined);
        return this.managedNodes;
      }
      return result as unknown[];
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
    this.abortAllBlocks();
    this.dataSource = dataSource;
    this.loadedBlocks.clear();
    this.loadingBlocks.clear();
    this.managedNodes = [];
    this.totalNodeCount = 0;
    this.infiniteScrollMode = false;

    // Load first block with enrichment params
    const blockSize = this.config.cacheBlockSize ?? 100;
    const enrichment = this.getEnrichmentParams();
    const gridId = this.grid?.getAttribute?.('id') ?? undefined;
    const controller = new AbortController();
    this.blockControllers.set(0, controller);
    this.loadingBlocks.add(0);

    this.broadcast<DataSourceLoadingDetail>('datasource:loading', { loading: true });

    loadBlock(dataSource, 0, blockSize, enrichment, controller.signal)
      .then((result) => {
        this.blockControllers.delete(0);
        this.loadingBlocks.delete(0);
        if (controller.signal.aborted) {
          this.broadcast<DataSourceLoadingDetail>('datasource:loading', { loading: false });
          return;
        }
        this.loadedBlocks.set(0, result.rows);
        this.applyServerResult(result, 0, blockSize);

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

        // When loadThreshold is configured, re-check the viewport so the
        // prefetch can pull in additional blocks immediately rather than
        // waiting for the user's first scroll. Gated on the threshold to
        // preserve the historical "first fetch loads block 0 only" behavior.
        if ((this.config.loadThreshold ?? 0) > 0) {
          this.loadRequiredBlocks();
        }
      })
      .catch((error: unknown) => {
        this.blockControllers.delete(0);
        this.loadingBlocks.delete(0);
        if (controller.signal.aborted) {
          this.broadcast<DataSourceLoadingDetail>('datasource:loading', { loading: false });
          return;
        }
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
    this.abortAllBlocks();
    this.loadedBlocks.clear();
    this.loadingBlocks.clear();
    this.managedNodes = [];
    this.totalNodeCount = 0;
    this.infiniteScrollMode = false;
    // Re-trigger load via setDataSource which handles enrichment and broadcasting
    this.setDataSource(ds);
  }

  /**
   * Clear all cached data without refreshing.
   */
  purgeCache(): void {
    this.abortAllBlocks();
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
