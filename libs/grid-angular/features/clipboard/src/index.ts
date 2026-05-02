/**
 * Clipboard feature for @toolbox-web/grid-angular
 *
 * Import this module to enable the `clipboard` input on Grid directive.
 * Requires selection feature to be enabled.
 *
 * @example
 * ```typescript
 * import '@toolbox-web/grid-angular/features/selection';
 * import '@toolbox-web/grid-angular/features/clipboard';
 *
 * <tbw-grid [selection]="'range'" [clipboard]="true" />
 * ```
 *
 * @packageDocumentation
 */

import '@toolbox-web/grid/features/clipboard';
export { GridClipboardDirective } from './grid-clipboard.directive';
export type { _Augmentation as _ClipboardAugmentation } from '@toolbox-web/grid/features/clipboard';
