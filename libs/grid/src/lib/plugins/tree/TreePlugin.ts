/**
 * Tree Data Plugin
 *
 * Enables hierarchical tree data with expand/collapse, sorting, and auto-detection.
 */

/* eslint-disable @typescript-eslint/no-explicit-any */

import { BaseGridPlugin, CellClickEvent, HeaderClickEvent } from '../../core/plugin/base-plugin';
import type { ColumnConfig, GridConfig } from '../../core/types';
import { collapseAll, expandAll, expandToKey, toggleExpand } from './tree-data';
import { detectTreeStructure, inferChildrenField } from './tree-detect';
import styles from './tree.css?inline';
import type { ExpandCollapseAnimation, FlattenedTreeRow, TreeConfig, TreeExpandDetail } from './types';

interface GridWithConfig {
  effectiveConfig?: GridConfig;
  _sortState?: { field: string; direction: 1 | -1 } | null;
}

/**
 * Tree Data Plugin for tbw-grid
 *
 * @example
 * ```ts
 * new TreePlugin({ defaultExpanded: true, indentWidth: 24 })
 * ```
 */
export class TreePlugin extends BaseGridPlugin<TreeConfig> {
  readonly name = 'tree';
  override readonly version = '1.0.0';
  override readonly styles = styles;

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

  override detach(): void {
    this.expandedKeys.clear();
    this.initialExpansionDone = false;
    this.flattenedRows = [];
    this.rowKeyMap.clear();
    this.previousVisibleKeys.clear();
    this.keysToAnimate.clear();
    this.sortState = null;
  }

  // #endregion

  // #region Animation

  private get animationStyle(): ExpandCollapseAnimation {
    const gridEl = this.grid as unknown as GridWithConfig;
    const mode = gridEl.effectiveConfig?.animation?.mode ?? 'reduced-motion';

    if (mode === false || mode === 'off') return false;
    if (mode !== true && mode !== 'on') {
      const host = this.shadowRoot?.host as HTMLElement | undefined;
      if (host && getComputedStyle(host).getPropertyValue('--tbw-animation-enabled').trim() === '0') {
        return false;
      }
    }
    return this.config.animation ?? 'slide';
  }

  // #endregion

  // #region Auto-Detection

  detect(rows: readonly unknown[]): boolean {
    if (!this.config.autoDetect) return false;
    const field = this.config.childrenField ?? inferChildrenField(rows as any[]) ?? 'children';
    return detectTreeStructure(rows as any[], field);
  }

  // #endregion

  // #region Data Processing

  override processRows(rows: readonly unknown[]): any[] {
    const childrenField = this.config.childrenField ?? 'children';

    if (!detectTreeStructure(rows as any[], childrenField)) {
      this.flattenedRows = [];
      this.rowKeyMap.clear();
      this.previousVisibleKeys.clear();
      return [...rows];
    }

    // Assign stable keys, then optionally sort
    let data = this.withStableKeys(rows as any[]);
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
  private withStableKeys(rows: any[], parentKey: string | null = null): any[] {
    const childrenField = this.config.childrenField ?? 'children';
    return rows.map((row, i) => {
      const key =
        row.id !== undefined ? String(row.id) : (row.__stableKey ?? (parentKey ? `${parentKey}-${i}` : String(i)));
      const children = row[childrenField];
      const hasChildren = Array.isArray(children) && children.length > 0;
      return {
        ...row,
        __stableKey: key,
        ...(hasChildren ? { [childrenField]: this.withStableKeys(children, key) } : {}),
      };
    });
  }

  /** Flatten tree using stable keys */
  private flattenTree(rows: any[], expanded: Set<string>, depth = 0): FlattenedTreeRow[] {
    const childrenField = this.config.childrenField ?? 'children';
    const result: FlattenedTreeRow[] = [];

    for (const row of rows) {
      const key = row.__stableKey ?? row.id ?? '?';
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
        result.push(...this.flattenTree(children, expanded, depth + 1));
      }
    }
    return result;
  }

