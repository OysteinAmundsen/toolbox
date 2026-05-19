/**
 * Sticky rows feature for @toolbox-web/grid-angular
 *
 * Import this module to enable the `stickyRows` input on the Grid directive.
 *
 * @example
 * ```typescript
 * import '@toolbox-web/grid-angular/features/sticky-rows';
 *
 * <tbw-grid [stickyRows]="{ isSticky: 'isSection' }" />
 * ```
 *
 * @packageDocumentation
 */

import '@toolbox-web/grid/features/sticky-rows';
export { GridStickyRowsDirective } from './grid-sticky-rows.directive';
export type { _Augmentation as _StickyRowsAugmentation } from '@toolbox-web/grid/features/sticky-rows';
