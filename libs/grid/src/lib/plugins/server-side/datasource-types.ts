// #region Sort/Filter Model

/** Sort/filter state passed through to the server. */
export interface DataRequestModel {
  /** Active sort columns, in priority order. Empty array when unsorted. */
  sortModel?: Array<{ field: string; direction: 'asc' | 'desc' }>;
  /** Active filter model keyed by field name. Empty object when no filters are applied. */
  filterModel?: Record<string, unknown>;
}

// #endregion

// #region Root Data (getRows)

/**
 * Parameters passed to {@link ServerSideDataSource.getRows} for each data request.
 *
 * Pagination is in **node space** — one node equals one atomic pagination unit.
 * For flat data, a node is a row. For tree data, a node is a top-level tree node.
 * For grouped data, a node is a group definition.
 *
 * The grid enriches these params with the current sort/filter state from loaded plugins
 * (MultiSort, Filtering) so the server can apply them remotely.
 */
export interface GetRowsParams extends DataRequestModel {
  /** Zero-based index of the first node to fetch (inclusive). */
  startNode: number;
  /** Zero-based index of the last node to fetch (exclusive). `endNode - startNode` equals the block size. */
  endNode: number;
  /**
   * Cancellation signal for the request. The grid aborts the signal when:
   * - a newer request supersedes the same block (sort/filter change, refresh, purgeCache)
   * - the plugin detaches or the grid disconnects
   *
   * Pass it to `fetch(url, { signal })` (native), an `AbortController.signal` consumer,
   * or via the `fromObservable` helper in `@toolbox-web/grid-angular/features/server-side`
   * to translate it to RxJS `takeUntil`. Data sources that ignore `signal` keep working
   * — the only consequence is that superseded HTTP requests still complete on the wire.
   */
  signal: AbortSignal;
}

/**
 * Result returned from {@link ServerSideDataSource.getRows}.
 *
 * @example
 * ```typescript
 * // Known total (pagination-style)
 * return { rows: pageData, totalNodeCount: 5000 };
 *
 * // Infinite scroll — set lastNode when the final page is reached
 * return { rows: pageData, totalNodeCount: -1, lastNode: absoluteLastIndex };
 * ```
 */
export interface GetRowsResult<TRow = unknown> {
  /** The fetched top-level node objects for the requested range. */
  rows: TRow[];
  /**
   * Total number of top-level nodes available on the server.
   * Use `-1` if unknown (infinite scroll mode).
   */
  totalNodeCount: number;
  /**
   * The absolute index of the last available node.
   * Only needed for **infinite scroll** when `totalNodeCount` is `-1`.
   * Once the server returns the final page, set this so the grid knows
   * scrolling has reached the end and stops requesting further blocks.
   */
  lastNode?: number;
}

// #endregion

// #region Child Data (getChildRows)

/**
 * Parameters for fetching child rows of a parent node.
 *
 * The `context` is opaque — provided by the requesting plugin and passed through
 * to the user's `getChildRows` callback verbatim. Each plugin sets a `source`
 * discriminator so listeners can filter incoming child events.
 *
 * Known context shapes:
 * - Tree: `{ source: 'tree', parentNode: TreeRow, nodePath: string[] }`
 * - GroupingRows: `{ source: 'grouping-rows', group: GroupDefinition, groupPath: string[] }`
 * - MasterDetail: `{ source: 'master-detail', row: TRow, rowIndex: number }`
 *
 * Child rows are fetched as a single batch — no pagination.
 */
export interface GetChildRowsParams extends DataRequestModel {
  /**
   * Opaque context from the requesting plugin.
   * Contains a `source` discriminator string and plugin-specific fields.
   * ServerSide does not interpret this object.
   */
  context: { source: string; [key: string]: unknown };
}

/**
 * Result returned from {@link ServerSideDataSource.getChildRows}.
 * All children are returned in a single batch (no pagination).
 */
export interface GetChildRowsResult<TRow = unknown> {
  rows: TRow[];
}

// #endregion

// #region DataSource Interface

/**
 * Minimal Subscribable contract used by {@link ServerSideDataSource.getRows} when
 * an Observable-based data source is preferred over a `Promise`. Matches the
 * shape of RxJS `Observable` and the TC39 Observable proposal — any value that
 * exposes a `.subscribe(observer)` method returning an unsubscribable handle
 * works without a runtime dependency on RxJS.
 *
 * The plugin subscribes once, expects exactly one `next` (the result), and
 * tears the subscription down on `complete`, `error`, or when the request is
 * superseded (`AbortSignal` fires) — which is what causes Angular `HttpClient`
 * to cancel the underlying XHR.
 */
