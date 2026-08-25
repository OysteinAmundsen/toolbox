/**
 * Non-native scroll input for the faux-scrollbar pattern — touch gestures and wheel forwarding.
 *
 * Uses pointer events with setPointerCapture to ensure events are delivered
 * directly to the grid element, even when DOM virtualization replaces the
 * original touch target element mid-gesture.
 *
 * Without pointer capture, touch events are dispatched to the original target
 * element (e.g., a cell or card). When virtualization recycles that element's
 * content, the target is removed from the DOM and subsequent touchmove/touchend
 * events are lost — causing scrolling to stop after ~2 rows.
 *
 * setPointerCapture routes all events for a pointer ID directly to the capture
 * element (.tbw-grid-content), bypassing target resolution entirely.
 *
 * Uses incremental deltas (frame-to-frame) rather than absolute offsets from
 * the gesture start, which is more robust when virtualized content height
 * changes during scrolling (e.g., responsive card mode with variable-height rows).
 */

// #region Types
export interface TouchScrollState {
  startY: number | null;
  startX: number | null;
  lastY: number | null;
  lastX: number | null;
  lastTime: number | null;
  velocityY: number;
  velocityX: number;
  momentumRaf: number;
  /** Once we start scrolling the grid, lock until gesture ends to prevent browser takeover */
  locked: boolean;
  /** Active pointer ID for setPointerCapture tracking (null = no active gesture) */
  activePointerId: number | null;
}

export interface TouchScrollElements {
  fauxScrollbar: HTMLElement;
  scrollArea: HTMLElement | null;
}
// #endregion

// #region State Management
/**
 * Create initial touch scroll state.
 */
export function createTouchScrollState(): TouchScrollState {
  return {
    startY: null,
    startX: null,
    lastY: null,
    lastX: null,
    lastTime: null,
    velocityY: 0,
    velocityX: 0,
    momentumRaf: 0,
    locked: false,
    activePointerId: null,
  };
}

/**
 * Reset touch scroll state (called on touchend or cleanup).
 */
export function resetTouchState(state: TouchScrollState): void {
  state.startY = null;
  state.startX = null;
  state.lastY = null;
  state.lastX = null;
  state.lastTime = null;
  state.locked = false;
}

/**
 * Cancel any ongoing momentum animation.
 */
export function cancelMomentum(state: TouchScrollState): void {
  if (state.momentumRaf) {
    cancelAnimationFrame(state.momentumRaf);
    state.momentumRaf = 0;
  }
}
// #endregion

// #region Touch Handlers
/**
 * Handle gesture start (from pointerdown).
 */
export function handleTouchStart(clientX: number, clientY: number, state: TouchScrollState): void {
  // Cancel any ongoing momentum animation
  cancelMomentum(state);

  state.startY = clientY;
  state.startX = clientX;
  state.lastY = clientY;
  state.lastX = clientX;
  state.lastTime = performance.now();
  state.velocityY = 0;
  state.velocityX = 0;
  state.locked = false;
}

/**
 * Handle gesture move (from pointermove).
 * Uses incremental deltas (from previous position) for robustness.
 * Returns true if the event should be prevented (grid is handling scroll).
 */
