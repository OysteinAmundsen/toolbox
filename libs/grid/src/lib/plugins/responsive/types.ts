/**
 * Responsive Plugin Types
 *
 * Type definitions for the responsive card layout feature.
 */

import type { ColumnConfig } from '../../core/types';

/**
 * Enhanced hidden column configuration.
 * Either a field name (hides entire cell) or an object that controls visibility.
 */
export type HiddenColumnConfig =
  | string
  | {
      /** Field name of the column */
      field: string;
      /**
       * When true, hides only the header label but shows the value full-width.
       * Useful for primary fields like email or title that are self-explanatory.
       */
      showValue: true;
    };

/**
 * Configuration for a single breakpoint in progressive degradation.
 */
export interface BreakpointConfig {
  /**
   * Maximum width in pixels for this breakpoint.
   * When grid width <= maxWidth, this breakpoint becomes active.
   * Breakpoints are evaluated from smallest to largest.
   */
  maxWidth: number;

  /**
   * Columns to hide at this breakpoint.
   * Supports enhanced syntax with showValue option.
   */
  hiddenColumns?: HiddenColumnConfig[];

  /**
   * Whether to switch to full card layout at this breakpoint.
   * @default false (only the smallest breakpoint defaults to true)
   */
  cardLayout?: boolean;
}

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
   *
   * **Note**: If `breakpoints` array is provided, this property is ignored.
   */
  breakpoint?: number;

  /**
   * Multiple breakpoints for progressive degradation.
   * Evaluated from smallest to largest maxWidth.
   * When provided, the single `breakpoint` property is ignored.
   *
   * @example
   * ```ts
   * breakpoints: [
   *   { maxWidth: 800, hiddenColumns: ['createdAt', 'updatedAt'] },
   *   { maxWidth: 600, hiddenColumns: ['createdAt', 'updatedAt', 'status'] },
   *   { maxWidth: 400, cardLayout: true },
   * ]
   * ```
   */
  breakpoints?: BreakpointConfig[];

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
   * Supports enhanced syntax with showValue option.
   *
   * @example
   * ```ts
   * hiddenColumns: [
   *   'createdAt',  // Entire cell hidden
   *   { field: 'email', showValue: true },  // Label hidden, value shown full-width
   * ]
   * ```
   */
  hiddenColumns?: HiddenColumnConfig[];

  /**
   * Enable smooth animations when transitioning between modes.
   * @default true
   */
  animate?: boolean;

  /**
   * Animation duration in milliseconds.
   * @default 200
   */
  animationDuration?: number;
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

// Module Augmentation - Register plugin name for type-safe getPluginByName()
declare module '../../core/types' {
  interface PluginNameMap {
    responsive: import('./ResponsivePlugin').ResponsivePlugin;
  }
}
