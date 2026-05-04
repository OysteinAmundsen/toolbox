/**
 * Tree Data Plugin Types
 *
 * Type definitions for hierarchical tree data with expand/collapse functionality.
 */

import type { ExpandCollapseAnimation } from '../../core/types';
export type { ExpandCollapseAnimation } from '../../core/types';

/** Generic tree row with dynamic property access */
export type TreeRow = Record<string, unknown>;

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

/** A flattened tree row with hierarchy metadata */
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

/** Event detail emitted when a tree node is expanded or collapsed */
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

// Module Augmentation - Register plugin name for type-safe getPluginByName()
declare module '../../core/types' {
  interface DataGridEventMap {
    /** Fired when a tree node is expanded or collapsed. Provides the node key, row data, and depth level. @group Tree Events */
    'tree-expand': TreeExpandDetail;
    /** Fired when lazy tree data starts loading. @group Tree Events */
    'tree-load-start': void;
    /** Fired when lazy tree data finishes loading. @group Tree Events */
    'tree-load-end': { totalTopLevelCount: number; loadedCount: number };
    /** Fired when lazy tree data loading fails. @group Tree Events */
    'tree-load-error': { error: unknown };
  }

  interface PluginNameMap {
    tree: import('./TreePlugin').TreePlugin;
  }
}
