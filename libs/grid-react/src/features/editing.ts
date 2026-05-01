/**
 * Editing feature for @toolbox-web/grid-react
 *
 * Import this module to enable the `editing` prop on DataGrid.
 *
 * @example
 * ```tsx
 * import '@toolbox-web/grid-react/features/editing';
 *
 * <DataGrid editing="dblclick" />
 * ```
 *
 * @packageDocumentation
 */

// Delegate to core feature registration
import '@toolbox-web/grid/features/editing';

import { registerEditorMountHook } from '../lib/editor-mount-hooks';
import { makeFlushFocusedInput } from '../lib/react-column-config';

// Install the `before-edit-close` blur bridge on the React adapter.
// Augments the adapter (mirroring how core plugins augment the grid via
// `registerPlugin`) so the editing-feature event listener lives with the
// editing feature, not in the central adapter file.
//
// The bridge handles "Tab / programmatic row exit drops pending input":
// EditingPlugin emits `before-edit-close` on the host `<tbw-grid>` before
// tearing down a row's managed editors. Calling native `.blur()` on the
// focused input inside the editor container fires both `blur` (non-bubbling)
// and `focusout` (bubbling) — React's event delegation listens to `focusout`
// and maps it to `onBlur`, so any editor with `onBlur={commit}` flushes
// before the cell DOM is torn down.
registerEditorMountHook(({ container, gridEl }) => {
  const flush = makeFlushFocusedInput(container);
  gridEl.addEventListener('before-edit-close', flush);
  return () => gridEl.removeEventListener('before-edit-close', flush);
});
