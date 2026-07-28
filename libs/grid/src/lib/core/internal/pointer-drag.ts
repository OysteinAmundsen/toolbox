/**
 * Generic pointer-drag helper — converts a `pointerdown` event into a
 * deterministic drag lifecycle with pointer capture, threshold / long-press
 * promotion, and clean teardown.
 *
 * ## Usage
 * ```ts
 * element.addEventListener('pointerdown', (e) => {
 *   startPointerDrag(e, element, {
 *     onMove: (pe) => resize(pe.clientX),
 *     onEnd:  (pe) => commit(),
 *   });
 * });
 * ```
 *
 * ## Fine vs coarse pointer promotion
 * For **fine** pointers (mouse / precision trackpad): set `longPressDuration`
 * to `0` (or omit it) so the drag is promoted immediately on first move.
 *
 * For **coarse** pointers (touch / stylus): set `longPressDuration` to e.g.
 * `400` ms so the drag is only promoted after the user holds still long
 * enough. Movement exceeding `longPressSlop` px before the timer fires
 * **cancels** the drag — this lets native scroll proceed uninterrupted.
 *
 * Branch example at call site:
 * ```ts
 * const isCoarse = e.pointerType === 'touch' || e.pointerType === 'pen';
 * startPointerDrag(e, el, handlers, { longPressDuration: isCoarse ? 400 : 0 });
 * ```
 *
 * ## Pointer capture
 * `setPointerCapture` / `releasePointerCapture` are called on `captureTarget`
 * only — **never** `document` / `window` listeners. Capture is claimed at
 * **promotion**, not on `pointerdown`: a captured pointer makes the browser
 * retarget the compatibility mouse events (`mouseup`, `click`, `dblclick`) to
 * the capture element, which would break click-driven grid features.
 *
 * ## Re-entrancy
 * Simultaneous drags on the same element with the same `pointerId` are
 * silently ignored (returns a no-op cancel function).
 *
 * ## DnD plugins
 * HTML5 drag-and-drop plugins (`RowDragDropPlugin`, `ReorderPlugin`, etc.)
 * are expected to consume this module in the future (#228). The API is
 * intentionally general.
 *
 * This module is **internal only** — NOT exported from `src/public.ts`.
 *
 * @since 3.5.0
 * @internal
 */

// #region Types

/**
 * Callbacks supplied to {@link startPointerDrag}.
 *
 * @since 3.5.0
 */
export interface PointerDragHandlers {
  /**
   * Called on each `pointermove` after the drag has been promoted.
   * For immediate drags (no threshold / long-press) this fires on the very
   * first move. For long-press promotion it fires only after the delay.
   */
  onMove(e: PointerEvent): void;

  /**
   * Called when the pointer is released after promotion (`pointerup`).
   * Not called if the drag was cancelled before promotion.
   */
  onEnd(e: PointerEvent): void;

  /**
   * Called once when the drag is promoted — when the movement threshold is
   * crossed or the long-press timer elapses. Fires before the first `onMove`.
   *
   * Long-press call sites use this to enter a mode (e.g. cell range-paint) and
   * give feedback at the moment the press is recognised, even if the pointer
   * never subsequently moves.
   */
  onPromote?(): void;

  /**
   * Called when the drag is cancelled — by `pointercancel`, `lostpointercapture`,
   * an `Escape` keydown, or the returned `cancel()` function.
   * Also called when the pointer is released *before* promotion (tap / short press).
   */
  onCancel?(): void;
}

/**
 * Options for {@link startPointerDrag}.
 *
 * @since 3.5.0
 */
export interface PointerDragOptions {
  /**
   * Minimum movement in px before the drag is promoted.
   * `0` (default) promotes immediately on the first `pointermove`.
   */
  threshold?: number;

