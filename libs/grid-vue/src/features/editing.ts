/**
 * Editing feature for @toolbox-web/grid-vue
 *
 * Import this module to enable the `editing` prop on TbwGrid.
 *
 * @example
 * ```vue
 * <script setup>
 * import '@toolbox-web/grid-vue/features/editing';
 * </script>
 *
 * <template>
 *   <TbwGrid editing="dblclick" />
 * </template>
 * ```
 *
 * @packageDocumentation
 */

// Delegate to core feature registration
import '@toolbox-web/grid/features/editing';

import { makeFlushFocusedInput, registerEditorMountHook } from '../lib/editor-mount-hooks';

// Install the `before-edit-close` blur bridge on the Vue adapter.
// Augments the adapter (mirroring how core plugins augment the grid via
// `registerPlugin`) so the editing-feature event listener lives with the
// editing feature, not in the central adapter file.
//
// The bridge handles "Tab / programmatic row exit drops pending input":
// EditingPlugin emits `before-edit-close` on the host `<tbw-grid>` before
// tearing down a row's managed editors. Calling native `.blur()` on the
// focused input inside the editor container fires the focus-loss chain so
// editors with `@blur="commit"` flush before the cell DOM is torn down.
registerEditorMountHook(({ container, gridEl }) => {
  const flush = makeFlushFocusedInput(container);
  gridEl.addEventListener('before-edit-close', flush);
  return () => gridEl.removeEventListener('before-edit-close', flush);
});
