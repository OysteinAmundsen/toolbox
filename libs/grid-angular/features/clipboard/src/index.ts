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

import { registerFeature } from '@toolbox-web/grid-angular';
import { ClipboardPlugin } from '@toolbox-web/grid/plugins/clipboard';

registerFeature('clipboard', (config) => {
  if (config === true) {
    return new ClipboardPlugin();
  }
  return new ClipboardPlugin(config ?? undefined);
});
