/**
 * Tree Data Plugin
 *
 * Enables hierarchical tree data with expand/collapse, sorting, and auto-detection.
 */

import { GridClasses } from '../../core/constants';
import type { GridElement } from '../../core/plugin/base-plugin';
import {
  BaseGridPlugin,
  CellClickEvent,
  HeaderClickEvent,
  type PluginManifest,
  type PluginQuery,
} from '../../core/plugin/base-plugin';
import type { ColumnConfig, ColumnViewRenderer, GridHost } from '../../core/types';
import type {
  DataSourceChildrenDetail,
  DataSourceDataDetail,
  FetchChildrenQuery,
  ViewportMappingQuery,
  ViewportMappingResponse,
} from '../server-side/datasource-types';
import { collapseAll, expandAll, expandToKey, toggleExpand } from './tree-data';
import { countTopLevelNodes, getTopLevelNodeIndex } from './tree-datasource';
import { detectTreeStructure, inferChildrenField } from './tree-detect';
import styles from './tree.css?inline';
import type { ExpandCollapseAnimation, FlattenedTreeRow, TreeConfig, TreeExpandDetail, TreeRow } from './types';

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
  /** Keys of nodes that are currently loading lazy children via ServerSide. */
  private loadingKeys = new Set<string>();

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
   * Repopulated each `processRows` call.
   */
  #rowMeta = new WeakMap<object, FlattenedTreeRow>();

  /** Cached original (unwrapped) renderer to prevent re-wrapping on repeated processColumns calls. */
  private originalTreeColumnRenderer: ColumnViewRenderer | undefined;
  /** Field name of the column currently wrapped with tree decorations. */
  private wrappedTreeColumnField: string | undefined;

  /** @internal */
  override detach(): void {
    this.expandedKeys.clear();
    this.initialExpansionDone = false;
    this.flattenedRows = [];
    this.rowKeyMap.clear();
    this.previousVisibleKeys.clear();
    this.keysToAnimate.clear();
    this.sortState = null;
    this.loadingKeys.clear();
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
        const childrenField = this.config.childrenField ?? 'children';
        (parentRow as Record<string, unknown>)[childrenField] = d.rows;
        // Look up the stable key by row identity (was stored on row as __stableKey
        // historically; now lives in a parallel WeakMap to keep row identity intact).
        const key = this.#rowKeys.get(parentRow as object) ?? String(parentRow.id ?? '?');
        this.loadingKeys.delete(key);
        this.requestRender();
      }
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

    if (treeRows.length === 0 || !detectTreeStructure(treeRows, childrenField)) {
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

    for (let i = 0; i < ordered.length; i++) {
      const row = ordered[i];
      const key = this.#keyFor(row, i, parentKey);
      const children = row[childrenField];
      const embeddedChildren = Array.isArray(children) && children.length > 0;
      // Lazy children: truthy non-array value (e.g. `children: true`) signals
      // that children exist on the server but haven't been fetched yet.
      const lazyChildren = children != null && !Array.isArray(children) && !!children;
      const hasChildren = embeddedChildren || lazyChildren;
      const isExpanded = expanded.has(key);

      result.push({
        key,
        data: row,
        depth,
        hasChildren,
        isExpanded,
        parentKey,
      });

      if (embeddedChildren && isExpanded) {
        result.push(...this.#flattenWithSort(children as TreeRow[], expanded, sort, key, depth + 1));
      }
    }
    return result;
  }

  /**
   * Sort rows at a single level, returning a new array of the SAME row references
   * in sorted order. Never clones row objects.
   */
  #sortLevel(rows: readonly TreeRow[], field: string, dir: 1 | -1): TreeRow[] {
    return [...rows].sort((a, b) => {
      const aVal = a[field],
        bVal = b[field];
      if (aVal == null && bVal == null) return 0;
      if (aVal == null) return -1;
      if (bVal == null) return 1;
      return aVal > bVal ? dir : aVal < bVal ? -dir : 0;
    });
  }

  /**
   * Request lazy children for a node via ServerSide's `datasource:fetch-children` query.
   * Called when expanding a node whose children are not yet embedded (lazy indicator only).
   * No-op if ServerSide is not active, children are already loading, or children are embedded.
   */
  private requestLazyChildren(flatRow: FlattenedTreeRow): void {
    if (this.loadingKeys.has(flatRow.key)) return;

    const childrenField = this.config.childrenField ?? 'children';
    const children = flatRow.data[childrenField];
    // Only fetch if children is a lazy indicator (truthy but not a non-empty array)
    if (Array.isArray(children) && children.length > 0) return;

    const isServerSideActive = this.grid?.query?.('datasource:is-active', null);
    if (!isServerSideActive) return;

    this.loadingKeys.add(flatRow.key);
    this.grid.query('datasource:fetch-children', {
      context: { source: 'tree', parentNode: flatRow.data, nodePath: [flatRow.key] },
    } satisfies FetchChildrenQuery);
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

      // Add expand/collapse icon or spacer
      if (showExpandIcons) {
        if (meta?.hasChildren) {
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
          content.innerHTML = result;
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
    const body = this.gridElement?.querySelector('.rows');
    if (!body) return;

    const style = this.animationStyle;
    const shouldAnimate = style !== false && this.keysToAnimate.size > 0;
    const animClass = style === 'fade' ? 'tbw-tree-fade-in' : 'tbw-tree-slide-in';

    for (const rowEl of body.querySelectorAll('.data-grid-row')) {
      const cell = rowEl.querySelector('.cell[data-row]');
      const idx = cell ? parseInt(cell.getAttribute('data-row') ?? '-1', 10) : -1;
      const treeRow = this.flattenedRows[idx];

      // Set aria-expanded on parent rows for screen readers
      if (treeRow?.hasChildren) {
        rowEl.setAttribute('aria-expanded', String(treeRow.isExpanded));
      }

      if (shouldAnimate && treeRow?.key && this.keysToAnimate.has(treeRow.key)) {
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
