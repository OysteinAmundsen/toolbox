/**
 * Tree Data Plugin Types
 *
 * Type definitions for hierarchical tree data with expand/collapse functionality.
 */

import type { ExpandCollapseAnimation } from '../../core/types';
import type { Subscribable } from '../server-side/datasource-types';
export type { ExpandCollapseAnimation } from '../../core/types';

/** Generic tree row with dynamic property access * @since 0.4.0
 */
export type TreeRow = Record<string, unknown>;

/**
 * Parameters passed to {@link TreeConfig.loadChildren} when a node whose
 * children are not yet loaded is expanded.
 *
 * @since 3.4.0
 */
export interface TreeLoadChildrenParams<T = TreeRow> {
  /** The parent row whose children are being fetched. */
  row: T;
  /** Stable key of the parent node (same value as {@link FlattenedTreeRow.key}). */
  key: string;
  /** Depth of the parent node (0 = root). */
  depth: number;
  /**
   * Cancellation signal. Aborted when the plugin detaches or the grid
   * disconnects. Pass it to `fetch(url, { signal })`. Implementations that
   * ignore it keep working — the superseded request simply completes on the
   * wire and its result is discarded.
   */
  signal: AbortSignal;
}

/**
 * Configuration options for the tree plugin.
 *
 * @example
 * ```ts
 * const grid = document.querySelector('tbw-grid');
 * grid.plugins = [
 *   new TreePlugin({
 *     childrenField: 'subItems',
 *     defaultExpanded: true,
 *     indentWidth: 24,
 *     animation: 'slide',
 *   }),
 * ];
 * ```
 * @since 0.1.1
 */
export interface TreeConfig {
  /** Field name containing child rows (default: 'children') */
  childrenField?: string;
  /** Auto-detect tree structure from data (default: true) */
  autoDetect?: boolean;
  /** Whether nodes are expanded by default (default: false) */
  defaultExpanded?: boolean;
  /** Indentation width per level in pixels (default: 20) */
  indentWidth?: number;
  /** Show expand/collapse icons (default: true) */
  showExpandIcons?: boolean;
  /**
   * Field name of the column that displays the tree toggle and indentation.
   * Defaults to the first visible column. Use this when the first column is
   * narrow (e.g. an ID column) or when combining with pinned columns.
   */
  treeColumn?: string;
  /**
   * Animation style for expanding/collapsing tree nodes.
   * - `false`: No animation
   * - `'slide'`: Slide animation (default)
   * - `'fade'`: Fade animation
   * @default 'slide'
   */
  animation?: ExpandCollapseAnimation;
  /**
   * Lazy-load child rows when a node is expanded.
   *
   * Called once per node the first time it is expanded while its children are
   * not yet loaded. The resolved rows are written to `row[childrenField]` and
   * the grid re-renders. While the request is in flight the node's toggle is
   * replaced by the grid's small spinner and the row carries `aria-busy`.
   *
   * Returns a `Promise` or a {@link Subscribable} (e.g. an Angular
   * `HttpClient` observable — the subscription is torn down on abort, which
   * natively cancels the underlying request).
   *
   * Ignored when {@link https://toolboxjs.com | ServerSidePlugin} is active —
   * child data then flows through `dataSource.getChildRows()` instead.
   *
   * Pair with {@link TreeConfig.hasChildren} when unloaded nodes cannot be
   * detected from the data alone.
   *
   * @example
   * ```ts
   * new TreePlugin({
   *   hasChildren: (row) => row.type === 'folder',
   *   loadChildren: async ({ row, signal }) => {
   *     const res = await fetch(`/api/nodes/${row.id}/children`, { signal });
   *     return res.json();
   *   },
   * })
   * ```
   * @since 3.4.0
   */
  loadChildren?: (params: TreeLoadChildrenParams) => Promise<TreeRow[]> | Subscribable<TreeRow[]>;
  /**
   * Predicate deciding whether a node has children, used to render the expand
   * toggle before the children are loaded.
   *
   * Defaults to the built-in heuristic: an array with entries means children
   * are embedded, any other truthy `row[childrenField]` value (e.g.
   * `children: true`) means children exist but are not loaded yet.
   *
   * A node with a non-empty embedded children array always counts as having
   * children regardless of what this predicate returns.
   *
   * @since 3.4.0
   */
  hasChildren?: (row: TreeRow) => boolean;
}