export function handleTouchMove(
  clientX: number,
  clientY: number,
  state: TouchScrollState,
  elements: TouchScrollElements,
): boolean {
  if (state.lastY === null || state.lastX === null) {
    return false;
  }

  const now = performance.now();

  // Incremental delta since last move (not from gesture start)
  const incrY = state.lastY - clientY;
  const incrX = state.lastX - clientX;

  // Calculate velocity for momentum scrolling
  if (state.lastTime !== null) {
    const dt = now - state.lastTime;
    if (dt > 0) {
      state.velocityY = incrY / dt;
      state.velocityX = incrX / dt;
    }
  }
  state.lastY = clientY;
  state.lastX = clientX;
  state.lastTime = now;

  // If already locked to grid scrolling, check boundaries before scrolling
  if (state.locked) {
    const { scrollTop, scrollHeight, clientHeight } = elements.fauxScrollbar;
    const canScrollY = (incrY > 0 && scrollTop < scrollHeight - clientHeight) || (incrY < 0 && scrollTop > 0);

    if (canScrollY) {
      elements.fauxScrollbar.scrollTop += incrY;
    } else if (incrY !== 0) {
      // At vertical boundary — propagate scroll to the page
      window.scrollBy(0, incrY);
    }

    if (elements.scrollArea) {
      const { scrollLeft, scrollWidth, clientWidth } = elements.scrollArea;
      const canScrollX = (incrX > 0 && scrollLeft < scrollWidth - clientWidth) || (incrX < 0 && scrollLeft > 0);

      if (canScrollX) {
        elements.scrollArea.scrollLeft += incrX;
      } else if (incrX !== 0) {
        // At horizontal boundary — propagate scroll to the page
        window.scrollBy(incrX, 0);
      }
    }

    return true;
  }

  // Determine scroll direction on first significant move (> 3px from start)
  const totalDeltaY = state.startY !== null ? Math.abs(state.startY - clientY) : 0;
  const totalDeltaX = state.startX !== null ? Math.abs(state.startX - clientX) : 0;
  if (totalDeltaY < 3 && totalDeltaX < 3) return false;

  // Determine primary gesture direction from total delta, not micro-frame delta.
  // Using totalDelta avoids mis-detection from finger jitter between frames.
  const isVerticalGesture = totalDeltaY >= totalDeltaX;

  // Check if grid has scrollable content in this axis.
  // Boundary position checks happen in the locked branch above.
  const { scrollHeight, clientHeight } = elements.fauxScrollbar;
  const hasVerticalScroll = scrollHeight - clientHeight > 0;

  let hasHorizontalScroll = false;
  if (elements.scrollArea) {
    const { scrollWidth, clientWidth } = elements.scrollArea;
    hasHorizontalScroll = scrollWidth - clientWidth > 0;
  }

  if ((isVerticalGesture && hasVerticalScroll) || (!isVerticalGesture && hasHorizontalScroll)) {
    // Lock to grid scrolling for the rest of this gesture
    state.locked = true;
    elements.fauxScrollbar.scrollTop += incrY;
    if (elements.scrollArea) {
      elements.scrollArea.scrollLeft += incrX;
    }
    return true;
  }

  // Grid can't scroll in this direction — let the page scroll
  return false;
}

/**
 * Handle touchend event.
 * Starts momentum scrolling if velocity is significant.
 */
export function handleTouchEnd(state: TouchScrollState, elements: TouchScrollElements): void {
  const minVelocity = 0.1; // pixels per ms threshold

  // Zero velocity when the finger was stationary before release.
  // pointermove events fire every ~16ms during active movement. If the last
  // move was more than ~60ms ago (4 frames), the user was holding still and
  // expects scrolling to stop — not to resume with stale velocity from the
  // earlier movement phase.
  if (state.lastTime !== null) {
    const timeSinceLastMove = performance.now() - state.lastTime;
    if (timeSinceLastMove > 60) {
      state.velocityY = 0;
      state.velocityX = 0;
    }
  }

  // Start momentum scrolling if there's significant velocity
  if (Math.abs(state.velocityY) > minVelocity || Math.abs(state.velocityX) > minVelocity) {
    startMomentumScroll(state, elements);
  }

  resetTouchState(state);
}
// #endregion

// #region Momentum Scrolling
/**
 * Start momentum scrolling animation.
 *
 * Uses time-based friction so deceleration is consistent regardless of actual
 * frame timing. If the browser delays a rAF callback (mobile power-saving,
 * compositor throttling), the elapsed time is still accounted for correctly.
 */
function startMomentumScroll(state: TouchScrollState, elements: TouchScrollElements): void {
  const friction = 0.95; // Deceleration factor per 16ms frame
  const minFrameScroll = 1; // Stop when per-frame scroll < 1px
  let lastFrameTime = performance.now();

  const animate = () => {
    const now = performance.now();
    const elapsed = now - lastFrameTime;
    lastFrameTime = now;

    // Apply friction proportional to actual elapsed time.
    const frames = elapsed / 16;
    const decay = Math.pow(friction, frames);
    state.velocityY *= decay;
    state.velocityX *= decay;

    // Convert velocity (px/ms) to per-frame scroll amount (~16ms per frame)
    const scrollY = state.velocityY * 16;
    const scrollX = state.velocityX * 16;

    const movingY = Math.abs(scrollY) >= minFrameScroll;
    const movingX = Math.abs(scrollX) >= minFrameScroll;

    // Only apply scroll when per-frame amount is visible (>= 1px).
    // Without this guard, a delayed rAF callback (e.g. 400ms gap from
    // browser throttling) would still write a sub-pixel amount that
    // rounds to 1px — producing the visible "late jump."
    if (movingY) {
      elements.fauxScrollbar.scrollTop += scrollY;
    }
    if (movingX && elements.scrollArea) {
      elements.scrollArea.scrollLeft += scrollX;
    }

    if (movingY || movingX) {
      state.momentumRaf = requestAnimationFrame(animate);
    } else {
      state.momentumRaf = 0;
    }
  };

  state.momentumRaf = requestAnimationFrame(animate);
}
// #endregion

