/**
 * Tooltip feature for @toolbox-web/grid-angular
 *
 * Import this module to enable the `tooltip` input on Grid directive.
 *
 * @example
 * ```typescript
 * import '@toolbox-web/grid-angular/features/tooltip';
 *
 * <tbw-grid [tooltip]="true" />
 * ```
 *
 * @packageDocumentation
 */

import '@toolbox-web/grid/features/tooltip';
export { GridTooltipDirective } from './grid-tooltip.directive';
export type { _Augmentation as _TooltipAugmentation } from '@toolbox-web/grid/features/tooltip';
