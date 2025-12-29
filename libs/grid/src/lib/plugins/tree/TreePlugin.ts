/**
 * Tree Data Plugin (Class-based)
 *
 * Enables hierarchical tree data with expand/collapse and auto-detection.
 */

/* eslint-disable @typescript-eslint/no-explicit-any */
// The tree plugin intentionally uses `any` for maximum flexibility with user-defined row types.

import { BaseGridPlugin, CellClickEvent } from '../../core/plugin/base-plugin';
import type { ColumnConfig } from '../../core/types';
import { collapseAll, expandAll, expandToKey, flattenTree, toggleExpand } from './tree-data';
import { detectTreeStructure, inferChildrenField } from './tree-detect';
import type { FlattenedTreeRow, TreeConfig, TreeExpandDetail } from './types';

/**
 * Tree Data Plugin for tbw-grid
 *
 * Provides hierarchical tree data display with expand/collapse functionality.
 *
 * @example
 * ```ts
 * new TreePlugin({ defaultExpanded: true, indentWidth: 24 })
 * ```
 */
export class TreePlugin extends BaseGridPlugin<TreeConfig> {
  readonly name = 'tree';
  override readonly version = '1.0.0';

  protected override get defaultConfig(): Partial<TreeConfig> {
    return {
      enabled: true,
      childrenField: 'children',
      autoDetect: true,
      defaultExpanded: false,
      indentWidth: 20,
      showExpandIcons: true,
    };
  }

  // ===== Internal State =====

  /** Set of expanded row keys */
  private expandedKeys = new Set<string>();

  /** Whether initial expansion (based on defaultExpanded config) has been applied */
  private initialExpansionDone = false;

  /** Flattened tree rows for rendering */
  private flattenedRows: FlattenedTreeRow[] = [];

  /** Map from key to flattened row for quick lookup */
  private rowKeyMap = new Map<string, FlattenedTreeRow>();

  // ===== Lifecycle =====

  override detach(): void {
    this.expandedKeys.clear();
    this.initialExpansionDone = false;
    this.flattenedRows = [];
    this.rowKeyMap.clear();
  }

  // ===== Auto-Detection =====

  /**
   * Detects if tree functionality should be enabled based on data structure.
   * Called by the grid during plugin initialization.
   */
  detect(rows: readonly unknown[]): boolean {
    if (!this.config.autoDetect) return false;
    const childrenField = this.config.childrenField ?? inferChildrenField(rows as any[]) ?? 'children';
    return detectTreeStructure(rows as any[], childrenField);
  }

  // ===== Data Processing =====

  override processRows(rows: readonly unknown[]): any[] {
    const childrenField = this.config.childrenField ?? 'children';

    // Check if data is actually a tree
    if (!detectTreeStructure(rows as any[], childrenField)) {
      this.flattenedRows = [];
      this.rowKeyMap.clear();
      return [...rows];
    }

    // Initialize expansion state if needed (only once per grid lifecycle)
    if (this.config.defaultExpanded && !this.initialExpansionDone) {
      this.expandedKeys = expandAll(rows as any[], this.config);
      this.initialExpansionDone = true;
    }

    // Flatten tree
    this.flattenedRows = flattenTree(rows as any[], this.config, this.expandedKeys);

    // Build key map
    this.rowKeyMap.clear();
    for (const flatRow of this.flattenedRows) {
      this.rowKeyMap.set(flatRow.key, flatRow);
    }

    // Return flattened data for rendering with tree metadata
    return this.flattenedRows.map((fr) => ({
      ...fr.data,
      __treeKey: fr.key,
      __treeDepth: fr.depth,
      __treeHasChildren: fr.hasChildren,
      __treeExpanded: fr.isExpanded,
    }));
  }