/** Internal state managed by the tree plugin */
export interface TreeState {
  /** Set of expanded row keys */
  expandedKeys: Set<string>;
  /** Whether initial expansion (based on defaultExpanded config) has been applied */
  initialExpansionDone: boolean;
  /** Flattened tree rows for rendering */
  flattenedRows: FlattenedTreeRow[];
  /** Map from key to flattened row for quick lookup */
  rowKeyMap: Map<string, FlattenedTreeRow>;
}

/** A flattened tree row with hierarchy metadata * @since 0.1.1
 */
export interface FlattenedTreeRow<T = TreeRow> {
  /** Unique key identifying this row */
  key: string;
  /** Original row data */
  data: T;
  /** Depth level in the tree (0 = root) */
  depth: number;
  /** Whether this row has children */
  hasChildren: boolean;
  /** Whether this row is currently expanded */
  isExpanded: boolean;
  /** Key of the parent row, or null for root level */
  parentKey: string | null;
  /** 1-based position among siblings at the same level (for `aria-posinset`). */
  posInSet: number;
  /** Total number of siblings at this level under the same parent (for `aria-setsize`). */
  setSize: number;
}

/** Event detail emitted when a tree node is expanded or collapsed * @since 0.1.1
 */
export interface TreeExpandDetail<T = TreeRow> {
  /** The row key that was toggled */
  key: string;
  /** The original row data */
  row: T;
  /** Whether the row is now expanded */
  expanded: boolean;
  /** Depth level of the row */
  depth: number;
  /** All currently expanded keys after the operation */
  expandedKeys?: string[];
}

/**
 * Event detail emitted when lazy child loading starts for a node.
 * @since 3.4.0
 */
export interface TreeLoadStartDetail<T = TreeRow> {
  /** Stable key of the node whose children are being fetched */
  key: string;
  /** The parent row data */
  row: T;
  /** Depth level of the parent node (0 = root) */
  depth: number;
}

/**
 * Event detail emitted when lazy child loading completes successfully.
 * @since 3.4.0
 */
export interface TreeLoadEndDetail<T = TreeRow> extends TreeLoadStartDetail<T> {
  /** Number of child rows received */
  childCount: number;
}

/**
 * Event detail emitted when lazy child loading fails.
 * @since 3.4.0
 */
export interface TreeLoadErrorDetail<T = TreeRow> extends TreeLoadStartDetail<T> {
  /** The rejection reason from `loadChildren` or the data source */
  error: unknown;
}

// Module Augmentation - Register plugin name for type-safe getPluginByName()
declare module '../../core/types' {
  interface DataGridEventMap {
    /** Fired when a tree node is expanded or collapsed. Provides the node key, row data, and depth level. @group Tree Events */
    'tree-expand': TreeExpandDetail;
    /**
     * Fired when lazy child loading starts for a node — i.e. a node with
     * unloaded children was expanded and `loadChildren` (or the ServerSide
     * data source) was invoked. @group Tree Events
     */
    'tree-load-start': TreeLoadStartDetail;
    /**
     * Fired when lazy child loading completes and the children have been
     * merged into the parent row. @group Tree Events
     */
    'tree-load-end': TreeLoadEndDetail;
    /**
     * Fired when lazy child loading fails. The node leaves its loading state
     * and re-expanding retries the fetch. @group Tree Events
     */
    'tree-load-error': TreeLoadErrorDetail;
  }

  interface PluginNameMap {
    tree: import('./TreePlugin').TreePlugin;
  }
}
