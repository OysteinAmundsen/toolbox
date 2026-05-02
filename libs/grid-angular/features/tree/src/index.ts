/**
 * Tree feature for @toolbox-web/grid-angular
 *
 * Import this module to enable the `tree` input on Grid directive.
 *
 * @example
 * ```typescript
 * import '@toolbox-web/grid-angular/features/tree';
 *
 * <tbw-grid [tree]="{ childrenField: 'children' }" />
 * ```
 *
 * @packageDocumentation
 */

import '@toolbox-web/grid/features/tree';
export { GridTreeDirective } from './grid-tree.directive';
export type { _Augmentation as _TreeAugmentation } from '@toolbox-web/grid/features/tree';
