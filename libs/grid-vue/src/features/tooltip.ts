/**
 * Tooltip feature for @toolbox-web/grid-vue
 *
 * Import this module to enable the `tooltip` prop on TbwGrid.
 *
 * @example
 * ```vue
 * <script setup>
 * import '@toolbox-web/grid-vue/features/tooltip';
 * </script>
 *
 * <template>
 *   <TbwGrid :tooltip="true" />
 * </template>
 * ```
 *
 * @packageDocumentation
 */

// Delegate to core feature registration
import '@toolbox-web/grid/features/tooltip';
