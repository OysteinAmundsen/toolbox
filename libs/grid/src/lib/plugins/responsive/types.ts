/**
 * Responsive Plugin Types
 *
 * Type definitions for the responsive card layout feature.
 */

import type { ColumnConfig } from '../../core/types';

/**
 * Configuration options for the responsive plugin.
 */
export interface ResponsivePluginConfig<T = unknown> {
  /**
   * Width threshold in pixels to trigger responsive mode.
   * When grid width < breakpoint, switches to card layout.
   *
   * **Required**: If not provided, a warning is logged and responsive mode
   * is effectively disabled (defaults to 0). Users must explicitly configure
   * the breakpoint based on their grid's column count and layout needs.
   *
   * Common values:
   * - 400-500px for grids with 3-5 columns
   * - 600-800px for grids with 6-10 columns
   * - 900-1200px for grids with 10+ columns
   */
  breakpoint?: number;

  /**
   * Custom renderer function for card layout.
   * If not provided, uses CSS-only default layout (header: value pairs).
   *
   * @param row - The row data object
   * @param rowIndex - The index of the row
   * @param column - Optional column configuration
   * @returns An HTMLElement to render as the card content
   */
  cardRenderer?: (row: T, rowIndex: number, column?: ColumnConfig) => HTMLElement;

  /**
   * Whether to hide the header row in responsive mode.
   * @default true
   */
  hideHeader?: boolean;

  /**
   * Card row height in pixels. Only applies when cardRenderer is provided.
   * Use 'auto' for dynamic height based on content.
   * @default 'auto'
   */
  cardRowHeight?: number | 'auto';

  /**
   * Debounce delay in ms for resize events.
   * @default 100
   */
  debounceMs?: number;

  /**
   * Columns to hide in responsive mode (when using CSS-only default).
   * Useful for hiding less important columns in card view.
   * Specify field names of columns to hide.
   */
  hiddenColumns?: string[];
}

/**
 * Event detail for the responsive-change event.
 */
export interface ResponsiveChangeDetail {
  /** Whether the grid is currently in responsive mode */
  isResponsive: boolean;
  /** Current grid width in pixels */
  width: number;
  /** Configured breakpoint in pixels */
  breakpoint: number;
}
