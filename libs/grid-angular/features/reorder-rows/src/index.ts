/**
 * Row reorder feature for @toolbox-web/grid-angular
 *
 * Import this module to enable the `reorderRows` input on Grid directive.
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
