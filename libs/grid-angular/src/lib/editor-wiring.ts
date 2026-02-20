/**
 * Editor Wiring Helpers
 *
 * Pure functions for wiring up commit/cancel handlers on editor components.
 * Extracted from GridAdapter to enable unit testing without Angular DI.
 *
 * @internal
 */

// #region subscribeToOutput

/**
 * Subscribes to an Angular output on a component instance.
 * Works with both EventEmitter and OutputEmitterRef (signal outputs).
 *
 * @param instance - The component instance (as a plain record)
 * @param outputName - Name of the output property
 * @param callback - Callback to invoke when the output emits
 * @returns `true` if the output was found and subscribed, `false` otherwise
 * @internal
 */
export function subscribeToOutput<T>(
  instance: Record<string, unknown>,
  outputName: string,
  callback: (value: T) => void,
): boolean {
  const output = instance[outputName];
  if (!output) return false;

  // Check if it's an Observable-like (EventEmitter or OutputEmitterRef)
  if (typeof (output as { subscribe?: unknown }).subscribe === 'function') {
    (output as { subscribe: (fn: (v: T) => void) => void }).subscribe(callback);
    return true;
  }
  return false;
}

// #endregion

// #region wireEditorCallbacks

/**
 * Wire up commit/cancel handlers for an editor component.
 *
 * Supports both Angular outputs and DOM CustomEvents. When both fire
 * (the BaseGridEditor pattern), a per-action flag prevents the callback
 * from running twice.
 *
 * @param hostElement - The host DOM element for the editor
 * @param instance - The component instance (as a plain record)
 * @param commit - Callback to invoke when committing a value
 * @param cancel - Callback to invoke when cancelling the edit
 * @internal
 */
export function wireEditorCallbacks<TValue>(
  hostElement: HTMLElement,
  instance: Record<string, unknown>,
  commit: (value: TValue) => void,
  cancel: () => void,
): void {
  // Guard: when both Angular output AND DOM event fire (BaseGridEditor.commitValue
  // emits both), only the first should call commit/cancel(). The flags prevent
  // double-fires that cause redundant cell-commit events and extra dirty-tracking work.
  let commitHandledByOutput = false;
  let cancelHandledByOutput = false;

  subscribeToOutput(instance, 'commit', (value: TValue) => {
    commitHandledByOutput = true;
    commit(value);
  });
  subscribeToOutput(instance, 'cancel', () => {
    cancelHandledByOutput = true;
    cancel();
  });

  // Also listen for DOM CustomEvents as a fallback for editors that don't
  // have Angular commit/cancel outputs (e.g., third-party web components).
  hostElement.addEventListener('commit', (e: Event) => {
    e.stopPropagation();
    if (commitHandledByOutput) {
      // Already handled by the Angular output subscription — reset and skip.
      commitHandledByOutput = false;
      return;
    }
    const customEvent = e as CustomEvent<TValue>;
    commit(customEvent.detail);
  });
  hostElement.addEventListener('cancel', (e: Event) => {
    e.stopPropagation();
    if (cancelHandledByOutput) {
      cancelHandledByOutput = false;
      return;
    }
    cancel();
  });
}

// #endregion