  override processColumns(columns: readonly ColumnConfig[]): ColumnConfig[] {
    if (this.flattenedRows.length === 0) return [...columns];

    const indentWidth = this.config.indentWidth ?? 20;
    const showExpandIcons = this.config.showExpandIcons ?? true;

    // Wrap first column's renderer to add tree indentation
    const cols = [...columns] as ColumnConfig[];
    if (cols.length > 0) {
      const firstCol = { ...cols[0] };
      const originalRenderer = firstCol.viewRenderer;

      // Skip if already wrapped by this plugin (prevents double-wrapping on re-render)
      if ((originalRenderer as any)?.__treeWrapped) {
        return cols;
      }

      const wrappedRenderer = (renderCtx: Parameters<NonNullable<typeof originalRenderer>>[0]) => {
        const { value, row, column: colConfig } = renderCtx;
        const depth = row.__treeDepth ?? 0;
        const hasChildren = row.__treeHasChildren ?? false;
        const isExpanded = row.__treeExpanded ?? false;

        const container = document.createElement('span');
        container.style.display = 'flex';
        container.style.alignItems = 'center';
        container.style.paddingLeft = `${depth * indentWidth}px`;

        // Expand/collapse icon
        if (hasChildren && showExpandIcons) {
          const icon = document.createElement('span');
          icon.className = 'tree-toggle';
          // Use grid-level icons (fall back to defaults)
          this.setIcon(icon, this.resolveIcon(isExpanded ? 'collapse' : 'expand'));
          icon.style.cursor = 'pointer';
          icon.style.marginRight = '4px';
          icon.style.fontSize = '10px';
          icon.setAttribute('data-tree-key', row.__treeKey);
          container.appendChild(icon);
        } else if (showExpandIcons) {
          // Spacer for alignment
          const spacer = document.createElement('span');
          spacer.style.width = '14px';
          spacer.style.display = 'inline-block';
          container.appendChild(spacer);
        }

        // Cell content
        const content = document.createElement('span');
        if (originalRenderer) {
          const rendered = originalRenderer(renderCtx);
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

      // Mark renderer as wrapped to prevent double-wrapping
      (wrappedRenderer as any).__treeWrapped = true;
      firstCol.viewRenderer = wrappedRenderer;

      cols[0] = firstCol;
    }

    return cols;
  }

  // ===== Event Handlers =====

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

  // ===== Public API =====

  /**
   * Expand a specific node by key.
   */
  expand(key: string): void {
    this.expandedKeys.add(key);
    this.requestRender();
  }

  /**
   * Collapse a specific node by key.
   */
  collapse(key: string): void {
    this.expandedKeys.delete(key);
    this.requestRender();
  }

  /**
   * Toggle the expansion state of a node.
   */
  toggle(key: string): void {
    this.expandedKeys = toggleExpand(this.expandedKeys, key);
    this.requestRender();
  }

  /**
   * Expand all nodes in the tree.
   */
  expandAll(): void {
    this.expandedKeys = expandAll(this.rows as any[], this.config);
    this.requestRender();
  }

  /**
   * Collapse all nodes in the tree.
   */
  collapseAll(): void {
    this.expandedKeys = collapseAll();
    this.requestRender();
  }

  /**
   * Check if a node is currently expanded.
   */
  isExpanded(key: string): boolean {
    return this.expandedKeys.has(key);
  }

  /**
   * Get all currently expanded keys.
   */
  getExpandedKeys(): string[] {
    return [...this.expandedKeys];
  }

  /**
   * Get the flattened tree rows with metadata.
   */
  getFlattenedRows(): FlattenedTreeRow[] {
    return [...this.flattenedRows];
  }

  /**
   * Get a row's original data by its key.
   */
  getRowByKey(key: string): any | undefined {
    return this.rowKeyMap.get(key)?.data;
  }

  /**
   * Expand all ancestors of a node to make it visible.
   */
  expandToKey(key: string): void {
    this.expandedKeys = expandToKey(this.rows as any[], key, this.config, this.expandedKeys);
    this.requestRender();
  }

  // ===== Styles =====

  override readonly styles = `
    .tree-toggle {
      cursor: pointer;
      user-select: none;
      transition: transform 0.2s;
    }
    .tree-toggle:hover {
      color: var(--tbw-tree-accent, var(--tbw-color-accent));
    }
  `;
}
