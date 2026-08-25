/**
 * Tree Data Plugin
 *
 * Enables hierarchical tree data with expand/collapse, sorting, and auto-detection.
 */

import { GridClasses } from '../../core/constants';
import { createDefaultSpinner } from '../../core/internal/loading';
import { setSanitizedHTML } from '../../core/internal/sanitize';
import { builtInSort } from '../../core/internal/sorting';
import type { GridElement } from '../../core/plugin/base-plugin';
import {
  BaseGridPlugin,
  CellClickEvent,
  HeaderClickEvent,
  type PluginManifest,
  type PluginQuery,
} from '../../core/plugin/base-plugin';
import type { ColumnConfig, ColumnViewRenderer, GridHost, SortHandler } from '../../core/types';
import type {
  DataSourceChildrenDetail,
  DataSourceDataDetail,
  DataSourceErrorDetail,
  FetchChildrenQuery,
  Subscribable,
  ViewportMappingQuery,
  ViewportMappingResponse,
} from '../server-side/datasource-types';
import { collapseAll, expandAll, expandToKey, toggleExpand } from './tree-data';
import { countTopLevelNodes, getTopLevelNodeIndex } from './tree-datasource';
import { detectTreeStructure, inferChildrenField } from './tree-detect';
import styles from './tree.css?inline';
import type {
  ExpandCollapseAnimation,
  FlattenedTreeRow,
  TreeConfig,
  TreeExpandDetail,
  TreeLoadEndDetail,
  TreeLoadErrorDetail,
  TreeLoadStartDetail,
  TreeRow,
} from './types';

/** Narrow a `loadChildren` result to the Subscribable branch. */
function isSubscribable<T>(value: Promise<T> | Subscribable<T>): value is Subscribable<T> {
  return typeof (value as Subscribable<T>).subscribe === 'function';
}

/**
 * Tree Data Plugin for tbw-grid
 *
 * Transforms your flat grid into a hierarchical tree view with expandable parent-child
 * relationships. Ideal for file explorers, organizational charts, nested categories,
 * or any data with a natural hierarchy.
 *
 * ## Installation
 *
 * ```ts
 * import { TreePlugin } from '@toolbox-web/grid/plugins/tree';
 * ```
 *
 * ## CSS Custom Properties
 *
 * | Property | Default | Description |
 * |----------|---------|-------------|
 * | `--tbw-tree-toggle-size` | `1.25em` | Toggle icon width |
 * | `--tbw-tree-indent-width` | `var(--tbw-tree-toggle-size)` | Indentation per level |
 * | `--tbw-tree-accent` | `var(--tbw-color-accent)` | Toggle icon hover color |
 * | `--tbw-animation-duration` | `200ms` | Expand/collapse animation duration |
 * | `--tbw-animation-easing` | `ease-out` | Animation curve |
 *
 * @example Basic Tree with Nested Children
 * ```ts
 * import { queryGrid } from '@toolbox-web/grid';
 * import { TreePlugin } from '@toolbox-web/grid/plugins/tree';
 *
 * const grid = queryGrid('tbw-grid');
 * grid.gridConfig = {
 *   columns: [
 *     { field: 'name', header: 'Name' },
 *     { field: 'type', header: 'Type' },
 *     { field: 'size', header: 'Size' },
 *   ],
 *   plugins: [new TreePlugin({ childrenField: 'children', indentWidth: 24 })],
 * };
 * grid.rows = [
 *   {
 *     id: 1,
 *     name: 'Documents',
 *     type: 'folder',
 *     children: [
 *       { id: 2, name: 'Report.docx', type: 'file', size: '24 KB' },
 *     ],
 *   },
 * ];
 * ```
 *
 * @example Expanded by Default with Custom Animation
 * ```ts
 * new TreePlugin({
 *   defaultExpanded: true,
 *   animation: 'fade', // 'slide' | 'fade' | false
 *   indentWidth: 32,
 * })
 * ```
 *
 * @see {@link TreeConfig} for all configuration options
 * @see {@link FlattenedTreeRow} for the flattened row structure
 *
 * @internal Extends BaseGridPlugin
 * @since 0.1.1
 */
export class TreePlugin extends BaseGridPlugin<TreeConfig> {
  static override readonly manifest: PluginManifest = {
    modifiesRowStructure: true,
    hookPriority: {
      processRows: 10, // Run after ServerSide (-10) so we receive managedNodes[]
    },
    incompatibleWith: [
      {
        name: 'groupingRows',
        reason:
          'Both plugins transform the entire row model. TreePlugin flattens nested hierarchies while ' +
          'GroupingRowsPlugin groups flat rows with synthetic headers. Use one approach per grid.',
      },
      {
        name: 'pivot',
        reason:
          'PivotPlugin replaces the entire row and column structure with aggregated pivot data. ' +
          'Tree hierarchy cannot coexist with pivot aggregation.',
      },
    ],
    events: [
      {
        type: 'tree-expand',
        description:
          'Emitted when tree expansion state changes (toggle, expand all, collapse all). Broadcast to both DOM consumers and plugin bus.',
      },
      {
        type: 'tree-load-start',
        description: 'Emitted when lazy child loading starts for a node whose children are not yet loaded.',
      },
      {
        type: 'tree-load-end',
        description: 'Emitted when lazy child loading completes and children have been merged into the parent row.',
      },
      {
        type: 'tree-load-error',
        description: 'Emitted when lazy child loading fails. The node leaves its loading state and can be retried.',
      },
    ],
    queries: [
      {
        type: 'canMoveRow',
        description: 'Returns false for rows with children (parent nodes cannot be reordered)',
      },
      {
        type: 'datasource:viewport-mapping',
        description: 'Translates flat viewport row indices to top-level node indices for ServerSide pagination.',
      },
    ],
  };