// #region Setup
/**
 * Set up pointer event listeners on the grid content element for touch scrolling.
 *
 * Uses pointer events + setPointerCapture instead of touch events because
 * DOM virtualization can destroy the original touch target mid-gesture,
 * causing touch events to stop being delivered. Pointer capture routes
 * all events directly to the grid element regardless of DOM changes.
 */
export function setupTouchScrollListeners(
  gridContentEl: HTMLElement,
  state: TouchScrollState,
  elements: TouchScrollElements,
  signal: AbortSignal,
): void {
  gridContentEl.addEventListener(
    'pointerdown',
    (e: PointerEvent) => {
      // Only handle touch (not mouse/pen), and only one finger at a time
      if (e.pointerType !== 'touch' || state.activePointerId !== null) return;
      state.activePointerId = e.pointerId;
      gridContentEl.setPointerCapture(e.pointerId);
      handleTouchStart(e.clientX, e.clientY, state);
    },
    { passive: true, signal },
  );

  gridContentEl.addEventListener(
    'pointermove',
    (e: PointerEvent) => {
      if (e.pointerId !== state.activePointerId) return;
      const shouldPrevent = handleTouchMove(e.clientX, e.clientY, state, elements);
      if (shouldPrevent) {
        e.preventDefault();
      }
    },
    { passive: false, signal },
  );

  gridContentEl.addEventListener(
    'pointerup',
    (e: PointerEvent) => {
      if (e.pointerId !== state.activePointerId) return;
      state.activePointerId = null;
      handleTouchEnd(state, elements);
    },
    { passive: true, signal },
  );

  gridContentEl.addEventListener(
    'pointercancel',
    (e: PointerEvent) => {
      if (e.pointerId !== state.activePointerId) return;
      state.activePointerId = null;
      resetTouchState(state);
    },
    { passive: true, signal },
  );

  // Safety net: if pointer capture is lost unexpectedly, clean up
  gridContentEl.addEventListener(
    'lostpointercapture',
    (e: PointerEvent) => {
      if (e.pointerId !== state.activePointerId) return;
      state.activePointerId = null;
      resetTouchState(state);
    },
    { passive: true, signal },
  );
}

/**
 * Forward wheel gestures from the content area to the faux scrollbar / scroll area.
 *
 * The content area never scrolls natively (rows are positioned via transforms), so
 * without this the mouse wheel would do nothing over the grid. When the target axis
 * is already at its limit the event is left to bubble so the page scrolls instead.
 */
export function setupWheelScrollListeners(
  gridContentEl: HTMLElement,
  elements: TouchScrollElements,
  signal: AbortSignal,
): void {
  const { fauxScrollbar, scrollArea } = elements;
  gridContentEl.addEventListener(
    'wheel',
    (e: WheelEvent) => {
      // A native <select> picker renders in the top layer but its wheel events still
      // target the grid content; scrolling the grid would close the picker.
      try {
        if (gridContentEl.querySelector('select:open')) return;
      } catch {
        /* :open pseudo-class not supported — ignore */
      }

      const isHorizontal = e.shiftKey || Math.abs(e.deltaX) > Math.abs(e.deltaY);

      if (isHorizontal && scrollArea) {
        const delta = e.shiftKey ? e.deltaY : e.deltaX;
        const { scrollLeft, scrollWidth, clientWidth } = scrollArea;
        const canScroll = (delta > 0 && scrollLeft < scrollWidth - clientWidth) || (delta < 0 && scrollLeft > 0);
        if (canScroll) {
          e.preventDefault();
          scrollArea.scrollLeft += delta;
        }
      } else if (!isHorizontal) {
        const { scrollTop, scrollHeight, clientHeight } = fauxScrollbar;
        const canScroll = (e.deltaY > 0 && scrollTop < scrollHeight - clientHeight) || (e.deltaY < 0 && scrollTop > 0);
        if (canScroll) {
          e.preventDefault();
          fauxScrollbar.scrollTop += e.deltaY;
        }
      }
    },
    { passive: false, signal },
  );
}
// #endregion