  /** Sort tree recursively, keeping children with parents */
  private sortTree(rows: any[], field: string, dir: 1 | -1): any[] {
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
        ? { ...row, [childrenField]: this.sortTree(children, field, dir) }
        : row;
    });
  }

  override processColumns(columns: readonly ColumnConfig[]): ColumnConfig[] {
    if (this.flattenedRows.length === 0) return [...columns];

    const cols = [...columns] as ColumnConfig[];
    if (cols.length === 0) return cols;

    const firstCol = { ...cols[0] };
    const original = firstCol.viewRenderer;
    if ((original as any)?.__treeWrapped) return cols;

    const getConfig = () => this.config;
    const setIcon = this.setIcon.bind(this);
    const resolveIcon = this.resolveIcon.bind(this);

    const wrapped = (ctx: Parameters<NonNullable<typeof original>>[0]) => {
      const { value, row } = ctx;
      const { indentWidth = 20, showExpandIcons = true } = getConfig();

      const container = document.createElement('span');
      container.className = 'tree-cell';
      container.style.setProperty('--tree-depth', String(row.__treeDepth ?? 0));
      container.style.setProperty('--tbw-tree-indent', `${indentWidth}px`);

      if (row.__treeHasChildren && showExpandIcons) {
        const icon = document.createElement('span');
        icon.className = `tree-toggle${row.__treeExpanded ? ' expanded' : ''}`;
        setIcon(icon, resolveIcon(row.__treeExpanded ? 'collapse' : 'expand'));
        icon.setAttribute('data-tree-key', row.__treeKey);
        container.appendChild(icon);
      } else if (showExpandIcons) {
        const spacer = document.createElement('span');
        spacer.className = 'tree-spacer';
        container.appendChild(spacer);
      }

      const content = document.createElement('span');
      if (original) {
        const rendered = original(ctx);
        if (rendered instanceof Node) {
          content.appendChild(rendered);
        } else {
          content.textContent = String(rendered ?? value ?? '');
        }
      } else {
        content.textContent = String(value ?? '');
      }
      container.appendChild(content);
      return container;
    };

    (wrapped as any).__treeWrapped = true;
    firstCol.viewRenderer = wrapped;
    cols[0] = firstCol;
    return cols;
  }

  // #endregion

  // #region Event Handlers

  override onCellClick(event: CellClickEvent): boolean {
    const target = event.originalEvent?.target as HTMLElement;
    if (!target?.classList.contains('tree-toggle')) return false;

    const key = target.getAttribute('data-tree-key');
    const flatRow = key ? this.rowKeyMap.get(key) : null;
    if (!flatRow) return false;

    this.expandedKeys = toggleExpand(this.expandedKeys, key!);
    this.emit<TreeExpandDetail>('tree-expand', {
      key: key!,
      row: flatRow.data,
      expanded: this.expandedKeys.has(key!),
      depth: flatRow.depth,
    });
    this.requestRender();
    return true;
  }

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
    const gridEl = this.grid as unknown as GridWithConfig;
    if (gridEl._sortState !== undefined) {
      gridEl._sortState = this.sortState ? { ...this.sortState } : null;
    }

    this.emit('sort-change', { field, direction: this.sortState?.direction ?? 0 });
    this.requestRender();
    return true;
  }

  override afterRender(): void {
    const style = this.animationStyle;
    if (style === false || this.keysToAnimate.size === 0) return;

    const body = this.shadowRoot?.querySelector('.rows');
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
    this.requestRender();
  }

  expandAll(): void {
    this.expandedKeys = expandAll(this.rows as any[], this.config);
    this.requestRender();
  }

  collapseAll(): void {
    this.expandedKeys = collapseAll();
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

  getRowByKey(key: string): any | undefined {
    return this.rowKeyMap.get(key)?.data;
  }

  expandToKey(key: string): void {
    this.expandedKeys = expandToKey(this.rows as any[], key, this.config, this.expandedKeys);
    this.requestRender();
  }

  // #endregion
}
