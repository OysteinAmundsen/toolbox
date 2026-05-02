/**
 * Column reorder feature for @toolbox-web/grid-angular
 *
 * Import this module to enable the `reorderColumns` input on Grid directive.
 *
 * @example
 * ```typescript
 * import '@toolbox-web/grid-angular/features/reorder-columns';
 *
 * <tbw-grid [reorderColumns]="true" />
 * ```
 *
 * @packageDocumentation
 */

import '@toolbox-web/grid/features/reorder-columns';
export { GridReorderColumnsDirective } from './grid-reorder-columns.directive';
export type { _Augmentation as _ReorderColumnsAugmentation } from '@toolbox-web/grid/features/reorder-columns';