  /**
   * Optional dependency on MultiSort for coordinated sorting.
   * When MultiSort is loaded, Tree defers header click sorting to it and queries the
   * sort model in processRows. When MultiSort is absent, Tree uses its own sort state.
   */
  static override readonly dependencies = [
    { name: 'multiSort', required: false, reason: 'Queries sort model for coordinated tree sorting' },
    { name: 'serverSide', required: false, reason: 'Consumes datasource events for lazy-loaded tree data' },
  ];

  /** @internal */
  readonly name = 'tree';
  /** @internal */
  override readonly styles = styles;

  /** @internal */
  protected override get defaultConfig(): Partial<TreeConfig> {
    return {
      childrenField: 'children',
      autoDetect: true,
      defaultExpanded: false,
      indentWidth: 20,
      showExpandIcons: true,
      animation: 'slide',
    };
  }

  // #region State

  private expandedKeys = new Set<string>();
  private initialExpansionDone = false;
  private flattenedRows: FlattenedTreeRow[] = [];
  private rowKeyMap = new Map<string, FlattenedTreeRow>();
  private previousVisibleKeys = new Set<string>();
  private keysToAnimate = new Set<string>();
  private sortState: { field: string; direction: 1 | -1 } | null = null;
  /** Keys of nodes that are currently loading lazy children. */
  private loadingKeys = new Set<string>();
  /**
   * Keys whose children have already been fetched. Prevents a re-fetch on
   * collapse → re-expand, and prevents an infinite retry loop when a node
   * legitimately resolves to zero children but a custom `hasChildren`
   * predicate keeps reporting `true`.
   */
  private loadedKeys = new Set<string>();
  /** In-flight local `loadChildren` requests, keyed by node key. */
  #childRequests = new Map<string, AbortController>();

  /**
   * Stable key cache keyed by row identity.
   * Persists across sort operations (object identity is preserved by sort);
   * replaces the previous `__stableKey` field-mutation approach so that
   * `_rows[i]` remains the user's original row reference and `updateRow(s)`
   * mutations survive the next `processRows` rebuild.
   *
   * INVARIANT: never mutate row objects to attach tree metadata — keep all
   * tree-specific state in this map and `#rowMeta` (see plugin-author rule
   * in `.github/knowledge/grid-plugins.md`).
   */
  #rowKeys = new WeakMap<object, string>();

  /**
   * Per-row tree metadata (depth, hasChildren, isExpanded, key) keyed by
   * row identity. Looked up by the column renderer via {@link getRowMeta}.
   * Reassigned to a fresh `WeakMap` at the start of each `processRows` call so
   * collapsed/hidden rows don't return stale metadata from a prior pass.
   */
  #rowMeta = new WeakMap<object, FlattenedTreeRow>();

  /** Cached original (unwrapped) renderer to prevent re-wrapping on repeated processColumns calls. */
  private originalTreeColumnRenderer: ColumnViewRenderer | undefined;
  /** Field name of the column currently wrapped with tree decorations. */
  private wrappedTreeColumnField: string | undefined;

