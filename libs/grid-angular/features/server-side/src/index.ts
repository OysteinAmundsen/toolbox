/**
 * Server-side feature for @toolbox-web/grid-angular
 *
 * Import this module to enable the `serverSide` input on Grid directive.
 *
 * @example
 * ```typescript
 * import '@toolbox-web/grid-angular/features/server-side';
 *
 * <tbw-grid [serverSide]="{ dataSource: fetchDataFn }" />
 * ```
 *
 * @packageDocumentation
 */

import '@toolbox-web/grid/features/server-side';
export type { _Augmentation as _ServerSideAugmentation } from '@toolbox-web/grid/features/server-side';
