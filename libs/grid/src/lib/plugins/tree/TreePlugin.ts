/**
 * Tree Data Plugin
 *
 * Enables hierarchical tree data with expand/collapse, sorting, and auto-detection.
 */

import {
  BaseGridPlugin,
  CellClickEvent,
  HeaderClickEvent,
  type PluginManifest,
  type PluginQuery,
} from '../../core/plugin/base-plugin';
import type { ColumnConfig, ColumnViewRenderer } from '../../core/types';
import { collapseAll, expandAll, expandToKey, toggleExpand } from './tree-data';
import { detectTreeStructure, inferChildrenField } from './tree-detect';
import styles from './tree.css?inline';
import type { ExpandCollapseAnimation, FlattenedTreeRow, TreeConfig, TreeExpandDetail, TreeRow } from './types';

interface GridWithSortState {
  _sortState?: { field: string; direction: 1 | -1 } | null;
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
 * ## Configuration Options
 *
 * | Option | Type | Default | Description |
 * |--------|------|---------|-------------|
 * | `childrenField` | `string` | `'children'` | Field containing child array |
 * | `autoDetect` | `boolean` | `true` | Auto-detect tree structure from data |
 * | `defaultExpanded` | `boolean` | `false` | Expand all nodes initially |
 * | `indentWidth` | `number` | `20` | Indentation per level (pixels) |
 * | `showExpandIcons` | `boolean` | `true` | Show expand/collapse toggle icons |
 * | `animation` | `false \| 'slide' \| 'fade'` | `'slide'` | Animation style for expand/collapse |
 *
 * ## Programmatic API
 *
 * | Method | Signature | Description |
 * |--------|-----------|-------------|
 * | `expand` | `(nodeId) => void` | Expand a specific node |
 * | `collapse` | `(nodeId) => void` | Collapse a specific node |
 * | `toggle` | `(nodeId) => void` | Toggle a node's expanded state |
 * | `expandAll` | `() => void` | Expand all nodes |
 * | `collapseAll` | `() => void` | Collapse all nodes |
 * | `getExpandedNodes` | `() => Set<string>` | Get currently expanded node keys |
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
 * import '@toolbox-web/grid';
 * import { TreePlugin } from '@toolbox-web/grid/plugins/tree';
 *
 * const grid = document.querySelector('tbw-grid');
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
    events: [
      {
        type: 'tree-state-change',
        description: 'Emitted when tree expansion state changes (toggle, expand all, collapse all)',
      },
    ],
    queries: [
      {
        type: 'canMoveRow',
        description: 'Returns false for rows with children (parent nodes cannot be reordered)',
      },
    ],
  };

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

  /** @internal */
  override detach(): void {
    this.expandedKeys.clear();
    this.initialExpansionDone = false;
    this.flattenedRows = [];
    this.rowKeyMap.clear();
    this.previousVisibleKeys.clear();
    this.keysToAnimate.clear();
    this.sortState = null;
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
    return undefined;
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

    if (!detectTreeStructure(treeRows, childrenField)) {
      this.flattenedRows = [];
      this.rowKeyMap.clear();
      this.previousVisibleKeys.clear();
      return [...rows] as TreeRow[];
    }

    // Assign stable keys, then optionally sort
    let data = this.withStableKeys(treeRows);
    if (this.sortState) {
      data = this.sortTree(data, this.sortState.field, this.sortState.direction);
    }

    // Initialize expansion if needed
    if (this.config.defaultExpanded && !this.initialExpansionDone) {
      this.expandedKeys = expandAll(data, this.config);
      this.initialExpansionDone = true;
    }

    // Flatten and track animations
    this.flattenedRows = this.flattenTree(data, this.expandedKeys);
    this.rowKeyMap.clear();
    this.keysToAnimate.clear();
    const currentKeys = new Set<string>();

    for (const row of this.flattenedRows) {
      this.rowKeyMap.set(row.key, row);
      currentKeys.add(row.key);
      if (!this.previousVisibleKeys.has(row.key) && row.depth > 0) {
        this.keysToAnimate.add(row.key);
      }
    }
    this.previousVisibleKeys = currentKeys;

    return this.flattenedRows.map((r) => ({
      ...r.data,
      __treeKey: r.key,
      __treeDepth: r.depth,
      __treeHasChildren: r.hasChildren,
      __treeExpanded: r.isExpanded,
    }));
  }

  /** Assign stable keys to rows (preserves key across sort operations) */
  private withStableKeys(rows: readonly TreeRow[], parentKey: string | null = null): TreeRow[] {
    const childrenField = this.config.childrenField ?? 'children';
    return rows.map((row, i) => {
      const stableKey = row.__stableKey as string | undefined;
      const key = row.id !== undefined ? String(row.id) : (stableKey ?? (parentKey ? `${parentKey}-${i}` : String(i)));
      const children = row[childrenField];
      const hasChildren = Array.isArray(children) && children.length > 0;
      return {
        ...row,
        __stableKey: key,
        ...(hasChildren ? { [childrenField]: this.withStableKeys(children as TreeRow[], key) } : {}),
      };
    });
  }

  /** Flatten tree using stable keys */
  private flattenTree(rows: readonly TreeRow[], expanded: Set<string>, depth = 0): FlattenedTreeRow[] {
    const childrenField = this.config.childrenField ?? 'children';
    const result: FlattenedTreeRow[] = [];

    for (const row of rows) {
      const stableKey = row.__stableKey as string | undefined;
      const key = stableKey ?? String(row.id ?? '?');
      const children = row[childrenField];
      const hasChildren = Array.isArray(children) && children.length > 0;
      const isExpanded = expanded.has(key);

      result.push({
        key,
        data: row,
        depth,
        hasChildren,
        isExpanded,
        parentKey: depth > 0 ? key.substring(0, key.lastIndexOf('-')) || null : null,
      });

      if (hasChildren && isExpanded) {
        result.push(...this.flattenTree(children as TreeRow[], expanded, depth + 1));
      }
    }
    return result;
  }

  /** Sort tree recursively, keeping children with parents */
  private sortTree(rows: readonly TreeRow[], field: string, dir: 1 | -1): TreeRow[] {
    const childrenField = this.config.childrenField ?? 'children';
    const sorted = [...rows].sort((a, b) => {
      const aVal = a[field],
        bVal = b[field];
      if (aVal == null && bVal == null) return 0;
      if (aVal == null) return -1;
      if (bVal == null) return 1;
      return aVal > bVal ? dir : aVal < bVal ? -dir : 0;
    });
    return sorted.map((row) => {
      const children = row[childrenField];
      return Array.isArray(children) && children.length > 0
        ? { ...row, [childrenField]: this.sortTree(children as TreeRow[], field, dir) }
        : row;
    });
  }

  /** @internal */
  override processColumns(columns: readonly ColumnConfig[]): ColumnConfig[] {
    if (this.flattenedRows.length === 0) return [...columns];

    const cols = [...columns] as ColumnConfig[];
    if (cols.length === 0) return cols;

    // Wrap the first column's renderer to add tree indentation and expand icons
    // This is the correct approach for trees because:
    // 1. Indentation can grow naturally with depth
    // 2. Expand icons appear inline with content
    // 3. Works with column reordering (icons stay with first visible column)
    const firstCol = cols[0];
    const originalRenderer = firstCol.viewRenderer;
    const getConfig = () => this.config;
    const setIcon = this.setIcon.bind(this);
    const resolveIcon = this.resolveIcon.bind(this);

    const wrappedRenderer: ColumnViewRenderer = (ctx) => {
      const { row, value } = ctx;
      const { showExpandIcons = true, indentWidth } = getConfig();
      const treeRow = row as TreeRow;
      const depth = treeRow.__treeDepth ?? 0;

      const container = document.createElement('span');
      container.className = 'tree-cell-wrapper';
      container.style.setProperty('--tbw-tree-depth', String(depth));
      // Allow config-based indentWidth to override CSS default
      if (indentWidth !== undefined) {
        container.style.setProperty('--tbw-tree-indent-width', `${indentWidth}px`);
      }

      // Add expand/collapse icon or spacer
      if (showExpandIcons) {
        if (treeRow.__treeHasChildren) {
          const icon = document.createElement('span');
          icon.className = `tree-toggle${treeRow.__treeExpanded ? ' expanded' : ''}`;
          setIcon(icon, resolveIcon(treeRow.__treeExpanded ? 'collapse' : 'expand'));
          icon.setAttribute('data-tree-key', String(treeRow.__treeKey ?? ''));
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

    cols[0] = { ...firstCol, viewRenderer: wrappedRenderer };
    return cols;
  }

  // #endregion

  // #region Event Handlers

  /** @internal */
  override onCellClick(event: CellClickEvent): boolean {
    const target = event.originalEvent?.target as HTMLElement;
    if (!target?.classList.contains('tree-toggle')) return false;

    const key = target.getAttribute('data-tree-key');
    if (!key) return false;

    const flatRow = this.rowKeyMap.get(key);
    if (!flatRow) return false;

    this.expandedKeys = toggleExpand(this.expandedKeys, key);
    this.emit<TreeExpandDetail>('tree-expand', {
      key,
      row: flatRow.data,
      expanded: this.expandedKeys.has(key),
      depth: flatRow.depth,
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
    this.emit<TreeExpandDetail>('tree-expand', {
      key: flatRow.key,
      row: flatRow.data,
      expanded: this.expandedKeys.has(flatRow.key),
      depth: flatRow.depth,
    });
    this.requestRenderWithFocus();
    return true;
  }

  /** @internal */
  override onHeaderClick(event: HeaderClickEvent): boolean {
    if (this.flattenedRows.length === 0 || !event.column.sortable) return false;

    const { field } = event.column;
    if (!this.sortState || this.sortState.field !== field) {
      this.sortState = { field, direction: 1 };
    } else if (this.sortState.direction === 1) {
      this.sortState = { field, direction: -1 };
    } else {
      this.sortState = null;
    }

    // Sync grid sort indicator
    const gridEl = this.grid as unknown as GridWithSortState;
    if (gridEl._sortState !== undefined) {
      gridEl._sortState = this.sortState ? { ...this.sortState } : null;
    }

    this.emit('sort-change', { field, direction: this.sortState?.direction ?? 0 });
    this.requestRender();
    return true;
  }

  /** @internal */
  override afterRender(): void {
    const style = this.animationStyle;
    if (style === false || this.keysToAnimate.size === 0) return;

    const body = this.gridElement?.querySelector('.rows');
    if (!body) return;

    const animClass = style === 'fade' ? 'tbw-tree-fade-in' : 'tbw-tree-slide-in';
    for (const rowEl of body.querySelectorAll('.data-grid-row')) {
      const cell = rowEl.querySelector('.cell[data-row]');
      const idx = cell ? parseInt(cell.getAttribute('data-row') ?? '-1', 10) : -1;
      const key = this.flattenedRows[idx]?.key;

      if (key && this.keysToAnimate.has(key)) {
        rowEl.classList.add(animClass);
        rowEl.addEventListener('animationend', () => rowEl.classList.remove(animClass), { once: true });
      }
    }
    this.keysToAnimate.clear();
  }

  // #endregion

  // #region Public API

  expand(key: string): void {
    this.expandedKeys.add(key);
    this.requestRender();
  }

  collapse(key: string): void {
    this.expandedKeys.delete(key);
    this.requestRender();
  }

  toggle(key: string): void {
    this.expandedKeys = toggleExpand(this.expandedKeys, key);
    this.emitPluginEvent('tree-state-change', { expandedKeys: [...this.expandedKeys] });
    this.requestRender();
  }

  expandAll(): void {
    this.expandedKeys = expandAll(this.rows as TreeRow[], this.config);
    this.emitPluginEvent('tree-state-change', { expandedKeys: [...this.expandedKeys] });
    this.requestRender();
  }

  collapseAll(): void {
    this.expandedKeys = collapseAll();
    this.emitPluginEvent('tree-state-change', { expandedKeys: [...this.expandedKeys] });
    this.requestRender();
  }

  isExpanded(key: string): boolean {
    return this.expandedKeys.has(key);
  }

  getExpandedKeys(): string[] {
    return [...this.expandedKeys];
  }

  getFlattenedRows(): FlattenedTreeRow[] {
    return [...this.flattenedRows];
  }

  getRowByKey(key: string): TreeRow | undefined {
    return this.rowKeyMap.get(key)?.data;
  }

  expandToKey(key: string): void {
    this.expandedKeys = expandToKey(this.rows as TreeRow[], key, this.config, this.expandedKeys);
    this.requestRender();
  }

  // #endregion
}
