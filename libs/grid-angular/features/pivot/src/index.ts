/**
 * Pivot feature for @toolbox-web/grid-angular
 *
 * Import this module to enable the `pivot` input on Grid directive.
 *
 * @example
 * ```typescript
 * import '@toolbox-web/grid-angular/features/pivot';
 *
 * <tbw-grid [pivot]="{ rowFields: ['category'], valueField: 'sales' }" />
 * ```
 *
 * @packageDocumentation
 */

import '@toolbox-web/grid/features/pivot';
export { GridPivotDirective } from './grid-pivot.directive';
export type { _Augmentation as _PivotAugmentation } from '@toolbox-web/grid/features/pivot';
