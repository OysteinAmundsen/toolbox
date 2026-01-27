/**
 * Context menu feature for @toolbox-web/grid-angular
 *
 * Import this module to enable the `contextMenu` input on Grid directive.
 *
 * @example
 * ```typescript
 * import '@toolbox-web/grid-angular/features/context-menu';
 *
 * <tbw-grid [contextMenu]="true" />
 * ```
 *
 * @packageDocumentation
 */

import { ContextMenuPlugin } from '@toolbox-web/grid/plugins/context-menu';
import { registerFeature } from '../lib/feature-registry';

registerFeature('contextMenu', (config) => {
  if (config === true) {
    return new ContextMenuPlugin();
  }
  return new ContextMenuPlugin(config ?? undefined);
});