  /** @internal */
  override detach(): void {
    // Restore default `role="grid"` on the rows-body so the grid stays
    // ARIA-valid after the plugin is removed (template default lives in
    // `core/internal/dom-builder.ts`). See WAI-ARIA Treegrid pattern.
    const rowsBody = this.gridElement?.querySelector('.rows-body');
    rowsBody?.setAttribute('role', 'grid');

    this.expandedKeys.clear();
    this.initialExpansionDone = false;
    this.flattenedRows = [];
    this.rowKeyMap.clear();
    this.previousVisibleKeys.clear();
    this.keysToAnimate.clear();
    this.sortState = null;
    this.loadingKeys.clear();
    this.loadedKeys.clear();
    for (const controller of this.#childRequests.values()) controller.abort();
    this.#childRequests.clear();
    this.originalTreeColumnRenderer = undefined;
    this.wrappedTreeColumnField = undefined;
    // WeakMaps GC themselves once row references are dropped — nothing to clear.
  }

  /**
   * Handle plugin queries.
   * @internal
   */
  override handleQuery(query: PluginQuery): unknown {
    if (query.type === 'canMoveRow') {
      // Tree rows with children cannot be reordered
      const row = query.context as { [key: string]: unknown } | null | undefined;
      const childrenField = this.config.childrenField ?? 'children';
      const children = row?.[childrenField];
      if (Array.isArray(children) && children.length > 0) {
        return false;
      }
    }

    if (query.type === 'datasource:viewport-mapping') {
      // Translate visible flat row indices → top-level node indices for ServerSide pagination
      const { viewportStart, viewportEnd } = query.context as ViewportMappingQuery;
      if (this.flattenedRows.length === 0) return undefined;

      const startNode = getTopLevelNodeIndex(this.flattenedRows, viewportStart);
      const endNode = getTopLevelNodeIndex(this.flattenedRows, viewportEnd) + 1; // exclusive
      const totalLoadedNodes = countTopLevelNodes(this.flattenedRows);

      return { startNode, endNode, totalLoadedNodes } satisfies ViewportMappingResponse;
    }

    return undefined;
  }

  // #endregion

  // #region Lifecycle

  /** @internal */
  override attach(grid: GridElement): void {
    super.attach(grid);

    // Listen for datasource:data from ServerSidePlugin — claim data for tree processing
    this.on('datasource:data', (detail: unknown) => {
      const d = detail as DataSourceDataDetail;
      if (!d.claimed) {
        d.claimed = true;
      }
      // Data flows through processRows pipeline — Tree receives it via the rows parameter
      // since ServerSide's processRows (hookPriority -10) runs first and returns managedNodes[]
    });

    // Listen for datasource:children — consume child rows from ServerSide
    this.on('datasource:children', (detail: unknown) => {
      const d = detail as DataSourceChildrenDetail;
      if (d.context?.source !== 'tree') return;
      d.claimed = true;

      // Merge children into the parent node
      const parentRow = d.context.parentNode as TreeRow | undefined;
      if (parentRow) {
        const key = this.#keyOf(parentRow);
        this.#mergeChildren(parentRow, (d.rows ?? []) as TreeRow[]);
        this.loadingKeys.delete(key);
        this.broadcast<TreeLoadEndDetail>('tree-load-end', {
          key,
          row: parentRow,
          depth: this.rowKeyMap.get(key)?.depth ?? 0,
          childCount: d.rows?.length ?? 0,
        });
        this.requestRender();
      }
    });

    // Listen for datasource:error — release the node's loading state so the
    // user can retry by collapsing and re-expanding. Without this the key
    // stays in `loadingKeys` forever and `requestLazyChildren` short-circuits.
    this.on('datasource:error', (detail: unknown) => {
      const d = detail as DataSourceErrorDetail;
      if (d.context?.source !== 'tree') return;
      const parentRow = d.context.parentNode as TreeRow | undefined;
      if (!parentRow) return;
      const key = this.#keyOf(parentRow);
      if (!this.loadingKeys.delete(key)) return;
      this.broadcast<TreeLoadErrorDetail>('tree-load-error', {
        key,
        row: parentRow,
        depth: this.rowKeyMap.get(key)?.depth ?? 0,
        error: d.error,
      });
      this.requestRender();
    });
  }

  // #endregion

  // #region Animation

  /**
   * Get expand/collapse animation style from plugin config.
   * Uses base class isAnimationEnabled to respect grid-level settings.
   */
  private get animationStyle(): ExpandCollapseAnimation {
    if (!this.isAnimationEnabled) return false;
    return this.config.animation ?? 'slide';
  }

  // #endregion

  // #region Auto-Detection

  detect(rows: readonly unknown[]): boolean {
    if (!this.config.autoDetect) return false;
    const treeRows = rows as readonly TreeRow[];
    const field = this.config.childrenField ?? inferChildrenField(treeRows) ?? 'children';
    return detectTreeStructure(treeRows, field);
  }

  // #endregion

  // #region Data Processing

  /** @internal */
  override processRows(rows: readonly unknown[]): TreeRow[] {
    const childrenField = this.config.childrenField ?? 'children';

    const treeRows = rows as readonly TreeRow[];

    if (treeRows.length === 0 || !detectTreeStructure(treeRows, childrenField, this.config.hasChildren)) {
      this.flattenedRows = [];
      this.rowKeyMap.clear();
      this.previousVisibleKeys.clear();
      // _rows[i] must remain the user's row reference. Return a shallow array
      // copy (so callers can't mutate the input array via the returned ref)
      // but DO NOT spread/clone the row objects themselves.
      return [...rows] as TreeRow[];
    }

    // Initialize expansion if needed.
    // When MultiSort is active, use its model instead of local sort state so
    // Tree and MultiSort don't fight over sort ownership.
    const effectiveSortState = this.resolveEffectiveSortState();

    if (this.config.defaultExpanded && !this.initialExpansionDone) {
      this.expandedKeys = expandAll(treeRows, this.config);
      this.initialExpansionDone = true;
    }

    // Single pass: sort + flatten in one walk, never cloning row objects.
    // `data` on each FlattenedTreeRow stays === the user's source row.
    this.flattenedRows = this.#flattenWithSort(treeRows, this.expandedKeys, effectiveSortState, null, 0);

    // Reset per-row metadata so rows that are no longer in the flattened
    // output (e.g. children of a now-collapsed parent) don't keep returning
    // stale entries via getRowMeta(). WeakMap reassignment is cheap and the
    // old map becomes GC-eligible immediately.
    this.#rowMeta = new WeakMap();
    this.rowKeyMap.clear();
    this.keysToAnimate.clear();
    const currentKeys = new Set<string>();

    for (const row of this.flattenedRows) {
      this.rowKeyMap.set(row.key, row);
      this.#rowMeta.set(row.data as object, row);
      currentKeys.add(row.key);
      if (!this.previousVisibleKeys.has(row.key) && row.depth > 0) {
        this.keysToAnimate.add(row.key);
      }
    }
    this.previousVisibleKeys = currentKeys;

    // Return source row references directly. Tree metadata (depth/key/etc.)
    // is read by the renderer via `getRowMeta(row)` instead of being spread
    // onto cloned row objects \u2014 this keeps `_rows[i]` === user's row so that
    // `grid.updateRow(s)` mutations survive the next ROWS-phase rebuild.
    return this.flattenedRows.map((r) => r.data);
  }

  /**
   * Resolve the stable key for a row, caching by identity in {@link #rowKeys}.
   * Prefers `row.id` (already stable across sort), then any previously cached
   * key for this row reference, then falls back to a path-based key.
   */
  #keyFor(row: TreeRow, index: number, parentKey: string | null): string {
    if (row.id !== undefined) {
      const key = String(row.id);
      this.#rowKeys.set(row as object, key);
      return key;
    }
    const cached = this.#rowKeys.get(row as object);
    if (cached !== undefined) return cached;
    const key = parentKey ? `${parentKey}-${index}` : String(index);
    this.#rowKeys.set(row as object, key);
    return key;
  }

