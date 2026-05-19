/**
 * Sticky Rows feature for @toolbox-web/grid-vue
 *
 * Import this module to enable the `stickyRows` prop on TbwGrid.
 *
 * @example
 * ```ts
 * import '@toolbox-web/grid-vue/features/sticky-rows';
 * ```
 *
 * ```vue
 * <TbwGrid :sticky-rows="{ isSticky: 'isSection' }" />
 * ```
 *
 * @packageDocumentation
 */

// Delegate to core feature registration
import '@toolbox-web/grid/features/sticky-rows';
