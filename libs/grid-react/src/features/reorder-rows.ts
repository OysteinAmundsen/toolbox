/**
 * Row Reorder feature for @toolbox-web/grid-react
 *
 * Import this module to enable the `reorderRows` prop on DataGrid.
 *
 * @deprecated v1.x — slated for removal in `@toolbox-web/grid-react` 2.0.0
 * (coordinated v3.0.0 release, see gh #261 / #263). Use the `rowDragDrop`
 * prop and import `@toolbox-web/grid-react/features/row-drag-drop` instead.
 *
 * @example
 * ```tsx
 * import '@toolbox-web/grid-react/features/reorder-rows';
 *
 * <DataGrid reorderRows />
 * ```
 *
 * @packageDocumentation
 */

// Delegate to core feature registration
import '@toolbox-web/grid/features/reorder-rows';
