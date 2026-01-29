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

// eslint-disable-next-line @nx/enforce-module-boundaries -- Intentional: feature files must statically import their plugin
import { ContextMenuPlugin } from '@toolbox-web/grid/plugins/context-menu';
import { registerFeature } from '@toolbox-web/grid-angular';

registerFeature('contextMenu', (config) => {
  if (config === true) {
    return new ContextMenuPlugin();
  }
  return new ContextMenuPlugin(config ?? undefined);
});