  /**
   * Long-press duration in milliseconds.
   *
   * `0` (default) = no long-press requirement; the drag is promoted as soon
   * as the pointer moves (subject to `threshold`).
   *
   * When `> 0` the drag is promoted only after this many ms have elapsed
   * without the pointer exceeding `longPressSlop`. If the slop is exceeded
   * before the timer fires the entire drag is cancelled so native scroll can
   * proceed.
   *
   * Use this for **coarse** (touch/stylus) pointers to disambiguate a tap
   * or a scroll gesture from an intentional drag-to-paint interaction.
   */
  longPressDuration?: number;

  /**
   * Maximum pointer movement (px) permitted during the long-press wait.
   * If this distance is exceeded the drag is cancelled.
   * Default: `8`.
   */
  longPressSlop?: number;
}

// #endregion

// #region Re-entrancy guard

/**
 * Tracks active pointer IDs per capture target.
 * Prevents two simultaneous drags on the same element with the same pointer.
 */
const _activePointers = new WeakMap<Element, Set<number>>();

function _claimPointer(el: Element, id: number): boolean {
  let set = _activePointers.get(el);
  if (!set) {
    set = new Set();
    _activePointers.set(el, set);
  }
  if (set.has(id)) return false;
  set.add(id);
  return true;
}

function _releasePointer(el: Element, id: number): void {
  _activePointers.get(el)?.delete(id);
}

// #endregion

// #region startPointerDrag

/**
 * Begin a pointer drag on `captureTarget`.
 *
 * Attaches `pointermove`, `pointerup`, `pointercancel`, and
 * `lostpointercapture` listeners directly to `captureTarget` (never to
 * `document` / `window`). `setPointerCapture` is called when the drag is
 * promoted so events continue to route here regardless of DOM changes; an
 * unpromoted press never captures and therefore leaves `click` / `dblclick`
 * targeting the element actually under the pointer.
 *
 * Returns a `cancel()` dispose function. Calling it is idempotent.
 *
 * @param startEvent  - The originating `pointerdown` event.
 * @param captureTarget - Element on which to set pointer capture and attach
 *   pointer listeners. Must be in a connected document.
 * @param handlers - `onMove`, `onEnd`, and optional `onCancel` callbacks.
 * @param options - Threshold, long-press, and slop configuration.
 *
 * @since 3.5.0
 */
