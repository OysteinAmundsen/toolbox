/**
 * Multi-sort feature for @toolbox-web/grid-angular
 *
 * Import this module to enable the `multiSort` input on Grid directive.
 * Multi-sort allows sorting by multiple columns simultaneously.
 *
 * For basic single-column sorting, columns with `sortable: true` work without this plugin.
 * Use `[sortable]="false"` on the grid to disable all sorting.
 *
 * @example
 * ```typescript
 * import '@toolbox-web/grid-angular/features/multi-sort';
 *
 * <tbw-grid [multiSort]="true" />
 * <tbw-grid [multiSort]="'single'" />
 * <tbw-grid [multiSort]="{ maxSortColumns: 3 }" />
 * ```
 *
 * @packageDocumentation
 */

import '@toolbox-web/grid/features/multi-sort';
export { GridMultiSortDirective } from './grid-multi-sort.directive';
export type { _Augmentation as _MultiSortAugmentation } from '@toolbox-web/grid/features/multi-sort';
