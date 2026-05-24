/**
 * Row reorder feature for @toolbox-web/grid-angular
 *
 * Import this module to enable the `reorderRows` input on Grid directive.
 *
 * @deprecated v1.x — slated for removal in `@toolbox-web/grid-angular` 2.0.0
 * (coordinated v3.0.0 release, see gh #260 / #263). Use the `rowDragDrop`
 * input and import `@toolbox-web/grid-angular/features/row-drag-drop` instead.
 *
 * @example
 * ```typescript
 * import '@toolbox-web/grid-angular/features/reorder-rows';
 *
 * <tbw-grid [reorderRows]="true" />
 * ```
 *
 * @packageDocumentation
 */

import '@toolbox-web/grid/features/reorder-rows';
export { GridReorderRowsDirective } from './grid-reorder-rows.directive';
export type { _Augmentation as _ReorderRowsAugmentation } from '@toolbox-web/grid/features/reorder-rows';