export function startPointerDrag(
  startEvent: PointerEvent,
  captureTarget: Element,
  handlers: PointerDragHandlers,
  options?: PointerDragOptions,
): () => void {
  const { onMove, onEnd, onCancel, onPromote } = handlers;
  const threshold = options?.threshold ?? 0;
  const longPressDuration = options?.longPressDuration ?? 0;
  const longPressSlop = options?.longPressSlop ?? 8;
  const pointerId = startEvent.pointerId;

  // Re-entrancy guard — silently ignore duplicate drags on same element/pointer
  if (!_claimPointer(captureTarget, pointerId)) {
    // eslint-disable-next-line @typescript-eslint/no-empty-function
    return () => {};
  }

  const startX = startEvent.clientX;
  const startY = startEvent.clientY;

  // Promotion: true when the drag has passed threshold/long-press requirements
  let promoted = threshold === 0 && longPressDuration === 0;
  let done = false;
  let longPressTimer: ReturnType<typeof setTimeout> | null = null;
  let captureFailed = false;

  // #region Internal helpers

  /**
   * Claim pointer capture — called at promotion, never at `pointerdown`.
   *
   * While an element holds pointer capture the browser retargets the
   * compatibility mouse events (`mouseup`, `click`, `dblclick`) to that element
   * instead of the element actually under the pointer. Capturing on press would
   * therefore break every click-driven feature in the grid (cell editing,
   * header sort, row click) because those handlers resolve their target with
   * `event.target.closest(...)`. Promotion is the point where the gesture is
   * known to be a drag, so capturing there keeps plain clicks intact.
   */
  function acquireCapture(): boolean {
    try {
      captureTarget.setPointerCapture(pointerId);
      return true;
    } catch {
      // setPointerCapture can fail in unit-test environments without full
      // browser APIs, or if the element was detached mid-gesture. Callers
      // typically flip UI state (cursor, user-select, `isResizing`) *before*
      // calling us, so report the failure as a cancellation — otherwise that
      // state is never rolled back and the UI sticks mid-drag.
      captureFailed = true;
      return false;
    }
  }

  /** Promote the gesture to a drag: take capture, then notify the caller. */
  function promote(): boolean {
    promoted = true;
    if (!acquireCapture()) {
      cancel();
      return false;
    }
    onPromote?.();
    return true;
  }

  function teardown(): void {
    if (done) return;
    done = true;
    if (longPressTimer !== null) {
      clearTimeout(longPressTimer);
      longPressTimer = null;
    }
    captureTarget.removeEventListener('pointermove', onPointerMove);
    captureTarget.removeEventListener('pointerup', onPointerUp);
    captureTarget.removeEventListener('pointercancel', onPointerCancel);
    captureTarget.removeEventListener('lostpointercapture', onLostCapture);
    document.removeEventListener('keydown', onEscapeKey, true);
    _releasePointer(captureTarget, pointerId);
    try {
      if (captureTarget.hasPointerCapture(pointerId)) {
        captureTarget.releasePointerCapture(pointerId);
      }
    } catch {
      // Ignore — element may have been removed from DOM
    }
  }

  function cancel(): void {
    if (done) return;
    teardown();
    onCancel?.();
  }

  // #endregion

  // #region Event handlers

  function onPointerMove(event: Event): void {
    const e = event as PointerEvent;
    if (e.pointerId !== pointerId || done) return;

    const dx = e.clientX - startX;
    const dy = e.clientY - startY;
    const dist = Math.sqrt(dx * dx + dy * dy);

    if (!promoted) {
      if (longPressDuration > 0) {
        // Cancel entire drag if movement exceeds slop while waiting for long-press
        if (dist > longPressSlop) {
          cancel();
          return;
        }
        // Long-press not yet elapsed — swallow event, no onMove
        return;
      }
      // Threshold promotion only (no long-press)
      if (threshold > 0 && dist < threshold) return;
      if (!promote()) return;
    }

    onMove(e);
  }

  function onPointerUp(event: Event): void {
    const e = event as PointerEvent;
    if (e.pointerId !== pointerId || done) return;
    const wasPromoted = promoted;
    teardown();
    if (wasPromoted) {
      onEnd(e);
    } else {
      onCancel?.();
    }
  }

  function onPointerCancel(event: Event): void {
    const e = event as PointerEvent;
    if (e.pointerId !== pointerId || done) return;
    cancel();
  }

  function onLostCapture(event: Event): void {
    const e = event as PointerEvent;
    if (e.pointerId !== pointerId || done) return;
    cancel();
  }

  function onEscapeKey(event: Event): void {
    const e = event as KeyboardEvent;
    if (e.key === 'Escape' && !done) cancel();
  }

  // #endregion

  // Attach listeners before starting the long-press timer
  captureTarget.addEventListener('pointermove', onPointerMove);
  captureTarget.addEventListener('pointerup', onPointerUp);
  captureTarget.addEventListener('pointercancel', onPointerCancel);
  captureTarget.addEventListener('lostpointercapture', onLostCapture);
  document.addEventListener('keydown', onEscapeKey, true);

  // Drags with neither a threshold nor a long-press are promoted up front.
  if (promoted) {
    promote();
    // eslint-disable-next-line @typescript-eslint/no-empty-function
    if (captureFailed) return () => {};
  }

  // Start long-press timer after capture so the countdown is accurate
  if (longPressDuration > 0) {
    longPressTimer = setTimeout(() => {
      longPressTimer = null;
      if (done) return;
      promote();
    }, longPressDuration);
  }

  return cancel;
}

// #endregion
