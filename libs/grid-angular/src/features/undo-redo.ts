/**
 * Undo/Redo feature for @toolbox-web/grid-angular
 *
 * Import this module to enable the `undoRedo` input on Grid directive.
 * Requires editing feature to be enabled.
 *
 * @example
 * ```typescript
 * import '@toolbox-web/grid-angular/features/editing';
 * import '@toolbox-web/grid-angular/features/undo-redo';
 *
 * <tbw-grid [editing]="'dblclick'" [undoRedo]="true" />
 * ```
 *
 * @packageDocumentation
 */

// eslint-disable-next-line @nx/enforce-module-boundaries -- Intentional: feature files must statically import their plugin
import { UndoRedoPlugin } from '@toolbox-web/grid/plugins/undo-redo';
import { registerFeature } from '../lib/feature-registry';

registerFeature('undoRedo', (config) => {
  if (config === true) {
    return new UndoRedoPlugin();
  }
  return new UndoRedoPlugin(config ?? undefined);
});
