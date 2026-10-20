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
import type { ColumnConfig } from '../../core/types';
import { renderLoadingPlaceholderRow } from '../shared/loading-placeholder';
import {
  createUrlDataSource,
  getBlockNumber,
  getRequiredBlocks,
  getRowFromCache,
  isUrlDataSource,
  loadBlock,
} from './datasource';
import type {
  DataSourceChildrenDetail,
  DataSourceDataDetail,
  DataSourceErrorDetail,
  DataSourceLoadingDetail,
  FetchChildrenQuery,
  GetChildRowsResult,
  GetRowsParams,
  GetRowsResult,
  ServerSideDataSource,
  ViewportMappingQuery,
  ViewportMappingResponse,
} from './datasource-types';
import { createLoadingPlaceholder, isLoadingPlaceholder } from './placeholder';
import type { ServerSideConfig } from './types';

/** Scroll debounce delay in ms */
const SCROLL_DEBOUNCE_MS = 100;

/** Add the blocks covering nodes `[start, end)`, clamped to `[0, knownTotal)`. */
function addRangeBlocks(blocks: Set<number>, start: number, end: number, blockSize: number, knownTotal: number): void {
  const from = Math.max(0, start);
  const to = Math.min(knownTotal, end);
  if (to > from) for (const block of getRequiredBlocks(from, to, blockSize)) blocks.add(block);
}

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
 * @since 0.1.1
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
      renderRow: -10, // Claim placeholders before row renderers (e.g. Responsive cardRenderer) see them
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
      {
        type: 'datasource:filter-mode',
        description: "Who filters rows while a data source is active: 'server' (data source) or 'local' (grid)",
      },
      {
        type: 'datasource:sort-mode',
        description: "Who sorts rows while a data source is active: 'server' (data source) or 'local' (grid)",
      },
    ],
  };

  /** @internal */
  readonly name = 'serverSide';

  /** @internal */
  protected override get defaultConfig(): Partial<ServerSideConfig> {
    return {
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
  private scrollDebounceTimer?: ReturnType<typeof setTimeout>;
  /**
   * One-shot flag set when a block lands; consumed in `afterRender()` to re-check
   * required blocks against the viewport produced by the render that the new data
   * triggered (a synchronous check would see the pre-render virtual window).
   */
  private pendingViewportCheck = false;
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
      if (this.sortMode === 'local') {
        this.requestRender();
      } else {
        this.onModelChange();
      }
    });
    this.on('filter-change', () => {
      if (this.filterMode === 'local') {
        // The filter can reject rows above unloaded placeholders, moving them into
        // view without a scroll — re-check the viewport after this render (#520).
        this.pendingViewportCheck = true;
        this.requestRender();
      } else {
        this.onModelChange();
      }
    });

    // Auto-initialize from config when dataSource is provided declaratively
    if (this.config.dataSource) {
      this.setDataSource(this.config.dataSource);
      return;
    }

    // Declarative `data-src` shorthand (issue #273): when no JS dataSource is
    // configured, read the host's `data-src` attribute and fetch the whole
    // dataset from that URL. Enables a zero-JS HTML page to render
    // server-fetched rows. A JS `dataSource` config always takes precedence.
    const src = this.gridElement?.getAttribute('data-src');
    if (src) {
      this.setDataSource(createUrlDataSource(src));
    }
  }

  /** @internal */
  override detach(): void {
    this.dataSource = null;
    this.totalNodeCount = 0;
    this.infiniteScrollMode = false;
    this.loadedBlocks.clear();
    this.abortAllBlocks();
    this.managedNodes = [];
    this.pendingViewportCheck = false;
    if (this.scrollDebounceTimer) {
      clearTimeout(this.scrollDebounceTimer);
      this.scrollDebounceTimer = undefined;
    }
  }
  // #endregion

  // #region Private Methods

  /**
   * Abort all in-flight block requests and release their loading slots. Called
   * when the plugin tears down, the data source is replaced, the cache is purged,
   * or the sort/filter model changes (the previously loaded block coordinates no
   * longer apply).
   */
  private abortAllBlocks(): void {
    for (const controller of this.blockControllers.values()) {
      controller.abort();
    }
    this.blockControllers.clear();
    this.loadingBlocks.clear();
  }

  /**
   * Release `blockNum`'s in-flight slot when its request settles — but only if
   * `controller` still owns it. An aborted request settles a microtask after the
   * abort, by which time a superseding request (refresh, sort/filter change) may
   * have re-registered the same block; deleting that entry would orphan the new
   * request from `abortAllBlocks()` and let stale rows land in the cache.
   */
  private releaseBlock(blockNum: number, controller: AbortController): void {
    if (this.blockControllers.get(blockNum) !== controller) return;
    this.blockControllers.delete(blockNum);
    this.loadingBlocks.delete(blockNum);
  }

  /**
   * Effective sort/filter ownership. The `data-src` URL source only slices a cached
   * dataset and ignores `sortModel` / `filterModel`, so it is always `'local'` —
   * otherwise a sort or filter would refetch the unchanged rows and nobody would
   * apply it.
   */
  private get sortMode(): 'server' | 'local' {
    return isUrlDataSource(this.dataSource) ? 'local' : (this.config.sortMode ?? 'server');
  }

  private get filterMode(): 'server' | 'local' {
    return isUrlDataSource(this.dataSource) ? 'local' : (this.config.filterMode ?? 'server');
  }

  /**
   * Build enrichment params by querying sort/filter models from loaded plugins.
   *
   * When `sortMode === 'local'` the `sortModel` is omitted so scroll-triggered
   * block fetches don't ask the backend for an ordering it isn't applying.
   * Same for `filterMode === 'local'` and `filterModel`.
   */
  private getEnrichmentParams(): Partial<GetRowsParams> {
    const sortLocal = this.sortMode === 'local';
    const filterLocal = this.filterMode === 'local';
    const sortResults = sortLocal
      ? undefined
      : (this.grid?.query?.('sort:get-model', null) as
          Array<{ field: string; direction: 'asc' | 'desc' }>[] | undefined);
    const filterResults = filterLocal
      ? undefined
      : (this.grid?.query?.('filter:get-model', null) as Record<string, unknown>[] | undefined);

    // Fallback to core single-column sort state when no plugin answers the
    // 'sort:get-model' query (e.g. MultiSortPlugin not loaded). Translate the
    // numeric direction (1/-1) to the public 'asc'/'desc' string form.
    let sortModel = sortResults?.[0];
    const host = this.grid;
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
   * Blocks (ascending) the viewport — expanded by `threshold` rows both ways to
   * prefetch — needs loaded. The viewport is translated through a structural
   * plugin's `datasource:viewport-mapping` when one responds, else 1:1 (flat data).
   *
   * When the displayed rows are not `managedNodes` itself, a later stage may have
   * dropped or reordered rows (local filter or sort), or a structural plugin
   * renumbered the rows it kept (Tree counts the remaining roots from zero). Then a
   * display index is no longer a node index, so the blocks of the placeholders on
   * screen are added: their `__index` is their node index, and loaded rows need no fetch.
   */
  private getRequiredBlockNumbers(
    viewportStart: number,
    viewportEnd: number,
    threshold: number,
    blockSize: number,
  ): number[] {
    // Blocks past the end of data are never requested (see `knownTotal`).
    const knownTotal = this.knownTotal;
    const blocks = new Set<number>();
    const mapped = this.queryViewportMapping(viewportStart, viewportEnd);
    const displayDiffers = this.displayDiffers;

    if (mapped || !displayDiffers) {
      const range = mapped ?? { startNode: viewportStart, endNode: viewportEnd };
      addRangeBlocks(blocks, range.startNode - threshold, range.endNode + threshold, blockSize, knownTotal);
    }
    if (displayDiffers) {
      this.addPlaceholderBlocks(blocks, viewportStart - threshold, viewportEnd + threshold, blockSize, knownTotal);
    }
    return [...blocks].sort((a, b) => a - b);
  }

  /**
   * `totalNodeCount`, or `Infinity` while it is unknown — `0` means "not yet loaded"
   * (just after purgeCache, or before the first fetch resolves), and block 0 must
   * still be fetchable then.
   */
  private get knownTotal(): number {
    return this.totalNodeCount > 0 ? this.totalNodeCount : Infinity;
  }

  /** Whether the displayed rows are not `managedNodes` itself, so display indices may not be node indices. */
  private get displayDiffers(): boolean {
    return this.rows !== this.managedNodes && this.managedNodes.length > 0;
  }

  /** A structural plugin's (Tree, GroupingRows) translation of the viewport to node space, if any. */
  private queryViewportMapping(viewportStart: number, viewportEnd: number): ViewportMappingResponse | undefined {
    const query: ViewportMappingQuery = { viewportStart, viewportEnd };
    const results = this.grid?.query?.('datasource:viewport-mapping', query) as ViewportMappingResponse[] | undefined;
    return results?.[0];
  }

  /** Add the block of every placeholder displayed in `[displayStart, displayEnd)` (may be fractional). */
  private addPlaceholderBlocks(
    blocks: Set<number>,
    displayStart: number,
    displayEnd: number,
    blockSize: number,
    knownTotal: number,
  ): void {
    const rows = this.rows;
    const last = Math.min(rows.length, Math.ceil(displayEnd));
    for (let i = Math.max(0, Math.floor(displayStart)); i < last; i++) {
      const row = rows[i];
      if (isLoadingPlaceholder(row) && row.__index < knownTotal) blocks.add(getBlockNumber(row.__index, blockSize));
    }
  }

  /**
   * Handle sort or filter model changes.
   * Purge cache and refetch current viewport with new enrichment params.
   */
  private onModelChange(): void {
    if (!this.dataSource) return;
    this.abortAllBlocks();
    this.loadedBlocks.clear();
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
   * Length `managedNodes` must have: the infinite-scroll estimate, else
   * `totalNodeCount` (guarded against an invalid value from a malformed
   * datasource response, e.g. `undefined`).
   */
  private getNodeCount(blockSize: number): number {
    if (this.infiniteScrollMode) return this.getInfiniteScrollEstimate(blockSize);
    return Number.isFinite(this.totalNodeCount) && this.totalNodeCount >= 0 ? this.totalNodeCount : 0;
  }

  /**
   * Check current viewport and load any missing blocks.
   */
  private loadRequiredBlocks(): void {
    if (!this.dataSource) return;

    const { _virtualization } = this.grid;
    const blockSize = this.config.pageSize ?? 100;

    // Blocks the viewport covers in node space, expanded by loadThreshold in both
    // directions to prefetch blocks the user is about to scroll into.
    const threshold = Math.max(0, this.config.loadThreshold ?? 0);
    const requiredBlocks = this.getRequiredBlockNumbers(
      _virtualization.start,
      _virtualization.end,
      threshold,
      blockSize,
    );
    if (requiredBlocks.length === 0) return;

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
          this.releaseBlock(blockNum, controller);
          // Drop results from a request that was superseded after the await
          // resolved (data source ignored the abort signal). Without this guard
          // a stale block would land in the cache after a sort/filter change.
          if (controller.signal.aborted) {
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

          // If managedNodes is not sized for the (possibly newly known) node count
          // — reset to 0 by onModelChange() right before this fetch, an infinite-
          // scroll estimate that grows by a block, or a short block that finalized
          // a smaller total — we MUST run processRows to resize the array. The
          // in-place writes above cannot grow or shrink it.
          // Without this, sort/filter changes leave the grid permanently blank
          // and infinite scroll stalls after the second block.
          // A structural plugin (Tree, GroupingRows) that claimed the data derives
          // its own row model from `managedNodes`. The in-place element swap above
          // is invisible to that derived model — it still references the discarded
          // placeholder objects — so processRows MUST re-run for it to re-derive.
          // The same holds when `_rows` is not `managedNodes` itself: a later
          // processRows stage (local sort, local filter, MultiSort) produced it
          // from the previous contents (#520).
          // With variable row heights the loaded rows can differ in height from the
          // placeholders they replace; only the ROWS → forced-refresh path rebuilds
          // the position cache and spacer (refreshVirtualWindow(false) does neither).
          const needsRowModelRebuild =
            previousManagedLength === 0 ||
            detail.claimed ||
            this.rows !== this.managedNodes ||
            this.managedNodes.length !== this.getNodeCount(blockSize) ||
            this.grid._virtualization?.variableHeights === true;

          if (needsRowModelRebuild) {
            // New identity so downstream processRows caches keyed on the input
            // reference (e.g. FilteringPlugin) see the loaded rows (#520).
            this.managedNodes = this.managedNodes.slice();
            // Scheduled render: re-check against its viewport in afterRender().
            this.pendingViewportCheck = true;
            this.requestRender();
          } else {
            // Re-render visible rows without force geometry recalculation.
            // requestVirtualRefresh() skips spacer height writes that cause oscillation
            // with the scheduler's afterRender microtask. Node count hasn't changed and
            // row heights are uniform — only cached data replaced placeholders — so
            // geometry is stable.
            this.requestVirtualRefresh();
          }

          // Re-check now in case the user scrolled while the block was in flight
          // (requestVirtualRefresh() is synchronous, so the window is current).
          this.loadRequiredBlocks();
        })
        .catch((error: unknown) => {
          this.releaseBlock(blockNum, controller);
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

    const blockSize = this.config.pageSize ?? 100;
    const nodeCount = this.getNodeCount(blockSize);

    // Grow array with stable placeholder objects (created once, reused across renders)
    while (this.managedNodes.length < nodeCount) {
      this.managedNodes.push(createLoadingPlaceholder(this.managedNodes.length));
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
    const host = this.grid;
    if (this.sortMode === 'local' && host?._sortState) {
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
  override renderRow(row: unknown, rowEl: HTMLElement, rowIndex: number): boolean {
    if (!isLoadingPlaceholder(row) || this.config.placeholderRendering === 'columns') return false;
    renderLoadingPlaceholderRow(this.grid, rowEl, row, rowIndex);
    return true;
  }

  /** @internal */
  override afterRender(): void {
    if (!this.pendingViewportCheck) return;
    this.pendingViewportCheck = false;
    this.loadRequiredBlocks();
  }

  /** @internal */
  override onScroll(_event: ScrollEvent): void {
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

      case 'datasource:filter-mode':
        return this.dataSource ? this.filterMode : undefined;

      case 'datasource:sort-mode':
        return this.dataSource ? this.sortMode : undefined;

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

    let request: Promise<GetChildRowsResult>;
    try {
      request = this.dataSource.getChildRows({
        context,
        sortModel: enrichment.sortModel,
        filterModel: enrichment.filterModel,
      });
    } catch (error) {
      // A non-async getChildRows() can throw synchronously — route it through .catch below.
      request = Promise.reject(error);
    }

    request
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
    this.managedNodes = [];
    this.totalNodeCount = 0;
    this.infiniteScrollMode = false;
    this.pendingViewportCheck = false;

    // Load first block with enrichment params
    const blockSize = this.config.pageSize ?? 100;
    const enrichment = this.getEnrichmentParams();
    const gridId = this.grid?.getAttribute?.('id') ?? undefined;
    const controller = new AbortController();
    this.blockControllers.set(0, controller);
    this.loadingBlocks.add(0);

    this.broadcast<DataSourceLoadingDetail>('datasource:loading', { loading: true });

    loadBlock(dataSource, 0, blockSize, enrichment, controller.signal)
      .then((result) => {
        this.releaseBlock(0, controller);
        if (controller.signal.aborted) {
          if (this.loadingBlocks.size === 0) {
            this.broadcast<DataSourceLoadingDetail>('datasource:loading', { loading: false });
          }
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
        // Fill the rest of the viewport (plus loadThreshold) once block 0 has
        // rendered — see afterRender(). Checking here would use the empty
        // pre-data virtual window and request nothing.
        this.pendingViewportCheck = true;
        // processRows grows managedNodes in place; a new identity invalidates
        // input-ref caches (a local filter rendered while block 0 was pending).
        this.managedNodes = this.managedNodes.slice();
        this.requestRender();
      })
      .catch((error: unknown) => {
        this.releaseBlock(0, controller);
        if (controller.signal.aborted) {
          if (this.loadingBlocks.size === 0) {
            this.broadcast<DataSourceLoadingDetail>('datasource:loading', { loading: false });
          }
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
    // Drop a deferred viewport fill so the purge doesn't refetch on the next render.
    this.pendingViewportCheck = false;
  }

  /**
   * Get the total node count from the server.
   */
  getTotalNodeCount(): number {
    return this.totalNodeCount;
  }

  /**
   * Check if a specific node is loaded in the cache.
   * @param nodeIndex - Node index to check
   */
  isNodeLoaded(nodeIndex: number): boolean {
    const blockSize = this.config.pageSize ?? 100;
    const blockNum = getBlockNumber(nodeIndex, blockSize);
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
