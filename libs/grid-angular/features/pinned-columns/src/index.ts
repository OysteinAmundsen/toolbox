/**
 * Pinned columns feature for @toolbox-web/grid-angular
 *
 * Import this module to enable the `pinnedColumns` input on Grid directive.
 *
 * @example
 * ```typescript
 * import '@toolbox-web/grid-angular/features/pinned-columns';
 *
 * <tbw-grid [pinnedColumns]="true" [columns]="[
 *   { field: 'id', pinned: 'left' },
 *   { field: 'name' }
 * ]" />
 * ```
 *
 * @packageDocumentation
 */

import '@toolbox-web/grid/features/pinned-columns';
export { GridPinnedColumnsDirective } from './grid-pinned-columns.directive';
export type { _Augmentation as _PinnedColumnsAugmentation } from '@toolbox-web/grid/features/pinned-columns';
