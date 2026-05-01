/**
 * Editing feature for @toolbox-web/grid-angular
 *
 * Import this module to enable the `editing` input on Grid directive AND to
 * install the `before-edit-close` blur bridge that flushes pending input from
 * Angular editors that commit on `(blur)` before the cell DOM is torn down by
 * Tab / programmatic row exit.
 *
 * Without this import, Angular `(blur)`-committing editors silently lose
 * pending input on programmatic row exit.
 *
 * @example
 * ```typescript
 * import '@toolbox-web/grid-angular/features/editing';
 *
 * <tbw-grid [editing]="'dblclick'" />
 * ```
 *
 * @packageDocumentation
 */

import { makeFlushFocusedInput, registerEditorMountHook } from '@toolbox-web/grid-angular/internal';
import '@toolbox-web/grid/features/editing';
export type { _Augmentation as _EditingAugmentation } from '@toolbox-web/grid/features/editing';

// Bridge the editing plugin's `before-edit-close` event to a synchronous
// `.blur()` on the focused input/textarea/select inside the editor host.
// Angular editors that commit on `(blur)` rely on the focused control firing
// blur naturally, but Tab / programmatic row exit rebuilds the cell DOM
// synchronously without giving the focused control a chance to blur first.
registerEditorMountHook(({ container, gridEl }) => {
  const flush = makeFlushFocusedInput(container);
  gridEl.addEventListener('before-edit-close', flush);
  return () => gridEl.removeEventListener('before-edit-close', flush);
});