export interface Subscribable<T> {
  subscribe(observer: {
    next?(value: T): void;
    error?(err: unknown): void;
    complete?(): void;
  }): { unsubscribe(): void };
}

/**
 * Unified data source contract for server-side data loading.
 *
 * Implement `getRows` to supply root-level rows from a remote API, database,
 * or any asynchronous provider. The grid calls `getRows()` whenever it needs
 * a new block of rows (on initial load, scroll, sort change, or filter change).
 *
 * `getRows` may return either a `Promise` (e.g. `fetch(url, { signal }).then(...)`)
 * or a {@link Subscribable} (e.g. an Angular `HttpClient` observable). With a
 * Subscribable, the grid unsubscribes on supersede, which natively cancels the
 * underlying request — no need to wire `params.signal` into anything.
 *
 * Optionally implement `getChildRows` for on-demand child data (tree children,
 * group rows, detail panels, etc.). If child data is already embedded in
 * parent rows (e.g. tree nodes with inline `children` arrays), this method
 * is not needed.
 *
 * @example
 * ```typescript
 * // Promise / fetch
 * const dataSource: ServerSideDataSource = {
 *   async getRows(params) {
 *     const res = await fetch(`/api/data?start=${params.startNode}&end=${params.endNode}`, {
 *       signal: params.signal,
 *     });
 *     const data = await res.json();
 *     return { rows: data.items, totalNodeCount: data.total };
 *   },
 * };
 *
 * // Angular HttpClient (Observable)
 * const dataSource: ServerSideDataSource = {
 *   getRows: (params) =>
 *     this.http
 *       .get<{ items: unknown[]; total: number }>('/api/data', { params: toHttpParams(params) })
 *       .pipe(map((d) => ({ rows: d.items, totalNodeCount: d.total }))),
 * };
 * ```
 */
export interface ServerSideDataSource<TRow = unknown> {
  /**
   * Fetch a page/block of root-level nodes.
   * Called on initial load and on scroll/page events.
   *
   * Before calling this, ServerSide queries loaded plugins for their
   * current state (sort model, filter model, etc.) and passes it
   * through in the params.
   *
   * Return either a `Promise<GetRowsResult>` or a {@link Subscribable}
   * (Observable). For Subscribables, unsubscription on supersede is what
   * cancels the underlying request.
   */
  getRows(params: GetRowsParams): Promise<GetRowsResult<TRow>> | Subscribable<GetRowsResult<TRow>>;

  /**
   * Fetch child rows for a parent context.
   * Called when a plugin queries `datasource:fetch-children`.
   *
   * Child rows are fetched as a single batch — no pagination.
   * If the dataset is too large, the server should limit the response.
   *
   * This method is optional. When not provided and a plugin queries
   * for children, ServerSide emits a `TBW142` diagnostic warning.
   */
  getChildRows?(params: GetChildRowsParams): Promise<GetChildRowsResult<TRow>>;
}

// #endregion

// #region Event Detail Types

/** Detail for `datasource:data` broadcast events. */
export interface DataSourceDataDetail<TRow = unknown> {
  rows: TRow[];
  totalNodeCount: number;
  startNode: number;
  endNode: number;
  /** Mutable flag — structural plugins set this to `true` when they consume the data. */
  claimed: boolean;
}

/** Detail for `datasource:children` broadcast events. */
export interface DataSourceChildrenDetail<TRow = unknown> {
  rows: TRow[];
  context: { source: string; [key: string]: unknown };
  /** Mutable flag — the requesting plugin sets this to `true` when it consumes the data. */
  claimed: boolean;
}

/** Detail for `datasource:loading` broadcast events. */
export interface DataSourceLoadingDetail {
  loading: boolean;
  context?: { source: string; [key: string]: unknown };
}

/** Detail for `datasource:error` broadcast events. */
export interface DataSourceErrorDetail {
  error: Error;
  context?: { source: string; [key: string]: unknown };
}

// #endregion

// #region Query Types

/** Context for `datasource:viewport-mapping` query. */
export interface ViewportMappingQuery {
  viewportStart: number;
  viewportEnd: number;
}

/** Response from `datasource:viewport-mapping` query. */
export interface ViewportMappingResponse {
  startNode: number;
  endNode: number;
  totalLoadedNodes: number;
}

/** Context for `datasource:fetch-children` query. */
export interface FetchChildrenQuery {
  context: { source: string; [key: string]: unknown };
}

// #endregion