  /**
   * Recursive single-pass sort + flatten.
   * - Per-level sort uses `[...rows].sort(...)` which produces a new array of
   *   the SAME row references in a new order \u2014 never spreads the row objects.
   * - Children arrays are NOT mutated on the source rows; the sort produces a
   *   transient ordering used only for traversal.
   */
  #flattenWithSort(
    rows: readonly TreeRow[],
    expanded: Set<string>,
    sort: { field: string; direction: 1 | -1 } | null,
    parentKey: string | null,
    depth: number,
  ): FlattenedTreeRow[] {
    const childrenField = this.config.childrenField ?? 'children';
    // Assign stable keys using the ORIGINAL (unsorted) index so that
    // path-based keys match those produced by `expandAll` (which walks the
    // tree in source order). `#keyFor` caches by row identity, so the
    // subsequent lookup in the post-sort loop returns the same key.
    for (let i = 0; i < rows.length; i++) {
      this.#keyFor(rows[i], i, parentKey);
    }
    const ordered = sort ? this.#sortLevel(rows, sort.field, sort.direction) : rows;
    const result: FlattenedTreeRow[] = [];
    const hasChildrenFn = this.config.hasChildren;

    for (let i = 0; i < ordered.length; i++) {
      const row = ordered[i];
      const key = this.#keyFor(row, i, parentKey);
      const children = row[childrenField];
      const embeddedChildren = Array.isArray(children) && children.length > 0;
      // Lazy children: either a custom `hasChildren` predicate reports the node
      // has children, or (default heuristic) a truthy non-array value such as
      // `children: true` signals children exist but haven't been fetched yet.
      const hasChildren =
        embeddedChildren ||
        (hasChildrenFn ? hasChildrenFn(row) : children != null && !Array.isArray(children) && !!children);
      const isExpanded = expanded.has(key);

      result.push({
        key,
        data: row,
        depth,
        hasChildren,
        isExpanded,
        parentKey,
        posInSet: i + 1,
        setSize: ordered.length,
      });

      if (embeddedChildren && isExpanded) {
        result.push(...this.#flattenWithSort(children as TreeRow[], expanded, sort, key, depth + 1));
      }
    }
    return result;
  }

  /**
   * Sort rows at a single level, returning a new array of the SAME row references
   * in sorted order. Never clones row objects, and never mutates the input array
   * (children arrays are user-owned for tree rows — we always pass a shallow copy
   * to the handler so a custom in-place sortHandler can't corrupt user data).
   *
   * Delegates to the same handler chain core uses: `gridConfig.sortHandler` when
   * provided, otherwise `builtInSort` (which honors per-column `sortComparator`
   * and `valueAccessor`). Async handlers cannot be awaited inside the synchronous
   * tree flatten — fall back to `builtInSort` when one is detected, and swallow
   * any rejection so it doesn't surface as an unhandled promise rejection.
   */
  #sortLevel(rows: readonly TreeRow[], field: string, dir: 1 | -1): TreeRow[] {
    const host = this.grid as unknown as GridHost<TreeRow> | undefined;
    const columns = (host?._columns ?? []) as ColumnConfig<TreeRow>[];
    const handler: SortHandler<TreeRow> = host?.effectiveConfig?.sortHandler ?? builtInSort;
    const sortState = { field, direction: dir };
    // Always pass a shallow copy: `rows` may be a user-owned `row.children`
    // array, and a non-defensive sortHandler could otherwise mutate it.
    const input = [...rows] as TreeRow[];
    const result = handler(input, sortState, columns);
    if (result && typeof (result as Promise<unknown[]>).then === 'function') {
      void (result as Promise<unknown[]>).catch(() => undefined);
      return builtInSort(input, sortState, columns);
    }
    return result as TreeRow[];
  }

  /**
   * Look up the stable key by row identity (was stored on the row as
   * `__stableKey` historically; now lives in a parallel WeakMap to keep row
   * identity intact).
   */
  #keyOf(row: TreeRow): string {
    return this.#rowKeys.get(row as object) ?? String(row.id ?? '?');
  }

  /** Write fetched children onto the parent row and mark the node as loaded. */
  #mergeChildren(row: TreeRow, children: TreeRow[]): void {
    (row as Record<string, unknown>)[this.config.childrenField ?? 'children'] = children;
    this.loadedKeys.add(this.#keyOf(row));
  }

  /**
   * Whether a node's children still need to be fetched — it reports having
   * children (via the lazy indicator or a custom `hasChildren` predicate) but
   * none are embedded yet, and no previous fetch has already resolved.
   */
  #needsChildFetch(row: TreeRow, key: string): boolean {
    if (this.loadedKeys.has(key)) return false;
    const children = row[this.config.childrenField ?? 'children'];
    if (Array.isArray(children) && children.length > 0) return false;
    const custom = this.config.hasChildren;
    return custom ? custom(row) : children != null && !Array.isArray(children) && !!children;
  }

  /**
   * Request lazy children for a node that is being expanded.
   *
   * Two routes, in precedence order:
   * 1. **ServerSide** — when `ServerSidePlugin` is active, dispatch the
   *    `datasource:fetch-children` query; the result arrives asynchronously as
   *    a `datasource:children` (or `datasource:error`) broadcast.
   * 2. **Local `loadChildren`** — invoke the config callback directly. Works
   *    without `ServerSidePlugin` for grids that only need lazy tree children
   *    and not server-side root pagination/sorting/filtering.
   *
   * No-op when neither route is configured, the node is already loading, or
   * its children are already embedded.
   */
  private requestLazyChildren(flatRow: FlattenedTreeRow): void {
    const { key, depth, data: row } = flatRow;
    if (this.loadingKeys.has(key)) return;
    if (!this.#needsChildFetch(row, key)) return;

    const isServerSideActive = this.queryBoolean('datasource:is-active');
    const { loadChildren } = this.config;
    if (!isServerSideActive && !loadChildren) return;

    this.loadingKeys.add(key);
    this.broadcast<TreeLoadStartDetail>('tree-load-start', { key, row, depth });

    if (isServerSideActive) {
      this.grid.query('datasource:fetch-children', {
        context: { source: 'tree', parentNode: row, nodePath: [key] },
      } satisfies FetchChildrenQuery);
      return;
    }

    this.#loadChildrenLocally(key, row, depth);
  }

  /**
   * Drive the local `loadChildren` callback. Supports both `Promise` and
   * `Subscribable` results; the subscription is torn down on abort so an
   * Angular `HttpClient` request is cancelled natively.
   */
  #loadChildrenLocally(key: string, row: TreeRow, depth: number): void {
    // A callback is guaranteed by the caller's guard.
    const loadChildren = this.config.loadChildren as NonNullable<TreeConfig['loadChildren']>;
    const controller = new AbortController();
    this.#childRequests.set(key, controller);

    const finish = (): boolean => {
      // Superseded or detached — drop the result silently.
      if (controller.signal.aborted) return false;
      this.#childRequests.delete(key);
      this.loadingKeys.delete(key);
      return true;
    };

    const onSuccess = (rows: TreeRow[] | null | undefined) => {
      if (!finish()) return;
      const children = rows ?? [];
      this.#mergeChildren(row, children);
      this.broadcast<TreeLoadEndDetail>('tree-load-end', { key, row, depth, childCount: children.length });
      this.requestRender();
    };

    const onError = (error: unknown) => {
      if (!finish()) return;
      this.broadcast<TreeLoadErrorDetail>('tree-load-error', { key, row, depth, error });
      this.requestRender();
    };

    let result: Promise<TreeRow[]> | Subscribable<TreeRow[]>;
    try {
      result = loadChildren({ row, key, depth, signal: controller.signal });
    } catch (error) {
      onError(error);
      return;
    }

    if (result && isSubscribable(result)) {
      // Take-one semantics: `onSuccess`/`onError` are single-shot (guarded by
      // `finish()`), so hold the subscription only until the first emission.
      // Without this, a source that never completes (a subject-like stream)
      // stays subscribed forever once its value has been consumed, because
      // `finish()` has already removed the controller that `detach()` aborts.
      let settled = false;
      let active: { unsubscribe(): void } | null = null;
      const release = (): void => {
        settled = true;
        active?.unsubscribe();
        active = null;
      };
      const subscription = result.subscribe({
        next: (rows) => {
          onSuccess(rows);
          release();
        },
        error: (error) => {
          onError(error);
          release();
        },
      });
      // A synchronous emission ran `release()` before `subscription` was bound.
      if (settled) {
        subscription.unsubscribe();
        return;
      }
      active = subscription;
      controller.signal.addEventListener('abort', release, { once: true });
      return;
    }
    Promise.resolve(result).then(onSuccess, onError);
  }

  /**
   * Resolve the effective sort state: prefer MultiSort's model when available,
   * fall back to local tree sort state.
   * This follows the same pattern as GroupingRowsPlugin.resolveGroupSortDirections.
   */
  private resolveEffectiveSortState(): { field: string; direction: 1 | -1 } | null {
    // When MultiSort is loaded, prefer its model for consistency
    const multiSortResults = this.grid?.query?.('sort:get-model', null);
    if (Array.isArray(multiSortResults) && multiSortResults.length > 0) {
      const sortModel = multiSortResults[0] as Array<{ field: string; direction: 'asc' | 'desc' }>;
      if (Array.isArray(sortModel) && sortModel.length > 0) {
        // Use the primary sort column from MultiSort
        return {
          field: sortModel[0].field,
          direction: sortModel[0].direction === 'desc' ? -1 : 1,
        };
      }
    }
    // Fallback: local sort state (when MultiSort is not loaded)
    return this.sortState;
  }

  /** @internal */
  override processColumns(columns: readonly ColumnConfig[]): ColumnConfig[] {
    if (this.flattenedRows.length === 0) return [...columns];

    const cols = [...columns] as ColumnConfig[];
    if (cols.length === 0) return cols;

    // Determine which column gets the tree toggle and indentation.
    // If treeColumn is configured, find it by field name; otherwise use the first column.
    const { treeColumn } = this.config;
    let targetIndex = 0;
    if (treeColumn) {
      const idx = cols.findIndex((c) => c.field === treeColumn);
      if (idx >= 0) targetIndex = idx;
    }
    const targetCol = cols[targetIndex];
    const targetField = targetCol.field;

    // Capture the original (unwrapped) renderer only once per target column.
    // On subsequent processColumns calls, reuse the cached original so we
    // don't nest tree-cell-wrappers.
    if (this.wrappedTreeColumnField !== targetField) {
      this.originalTreeColumnRenderer = targetCol.viewRenderer;
      this.wrappedTreeColumnField = targetField;
    }
    const originalRenderer = this.originalTreeColumnRenderer;
    const getConfig = () => this.config;
    const setIconFn = this.setIcon.bind(this);

    const wrappedRenderer: ColumnViewRenderer = (ctx) => {
      const { row, value } = ctx;
      const { showExpandIcons = true, indentWidth } = getConfig();
      const meta = this.#rowMeta.get(row as object);
      const depth = meta?.depth ?? 0;

      const container = document.createElement('span');
      container.className = 'tree-cell-wrapper';
      container.style.setProperty('--tbw-tree-depth', String(depth));
      // Allow config-based indentWidth to override CSS default
      if (indentWidth !== undefined) {
        container.style.setProperty('--tbw-tree-indent-width', `${indentWidth}px`);
      }

      // Add expand/collapse icon, loading spinner, or spacer
      if (showExpandIcons) {
        if (meta && this.loadingKeys.has(meta.key)) {
          // Reuse the core loading UI (`.tbw-spinner--small`) instead of a
          // tree-specific indicator so custom spinner theming applies here too.
          const spinner = createDefaultSpinner('small');
          spinner.classList.add('tree-loading');
          container.appendChild(spinner);
        } else if (meta && meta.hasChildren) {
          const icon = document.createElement('span');
          icon.className = `${GridClasses.TREE_TOGGLE}${meta.isExpanded ? ` ${GridClasses.EXPANDED}` : ''}`;
          setIconFn(icon, meta.isExpanded ? 'collapse' : 'expand');
          icon.setAttribute('data-tree-key', meta.key);
          container.appendChild(icon);
        } else {
          const spacer = document.createElement('span');
          spacer.className = 'tree-spacer';
          container.appendChild(spacer);
        }
      }

      // Add the original content
      const content = document.createElement('span');
      content.className = 'tree-content';
      if (originalRenderer) {
        const result = originalRenderer(ctx);
        if (result instanceof Node) {
          content.appendChild(result);
        } else if (typeof result === 'string') {
          setSanitizedHTML(content, result);
        }
      } else {
        content.textContent = value != null ? String(value) : '';
      }
      container.appendChild(content);

      return container;
    };

    cols[targetIndex] = { ...targetCol, viewRenderer: wrappedRenderer };
    return cols;
  }

  // #endregion

  // #region Event Handlers

  /** @internal */
  override onCellClick(event: CellClickEvent): boolean {
    const target = event.originalEvent?.target as HTMLElement;
    if (!target?.classList.contains(GridClasses.TREE_TOGGLE)) return false;

    const key = target.getAttribute('data-tree-key');
    if (!key) return false;

    const flatRow = this.rowKeyMap.get(key);
    if (!flatRow) return false;

    this.expandedKeys = toggleExpand(this.expandedKeys, key);

    // Request lazy children when expanding a node without embedded children
    if (this.expandedKeys.has(key)) {
      this.requestLazyChildren(flatRow);
    }

    this.broadcast<TreeExpandDetail>('tree-expand', {
      key,
      row: flatRow.data,
      expanded: this.expandedKeys.has(key),
      depth: flatRow.depth,
      expandedKeys: [...this.expandedKeys],
    });
    this.requestRender();
    return true;
  }

  /** @internal */
  override onKeyDown(event: KeyboardEvent): boolean | void {
    // SPACE toggles expansion when on a row with children
    if (event.key !== ' ') return;

    const focusRow = this.grid._focusRow;
    const flatRow = this.flattenedRows[focusRow];
    if (!flatRow?.hasChildren) return;

    event.preventDefault();
    this.expandedKeys = toggleExpand(this.expandedKeys, flatRow.key);

    // Request lazy children when expanding a node without embedded children
    if (this.expandedKeys.has(flatRow.key)) {
      this.requestLazyChildren(flatRow);
    }

    this.broadcast<TreeExpandDetail>('tree-expand', {
      key: flatRow.key,
      row: flatRow.data,
      expanded: this.expandedKeys.has(flatRow.key),
      depth: flatRow.depth,
      expandedKeys: [...this.expandedKeys],
    });
    this.requestRenderWithFocus();
    return true;
  }

  /** @internal */
  override onHeaderClick(event: HeaderClickEvent): boolean {
    if (this.flattenedRows.length === 0 || !event.column.sortable) return false;

    // When MultiSort is active, let it handle header clicks entirely.
    // Tree will pick up the sort model in processRows via resolveEffectiveSortState().
    const multiSortResults = this.grid?.query?.('sort:get-model', null);
    if (Array.isArray(multiSortResults) && multiSortResults.length > 0) {
      // MultiSort is loaded — don't consume the event, let MultiSort handle it
      return false;
    }

    // Fallback: manage own sort state when MultiSort is not loaded
    const { field } = event.column;
    if (!this.sortState || this.sortState.field !== field) {
      this.sortState = { field, direction: 1 };
    } else if (this.sortState.direction === 1) {
      this.sortState = { field, direction: -1 };
    } else {
      this.sortState = null;
    }

    // Sync grid sort indicator
    const gridEl = this.grid as unknown as GridHost;
    if (gridEl._sortState !== undefined) {
      gridEl._sortState = this.sortState ? { ...this.sortState } : null;
    }

    this.broadcast('sort-change', { field, direction: this.sortState?.direction ?? 0 });
    this.requestRender();
    return true;
  }

  /** @internal */
  override afterRender(): void {
    // Tree introduces hierarchy → switch the rows-body role from `grid` to
    // `treegrid` per WAI-ARIA so `aria-expanded` / `aria-level` /
    // `aria-setsize` / `aria-posinset` are valid in context. Idempotent
    // setAttribute call; cheap on the hot path.
    const rowsBody = this.gridElement?.querySelector('.rows-body');
    if (rowsBody && rowsBody.getAttribute('role') !== 'treegrid') {
      rowsBody.setAttribute('role', 'treegrid');
    }

    const body = this.gridElement?.querySelector('.rows');
    if (!body) return;

    const style = this.animationStyle;
    const shouldAnimate = style !== false && this.keysToAnimate.size > 0;
    const animClass = style === 'fade' ? 'tbw-tree-fade-in' : 'tbw-tree-slide-in';

    for (const rowEl of body.querySelectorAll('.data-grid-row')) {
      const cell = rowEl.querySelector('.cell[data-row]');
      const idx = cell ? parseInt(cell.getAttribute('data-row') ?? '-1', 10) : -1;
      const treeRow = this.flattenedRows[idx];
      if (!treeRow) continue;

      // WAI-ARIA Treegrid: every row carries level/setsize/posinset so screen
      // readers can announce "level 2, item 3 of 5" while navigating.
      rowEl.setAttribute('aria-level', String(treeRow.depth + 1));
      rowEl.setAttribute('aria-setsize', String(treeRow.setSize));
      rowEl.setAttribute('aria-posinset', String(treeRow.posInSet));

      // Set aria-expanded on parent rows for screen readers. MUST clear it
      // on leaf rows: virtualization recycles row DOM elements, so a leaf
      // row reusing a previously-expanded parent's element would otherwise
      // inherit a stale `aria-expanded="true"` (issue #282). The matching
      // `.tbw-row-expanded` class is the public hook for theming expanded
      // rows — devs should style against the class, not the ARIA attribute.
      if (treeRow.hasChildren) {
        rowEl.setAttribute('aria-expanded', String(treeRow.isExpanded));
      } else if (rowEl.hasAttribute('aria-expanded')) {
        rowEl.removeAttribute('aria-expanded');
      }
      rowEl.classList.toggle('tbw-row-expanded', treeRow.hasChildren && treeRow.isExpanded);

      // Announce in-flight lazy child loading. MUST clear on the negative
      // branch — virtualization recycles row elements, so a row reusing a
      // previously-loading element would inherit a stale `aria-busy`.
      if (this.loadingKeys.has(treeRow.key)) {
        rowEl.setAttribute('aria-busy', 'true');
      } else if (rowEl.hasAttribute('aria-busy')) {
        rowEl.removeAttribute('aria-busy');
      }

      if (shouldAnimate && treeRow.key && this.keysToAnimate.has(treeRow.key)) {
        rowEl.classList.add(animClass);
        rowEl.addEventListener('animationend', () => rowEl.classList.remove(animClass), { once: true });
      }
    }
    this.keysToAnimate.clear();
  }

  // #endregion

  // #region Public API

  /**
   * Expand a specific tree node, revealing its children.
   *
   * If the node is already expanded, this is a no-op.
   * Does **not** emit a `tree-expand` event (use {@link toggle} for event emission).
   *
   * @param key - The unique key of the node to expand (from {@link FlattenedTreeRow.key})
   *
   * @example
   * ```ts
   * const tree = grid.getPluginByName('tree');
   * tree.expand('documents');          // Expand a root node
   * tree.expand('documents||reports');  // Expand a nested node
   * ```
   */
  expand(key: string): void {
    this.expandedKeys.add(key);
    const flatRow = this.rowKeyMap.get(key);
    if (flatRow) {
      this.requestLazyChildren(flatRow);
    }
    this.requestRender();
  }

  /**
   * Collapse a specific tree node, hiding its children.
   *
   * If the node is already collapsed, this is a no-op.
   * Does **not** emit a `tree-expand` event (use {@link toggle} for event emission).
   *
   * @param key - The unique key of the node to collapse (from {@link FlattenedTreeRow.key})
   *
   * @example
   * ```ts
   * const tree = grid.getPluginByName('tree');
   * tree.collapse('documents');
   * ```
   */
  collapse(key: string): void {
    this.expandedKeys.delete(key);
    this.requestRender();
  }

  /**
   * Toggle the expanded state of a tree node.
   *
   * If the node is expanded it will be collapsed, and vice versa.
   * Emits a `tree-expand` event (broadcast to both DOM consumers and plugin bus).
   *
   * @param key - The unique key of the node to toggle (from {@link FlattenedTreeRow.key})
   *
   * @example
   * ```ts
   * const tree = grid.getPluginByName('tree');
   * tree.toggle('documents');  // Expand if collapsed, collapse if expanded
   * ```
   */
  toggle(key: string): void {
    this.expandedKeys = toggleExpand(this.expandedKeys, key);
    const flatRow = this.rowKeyMap.get(key);
    if (flatRow) {
      // Request lazy children when expanding a node without embedded children
      if (this.expandedKeys.has(key)) {
        this.requestLazyChildren(flatRow);
      }
      this.broadcast<TreeExpandDetail>('tree-expand', {
        key,
        row: flatRow.data,
        expanded: this.expandedKeys.has(key),
        depth: flatRow.depth,
        expandedKeys: [...this.expandedKeys],
      });
    } else {
      this.emitPluginEvent('tree-expand', { expandedKeys: [...this.expandedKeys] });
    }
    this.requestRender();
  }

  /**
   * Expand all tree nodes recursively.
   *
   * Every node with children will be expanded, revealing the full tree hierarchy.
   * Emits a `tree-expand` plugin event.
   *
   * @example
   * ```ts
   * const tree = grid.getPluginByName('tree');
   * tree.expandAll();
   * ```
   */
  expandAll(): void {
    this.expandedKeys = expandAll(this.rows as TreeRow[], this.config);
    this.emitPluginEvent('tree-expand', { expandedKeys: [...this.expandedKeys] });
    this.requestRender();
  }

  /**
   * Collapse all tree nodes.
   *
   * Every node will be collapsed, showing only root-level rows.
   * Emits a `tree-expand` plugin event.
   *
   * @example
   * ```ts
   * const tree = grid.getPluginByName('tree');
   * tree.collapseAll();
   * ```
   */
  collapseAll(): void {
    this.expandedKeys = collapseAll();
    this.emitPluginEvent('tree-expand', { expandedKeys: [...this.expandedKeys] });
    this.requestRender();
  }

  /**
   * Check whether a specific tree node is currently expanded.
   *
   * @param key - The unique key of the node to check
   * @returns `true` if the node is expanded, `false` otherwise
   */
  isExpanded(key: string): boolean {
    return this.expandedKeys.has(key);
  }

  /**
   * Get the keys of all currently expanded nodes.
   *
   * Returns a snapshot copy — mutating the returned array does not affect the tree state.
   *
   * @returns Array of expanded node keys
   *
   * @example
   * ```ts
   * const tree = grid.getPluginByName('tree');
   * const keys = tree.getExpandedKeys();
   * localStorage.setItem('treeState', JSON.stringify(keys));
   * ```
   */
  getExpandedKeys(): string[] {
    return [...this.expandedKeys];
  }

  /**
   * Get the flattened row model used for rendering.
   *
   * Returns a snapshot copy of the internal flattened tree rows, including
   * hierarchy metadata (depth, hasChildren, isExpanded, parentKey).
   *
   * @returns Array of {@link FlattenedTreeRow} objects
   */
  getFlattenedRows(): FlattenedTreeRow[] {
    return [...this.flattenedRows];
  }

  /**
   * Get tree metadata (depth, key, hasChildren, isExpanded, parentKey) for a
   * specific row reference. Returns `undefined` if the row is not part of the
   * currently-flattened tree (e.g. collapsed under a parent or never processed).
   *
   * Tree metadata lives in a parallel WeakMap keyed by row identity \u2014 it is
   * NOT stored on the row object itself. This preserves the invariant that
   * `_rows[i]` IS the user's source row reference, so `grid.updateRow(s)`
   * mutations survive the next ROWS-phase rebuild.
   *
   * @example
   * ```ts
   * const tree = grid.getPluginByName('tree');
   * const meta = tree.getRowMeta(grid.rows[0]);
   * console.log(meta?.depth, meta?.hasChildren);
   * ```
   */
  getRowMeta(row: TreeRow): FlattenedTreeRow | undefined {
    return this.#rowMeta.get(row as object);
  }

  /**
   * Look up an original row data object by its tree key.
   *
   * @param key - The unique key of the node
   * @returns The original row data, or `undefined` if not found
   */
  getRowByKey(key: string): TreeRow | undefined {
    return this.rowKeyMap.get(key)?.data;
  }

  /**
   * Expand all ancestor nodes of the target key, revealing it in the tree.
   *
   * Useful for "scroll to node" or search-and-reveal scenarios where a deeply
   * nested node needs to be made visible.
   *
   * @param key - The unique key of the node to reveal
   *
   * @example
   * ```ts
   * const tree = grid.getPluginByName('tree');
   * // Reveal a deeply nested node by expanding all its parents
   * tree.expandToKey('root||child||grandchild');
   * ```
   */
  expandToKey(key: string): void {
    this.expandedKeys = expandToKey(this.rows as TreeRow[], key, this.config, this.expandedKeys);
    this.requestRender();
  }

  // #endregion
}
