/**
 * Tree Data Plugin Types
 *
 * Type definitions for hierarchical tree data with expand/collapse functionality.
 */

import type { ExpandCollapseAnimation } from '../../core/types';
export type { ExpandCollapseAnimation } from '../../core/types';

/** Generic tree row with dynamic property access */
export type TreeRow = Record<string, unknown>;

/** Configuration options for the tree plugin */
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
}

// Module Augmentation - Register plugin name for type-safe getPluginByName()
declare module '../../core/types' {
  interface PluginNameMap {
    tree: import('./TreePlugin').TreePlugin;
  }
}
