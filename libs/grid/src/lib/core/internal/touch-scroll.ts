/**
 * Touch scrolling controller for mobile devices.
 *
 * Handles touch events for scrolling with momentum physics.
 * Supports both vertical (faux scrollbar) and horizontal (scroll area) scrolling.
 */

export interface TouchScrollState {
  startY: number | null;
  startX: number | null;
  scrollTop: number | null;
  scrollLeft: number | null;
  lastY: number | null;
  lastX: number | null;
  lastTime: number | null;
  velocityY: number;
  velocityX: number;
  momentumRaf: number;
}

export interface TouchScrollElements {
  fauxScrollbar: HTMLElement;
  scrollArea: HTMLElement | null;
}

/**
 * Create initial touch scroll state.
 */
export function createTouchScrollState(): TouchScrollState {
  return {
    startY: null,
    startX: null,
    scrollTop: null,
    scrollLeft: null,
    lastY: null,
    lastX: null,
    lastTime: null,
    velocityY: 0,
    velocityX: 0,
    momentumRaf: 0,
  };
}

/**
 * Reset touch scroll state (called on touchend or cleanup).
 */
export function resetTouchState(state: TouchScrollState): void {
  state.startY = null;
  state.startX = null;
  state.scrollTop = null;
  state.scrollLeft = null;
  state.lastY = null;
  state.lastX = null;
  state.lastTime = null;
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

/**
 * Handle touchstart event.
 */
export function handleTouchStart(e: TouchEvent, state: TouchScrollState, elements: TouchScrollElements): void {
  if (e.touches.length !== 1) return;

  // Cancel any ongoing momentum animation
  cancelMomentum(state);

  const touch = e.touches[0];
  state.startY = touch.clientY;
  state.startX = touch.clientX;
  state.lastY = touch.clientY;
  state.lastX = touch.clientX;
  state.lastTime = performance.now();
  state.scrollTop = elements.fauxScrollbar.scrollTop;
  state.scrollLeft = elements.scrollArea?.scrollLeft ?? 0;
  state.velocityY = 0;
  state.velocityX = 0;
}

/**
 * Handle touchmove event.
 * Returns true if the event should be prevented (grid scrolled).
 */
export function handleTouchMove(e: TouchEvent, state: TouchScrollState, elements: TouchScrollElements): boolean {
  if (
    e.touches.length !== 1 ||
    state.startY === null ||
    state.startX === null ||
    state.scrollTop === null ||
    state.scrollLeft === null
  ) {
    return false;
  }

  const touch = e.touches[0];
  const currentY = touch.clientY;
  const currentX = touch.clientX;
  const now = performance.now();

  const deltaY = state.startY - currentY;
  const deltaX = state.startX - currentX;

  // Calculate velocity for momentum scrolling
  if (state.lastTime !== null && state.lastY !== null && state.lastX !== null) {
    const dt = now - state.lastTime;
    if (dt > 0) {
      // Velocity in pixels per millisecond
      state.velocityY = (state.lastY - currentY) / dt;
      state.velocityX = (state.lastX - currentX) / dt;
    }
  }
  state.lastY = currentY;
  state.lastX = currentX;
  state.lastTime = now;

  // Check if grid can scroll in the requested directions
  const { scrollTop, scrollHeight, clientHeight } = elements.fauxScrollbar;
  const maxScrollY = scrollHeight - clientHeight;
  const canScrollVertically = (deltaY > 0 && scrollTop < maxScrollY) || (deltaY < 0 && scrollTop > 0);

  let canScrollHorizontally = false;
  if (elements.scrollArea) {
    const { scrollLeft, scrollWidth, clientWidth } = elements.scrollArea;
    const maxScrollX = scrollWidth - clientWidth;
    canScrollHorizontally = (deltaX > 0 && scrollLeft < maxScrollX) || (deltaX < 0 && scrollLeft > 0);
  }

  // Apply scroll if grid can scroll in that direction
  if (canScrollVertically) {
    elements.fauxScrollbar.scrollTop = state.scrollTop + deltaY;
  }
  if (canScrollHorizontally && elements.scrollArea) {
    elements.scrollArea.scrollLeft = state.scrollLeft + deltaX;
  }

  // Return true to prevent page scroll when we scrolled the grid
  return canScrollVertically || canScrollHorizontally;
}

/**
 * Handle touchend event.
 * Starts momentum scrolling if velocity is significant.
 */
export function handleTouchEnd(state: TouchScrollState, elements: TouchScrollElements): void {
  const minVelocity = 0.1; // pixels per ms threshold

  // Start momentum scrolling if there's significant velocity
  if (Math.abs(state.velocityY) > minVelocity || Math.abs(state.velocityX) > minVelocity) {
    startMomentumScroll(state, elements);
  }

  resetTouchState(state);
}

/**
 * Start momentum scrolling animation.
 */
function startMomentumScroll(state: TouchScrollState, elements: TouchScrollElements): void {
  const friction = 0.95; // Deceleration factor per frame
  const minVelocity = 0.01; // Stop threshold in px/ms

  const animate = () => {
    // Apply friction
    state.velocityY *= friction;
    state.velocityX *= friction;

    // Convert velocity (px/ms) to per-frame scroll amount (~16ms per frame)
    const scrollY = state.velocityY * 16;
    const scrollX = state.velocityX * 16;

    // Apply scroll if above threshold
    if (Math.abs(state.velocityY) > minVelocity) {
      elements.fauxScrollbar.scrollTop += scrollY;
    }
    if (Math.abs(state.velocityX) > minVelocity && elements.scrollArea) {
      elements.scrollArea.scrollLeft += scrollX;
    }

    // Continue animation if still moving
    if (Math.abs(state.velocityY) > minVelocity || Math.abs(state.velocityX) > minVelocity) {
      state.momentumRaf = requestAnimationFrame(animate);
    } else {
      state.momentumRaf = 0;
    }
  };

  state.momentumRaf = requestAnimationFrame(animate);
}

/**
 * Set up touch scroll event listeners on the grid content element.
 * Returns a cleanup function that removes all listeners.
 */
export function setupTouchScrollListeners(
  gridContentEl: HTMLElement,
  state: TouchScrollState,
  elements: TouchScrollElements,
  signal: AbortSignal,
): void {
  gridContentEl.addEventListener('touchstart', (e: TouchEvent) => handleTouchStart(e, state, elements), {
    passive: true,
    signal,
  });

  gridContentEl.addEventListener(
    'touchmove',
    (e: TouchEvent) => {
      const shouldPrevent = handleTouchMove(e, state, elements);
      if (shouldPrevent) {
        e.preventDefault();
      }
    },
    { passive: false, signal },
  );

  gridContentEl.addEventListener('touchend', () => handleTouchEnd(state, elements), { passive: true, signal });
}
