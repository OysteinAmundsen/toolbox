/**
 * Editor mount hook registry — append-only hooks called when a Vue-managed
 * editor container is mounted into the DOM with a known owner grid.
 *
 * This is the augmentation point that lets feature secondary entries
 * (e.g. `@toolbox-web/grid-vue/features/editing`) install per-editor
 * lifecycle behaviour (such as the `before-edit-close` blur bridge)
 * without coupling the central adapter file to the editing feature.
 * Mirrors how core grid plugins augment the grid via `registerPlugin()`.
 *
 * @packageDocumentation
 * @internal
 */

/**
 * Hook called when an editor container is mounted. Returning a function
 * registers a teardown that runs when the editor is released.
 */
export type EditorMountHook = (ctx: { container: HTMLElement; gridEl: HTMLElement }) => (() => void) | void;

const editorMountHooks: EditorMountHook[] = [];

/**
 * Install an editor-mount hook. Called by feature secondary entries
 * (e.g. `features/editing`) on import.
 *
 * @internal Plugin API
 */
export function registerEditorMountHook(hook: EditorMountHook): void {
  editorMountHooks.push(hook);
}

/**
 * Run all registered editor-mount hooks for a freshly mounted editor.
 * Returns a combined teardown that invokes each hook's teardown in
 * registration order.
 *
 * @internal Adapter use only.
 */
export function notifyEditorMounted(container: HTMLElement, gridEl: HTMLElement): () => void {
  const teardowns: Array<() => void> = [];
  for (const hook of editorMountHooks) {
    const teardown = hook({ container, gridEl });
    if (teardown) teardowns.push(teardown);
  }
  return () => {
    for (const teardown of teardowns) teardown();
  };
}

/**
 * Returns a function that, when invoked, blurs the focused input/textarea/select
 * inside `container` (if any). Used by the `before-edit-close` bridge installed
 * by `@toolbox-web/grid-vue/features/editing` so editors with `@blur="commit"`
 * flush their pending value before the cell DOM is torn down by Tab /
 * programmatic row exit.
 * @internal
 */
export function makeFlushFocusedInput(container: HTMLElement): () => void {
  return () => {
    const focused = container.ownerDocument.activeElement as HTMLElement | null;
    if (
      focused &&
      container.contains(focused) &&
      (focused instanceof HTMLInputElement ||
        focused instanceof HTMLTextAreaElement ||
        focused instanceof HTMLSelectElement)
    ) {
      focused.blur();
    }
  };
}
