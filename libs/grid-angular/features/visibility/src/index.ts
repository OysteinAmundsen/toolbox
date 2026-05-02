/**
 * Column visibility feature for @toolbox-web/grid-angular
 *
 * Import this module to enable the `visibility` input on Grid directive.
 *
 * @example
 * ```typescript
 * import '@toolbox-web/grid-angular/features/visibility';
 *
 * <tbw-grid [visibility]="true" />
 * ```
 *
 * @packageDocumentation
 */

import '@toolbox-web/grid/features/visibility';
export { GridVisibilityDirective } from './grid-visibility.directive';
export type { _Augmentation as _VisibilityAugmentation } from '@toolbox-web/grid/features/visibility';
