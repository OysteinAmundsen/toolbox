/**
 * Sticky Rows Plugin — types.
 *
 * @module Plugins/Sticky Rows
 */

/**
 * Predicate that decides whether a given row should be sticky.
 * Receives the row data and its current index in the post-processed row list.
 * Return any truthy value to mark the row as sticky.
 * @since 2.7.0
 */
export type StickyPredicate = (row: unknown, index: number) => unknown;

/**
 * Behavior when a new sticky row reaches the currently stuck region.
 *
 * - `'push'` — only one sticky row is visible at a time. As the next sticky
 *   row scrolls up against the stuck row, the stuck row is translated upward
 *   so the new one slides in (iOS section-header behavior).
 * - `'stack'` — sticky rows accumulate below the header as they scroll past,
 *   building a column of pinned rows. Capped by {@link StickyRowsConfig.maxStacked}.
 * @since 2.7.0
 */
export type StickyRowsMode = 'push' | 'stack';

/**
 * Configuration for {@link StickyRowsPlugin}.
 *
 * @example Field-name shorthand
 * ```ts
 * import '@toolbox-web/grid/features/sticky-rows';
 * grid.gridConfig = { features: { stickyRows: { isSticky: 'isSection' } } };
 * ```
 *
 * @example Predicate
 * ```ts
 * grid.gridConfig = {
 *   features: {
 *     stickyRows: {
 *       isSticky: (row, index) => row.kind === 'section',
 *       mode: 'stack',
 *       maxStacked: 3,
 *     },
 *   },
 * };
 * ```
 * @since 2.7.0
 */
export interface StickyRowsConfig {
  /**
   * Either a field name on the row (truthy value marks the row as sticky)
   * or a predicate that returns a truthy/falsy value per row.
   *
   * Required — without it the plugin renders nothing.
   */
  isSticky: string | StickyPredicate;

  /**
   * Behavior when multiple sticky rows would be stuck simultaneously.
   * @default 'push'
   */
  mode?: StickyRowsMode;

  /**
   * Maximum number of rows stacked below the header in `'stack'` mode.
   * Ignored in `'push'` mode (which is always 1).
   * @default Infinity
   */
  maxStacked?: number;

  /**
   * Optional class added to the stuck-row clones for custom styling.
   */
  className?: string;
}
