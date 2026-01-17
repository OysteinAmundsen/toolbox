/**
 * Master/Detail Plugin Types
 *
 * Type definitions for expandable detail rows showing additional content.
 */

import type { ExpandCollapseAnimation } from '../../core/types';
export type { ExpandCollapseAnimation } from '../../core/types';

/** Configuration options for the master-detail plugin */
export interface MasterDetailConfig {
  /** Renderer function that returns detail content for a row */
  detailRenderer?: (row: Record<string, unknown>, rowIndex: number) => HTMLElement | string;
  /** Height of the detail row - number (pixels) or 'auto' (default: 'auto') */
  detailHeight?: number | 'auto';
  /** Expand/collapse detail on row click (default: false) */
  expandOnRowClick?: boolean;
  /** Collapse expanded detail when clicking outside (default: false) */
  collapseOnClickOutside?: boolean;
  /** Show expand/collapse column (default: true) */
  showExpandColumn?: boolean;
  /**
   * Animation style for expanding/collapsing detail rows.
   * - `false`: No animation
   * - `'slide'`: Slide down/up animation (default)
   * - `'fade'`: Fade in/out animation
   * @default 'slide'
   */
  animation?: ExpandCollapseAnimation;
}

/** Internal state managed by the master-detail plugin */
export interface MasterDetailState {
  /** Set of expanded row objects (tracked by reference) */
  expandedRows: Set<object>;
  /** Map from row object to detail element */
  detailElements: Map<object, HTMLElement>;
}

/** Event detail for detail-expand event */
export interface DetailExpandDetail {
  /** The row index that was expanded/collapsed */
  rowIndex: number;
  /** The row data */
  row: Record<string, unknown>;
  /** Whether the row is now expanded */
  expanded: boolean;
}
