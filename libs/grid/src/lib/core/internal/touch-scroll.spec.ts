import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import {
  cancelMomentum,
  createTouchScrollState,
  handleTouchEnd,
  handleTouchMove,
  handleTouchStart,
  resetTouchState,
  setupTouchScrollListeners,
  type TouchScrollElements,
  type TouchScrollState,
} from './touch-scroll';

describe('touch-scroll', () => {
  describe('createTouchScrollState', () => {
    it('should create initial state with null values', () => {
      const state = createTouchScrollState();

      expect(state.startY).toBeNull();
      expect(state.startX).toBeNull();
      expect(state.lastY).toBeNull();
      expect(state.lastX).toBeNull();
      expect(state.lastTime).toBeNull();
      expect(state.velocityY).toBe(0);
      expect(state.velocityX).toBe(0);
      expect(state.momentumRaf).toBe(0);
      expect(state.locked).toBe(false);
      expect(state.activePointerId).toBeNull();
    });
  });

  describe('resetTouchState', () => {
    it('should reset position and time values to null', () => {
      const state = createTouchScrollState();
      state.startY = 100;
      state.startX = 50;
      state.lastY = 90;
      state.lastX = 45;
      state.lastTime = 1000;
      state.locked = true;

      resetTouchState(state);

      expect(state.startY).toBeNull();
      expect(state.startX).toBeNull();
      expect(state.lastY).toBeNull();
      expect(state.lastX).toBeNull();
      expect(state.lastTime).toBeNull();
      expect(state.locked).toBe(false);
    });

    it('should not reset velocity or momentumRaf', () => {
      const state = createTouchScrollState();
      state.velocityY = 0.5;
      state.velocityX = 0.3;
      state.momentumRaf = 123;

      resetTouchState(state);

      expect(state.velocityY).toBe(0.5);
      expect(state.velocityX).toBe(0.3);
      expect(state.momentumRaf).toBe(123);
    });
  });

  describe('cancelMomentum', () => {
    it('should cancel animation frame when momentumRaf is set', () => {
      const cancelSpy = vi.spyOn(globalThis, 'cancelAnimationFrame');
      const state = createTouchScrollState();
      state.momentumRaf = 456;

      cancelMomentum(state);

      expect(cancelSpy).toHaveBeenCalledWith(456);
      expect(state.momentumRaf).toBe(0);
      cancelSpy.mockRestore();
    });

    it('should not call cancelAnimationFrame when momentumRaf is 0', () => {
      const cancelSpy = vi.spyOn(globalThis, 'cancelAnimationFrame');
      const state = createTouchScrollState();
      state.momentumRaf = 0;

      cancelMomentum(state);

      expect(cancelSpy).not.toHaveBeenCalled();
      cancelSpy.mockRestore();
    });
  });

  describe('handleTouchStart', () => {
    let state: TouchScrollState;
    let fauxScrollbar: HTMLElement;

    beforeEach(() => {
      state = createTouchScrollState();
      fauxScrollbar = document.createElement('div');
      Object.defineProperty(fauxScrollbar, 'scrollTop', { value: 100, writable: true });
    });

    it('should initialize touch state from coordinates', () => {
      handleTouchStart(50, 200, state);

      expect(state.startY).toBe(200);
      expect(state.startX).toBe(50);
      expect(state.lastY).toBe(200);
      expect(state.lastX).toBe(50);
      expect(state.velocityY).toBe(0);
      expect(state.velocityX).toBe(0);
      expect(state.locked).toBe(false);
    });

    it('should cancel ongoing momentum animation', () => {
      const cancelSpy = vi.spyOn(globalThis, 'cancelAnimationFrame');
      state.momentumRaf = 789;

      handleTouchStart(50, 200, state);

      expect(cancelSpy).toHaveBeenCalledWith(789);
      expect(state.momentumRaf).toBe(0);
      cancelSpy.mockRestore();
    });
  });

  describe('handleTouchMove', () => {
    let state: TouchScrollState;
    let elements: TouchScrollElements;
    let fauxScrollbar: HTMLElement;

    beforeEach(() => {
      state = createTouchScrollState();
      fauxScrollbar = document.createElement('div');

      // Mock scrollable element
      Object.defineProperties(fauxScrollbar, {
        scrollTop: { value: 100, writable: true },
        scrollHeight: { value: 1000 },
        clientHeight: { value: 400 },
      });

      elements = { fauxScrollbar, scrollArea: null };

      // Initialize state as if touchstart occurred
      state.startY = 200;
      state.startX = 50;
      state.lastY = 200;
      state.lastX = 50;
      state.lastTime = performance.now() - 16;
    });

    it('should return false when state is not initialized', () => {
      state.lastY = null;

      const result = handleTouchMove(50, 180, state, elements);

      expect(result).toBe(false);
    });

    it('should return false for small movements (below 3px threshold)', () => {
      const result = handleTouchMove(50, 199, state, elements);

      expect(result).toBe(false);
    });

    it('should return true and lock when scrolling vertically', () => {
      // Move > 3px to trigger lock
      const result = handleTouchMove(50, 180, state, elements);

      expect(result).toBe(true);
      expect(state.locked).toBe(true);
    });

    it('should use incremental deltas for scroll', () => {
      // First move: from 200 to 180 (incr = 20)
      handleTouchMove(50, 180, state, elements);
      expect(fauxScrollbar.scrollTop).toBe(120); // 100 + 20

      // Second move: from 180 to 170 (incr = 10), should add incrementally
      handleTouchMove(50, 170, state, elements);
      expect(fauxScrollbar.scrollTop).toBe(130); // 120 + 10
    });

    it('should update velocity based on touch movement', () => {
      handleTouchMove(50, 180, state, elements);

      expect(state.velocityY).toBeGreaterThan(0);
      expect(state.lastY).toBe(180);
    });

    it('should keep preventing default once locked', () => {
      // First move locks
      handleTouchMove(50, 180, state, elements);
      expect(state.locked).toBe(true);

      // Subsequent moves stay locked even with small delta
      const result = handleTouchMove(50, 179, state, elements);
      expect(result).toBe(true);
    });

    it('should propagate to window when locked and at bottom boundary scrolling down', () => {
      const scrollBySpy = vi.spyOn(window, 'scrollBy').mockImplementation(vi.fn());

      // Set scrollTop to bottom boundary
      Object.defineProperties(fauxScrollbar, {
        scrollTop: { value: 600, writable: true }, // scrollHeight(1000) - clientHeight(400)
        scrollHeight: { value: 1000 },
        clientHeight: { value: 400 },
      });

      // Lock the gesture
      state.locked = true;

      // Scroll down (positive incrY: lastY - clientY > 0 means clientY < lastY)
      const result = handleTouchMove(50, 190, state, elements); // incrY = 200 - 190 = 10 (down)
      expect(result).toBe(true);
      expect(scrollBySpy).toHaveBeenCalledWith(0, 10);
      // scrollTop should NOT have changed
      expect(fauxScrollbar.scrollTop).toBe(600);

      scrollBySpy.mockRestore();
    });

    it('should propagate to window when locked and at top boundary scrolling up', () => {
      const scrollBySpy = vi.spyOn(window, 'scrollBy').mockImplementation(vi.fn());

      Object.defineProperties(fauxScrollbar, {
        scrollTop: { value: 0, writable: true },
        scrollHeight: { value: 1000 },
        clientHeight: { value: 400 },
      });

      state.locked = true;

      // Scroll up (negative incrY: lastY - clientY < 0 means clientY > lastY)
      const result = handleTouchMove(50, 210, state, elements); // incrY = 200 - 210 = -10 (up)
      expect(result).toBe(true);
      expect(scrollBySpy).toHaveBeenCalledWith(0, -10);
      expect(fauxScrollbar.scrollTop).toBe(0);

      scrollBySpy.mockRestore();
    });

    it('should scroll grid normally when locked at boundary but reversing direction', () => {
      const scrollBySpy = vi.spyOn(window, 'scrollBy').mockImplementation(vi.fn());

      Object.defineProperties(fauxScrollbar, {
        scrollTop: { value: 600, writable: true }, // at bottom
        scrollHeight: { value: 1000 },
        clientHeight: { value: 400 },
      });

      state.locked = true;

      // Scroll UP from bottom boundary (should scroll grid, not window)
      handleTouchMove(50, 210, state, elements); // incrY = 200 - 210 = -10 (up)
      expect(scrollBySpy).not.toHaveBeenCalled();
      expect(fauxScrollbar.scrollTop).toBe(590); // 600 - 10

      scrollBySpy.mockRestore();
    });

    it('should propagate horizontal scroll to window at boundary', () => {
      const scrollBySpy = vi.spyOn(window, 'scrollBy').mockImplementation(vi.fn());

      const scrollArea = document.createElement('div');
      Object.defineProperties(scrollArea, {
        scrollLeft: { value: 400, writable: true }, // at right boundary
        scrollWidth: { value: 800 },
        clientWidth: { value: 400 },
      });
      elements.scrollArea = scrollArea;

      // At vertical bottom too so vertical doesn't consume the event
      Object.defineProperties(fauxScrollbar, {
        scrollTop: { value: 600, writable: true },
        scrollHeight: { value: 1000 },
        clientHeight: { value: 400 },
      });

      state.locked = true;

      // Scroll right (positive incrX: lastX - clientX > 0)
      handleTouchMove(40, 200, state, elements); // incrX = 50 - 40 = 10 (right)
      expect(scrollBySpy).toHaveBeenCalledWith(10, 0);
      expect(scrollArea.scrollLeft).toBe(400); // unchanged

      scrollBySpy.mockRestore();
    });

    it('should handle horizontal scrolling when scrollArea is present', () => {
      const scrollArea = document.createElement('div');
      Object.defineProperties(scrollArea, {
        scrollLeft: { value: 50, writable: true },
        scrollWidth: { value: 800 },
        clientWidth: { value: 400 },
      });
      elements.scrollArea = scrollArea;

      const result = handleTouchMove(30, 200, state, elements);

      expect(result).toBe(true);
      expect(scrollArea.scrollLeft).toBe(70); // 50 + 20
    });
  });

  describe('handleTouchEnd', () => {
    let state: TouchScrollState;
    let elements: TouchScrollElements;

    beforeEach(() => {
      state = createTouchScrollState();
      state.startY = 200;
      state.lastY = 180;
      state.lastTime = performance.now();

      const fauxScrollbar = document.createElement('div');
      Object.defineProperties(fauxScrollbar, {
        scrollTop: { value: 120, writable: true },
        scrollHeight: { value: 1000 },
        clientHeight: { value: 400 },
      });
      elements = { fauxScrollbar, scrollArea: null };
    });

    afterEach(() => {
      cancelMomentum(state);
    });

    it('should reset touch state', () => {
      state.velocityY = 0; // Below threshold, won't start momentum

      handleTouchEnd(state, elements);

      expect(state.startY).toBeNull();
      expect(state.startX).toBeNull();
      expect(state.lastY).toBeNull();
      expect(state.lastX).toBeNull();
    });

    it('should start momentum animation when velocity is significant', () => {
      const rafSpy = vi.spyOn(globalThis, 'requestAnimationFrame').mockReturnValue(999);
      state.velocityY = 0.5; // Above threshold

      handleTouchEnd(state, elements);

      expect(rafSpy).toHaveBeenCalled();
      expect(state.momentumRaf).toBe(999);
      rafSpy.mockRestore();
    });

    it('should not start momentum when velocity is below threshold', () => {
      const rafSpy = vi.spyOn(globalThis, 'requestAnimationFrame');
      state.velocityY = 0.05; // Below threshold

      handleTouchEnd(state, elements);

      expect(rafSpy).not.toHaveBeenCalled();
      rafSpy.mockRestore();
    });

    it('should zero velocity when finger was stationary before release', () => {
      const rafSpy = vi.spyOn(globalThis, 'requestAnimationFrame');
      state.velocityY = 0.5; // High velocity from earlier movement

      // Simulate 100ms hold: last move was 100ms ago
      state.lastTime = performance.now() - 100;

      handleTouchEnd(state, elements);

      // Should not start momentum because velocity was zeroed
      expect(rafSpy).not.toHaveBeenCalled();
      rafSpy.mockRestore();
    });

    it('should preserve velocity when finger was still moving at release', () => {
      const rafSpy = vi.spyOn(globalThis, 'requestAnimationFrame').mockReturnValue(999);
      state.velocityY = 0.5;

      // Last move was just 10ms ago (still actively moving)
      state.lastTime = performance.now() - 10;

      handleTouchEnd(state, elements);

      expect(rafSpy).toHaveBeenCalled();
      expect(state.momentumRaf).toBe(999);
      rafSpy.mockRestore();
    });
  });

  describe('setupTouchScrollListeners', () => {
    let gridContentEl: HTMLElement;
    let state: TouchScrollState;
    let elements: TouchScrollElements;
    let controller: AbortController;

    beforeEach(() => {
      gridContentEl = document.createElement('div');
      // Mock setPointerCapture/releasePointerCapture
      gridContentEl.setPointerCapture = vi.fn();
      gridContentEl.releasePointerCapture = vi.fn();
      state = createTouchScrollState();
      const fauxScrollbar = document.createElement('div');
      Object.defineProperties(fauxScrollbar, {
        scrollTop: { value: 0, writable: true },
        scrollHeight: { value: 1000 },
        clientHeight: { value: 400 },
      });
      elements = { fauxScrollbar, scrollArea: null };
      controller = new AbortController();
    });

    afterEach(() => {
      controller.abort();
    });

    it('should add pointer event listeners', () => {
      const addSpy = vi.spyOn(gridContentEl, 'addEventListener');

      setupTouchScrollListeners(gridContentEl, state, elements, controller.signal);

      expect(addSpy).toHaveBeenCalledWith(
        'pointerdown',
        expect.any(Function),
        expect.objectContaining({ passive: true }),
      );
      expect(addSpy).toHaveBeenCalledWith(
        'pointermove',
        expect.any(Function),
        expect.objectContaining({ passive: false }),
      );
      expect(addSpy).toHaveBeenCalledWith(
        'pointerup',
        expect.any(Function),
        expect.objectContaining({ passive: true }),
      );
      expect(addSpy).toHaveBeenCalledWith(
        'pointercancel',
        expect.any(Function),
        expect.objectContaining({ passive: true }),
      );
      expect(addSpy).toHaveBeenCalledWith(
        'lostpointercapture',
        expect.any(Function),
        expect.objectContaining({ passive: true }),
      );
    });

    it('should set pointer capture on touch pointerdown', () => {
      setupTouchScrollListeners(gridContentEl, state, elements, controller.signal);

      gridContentEl.dispatchEvent(
        createPointerEvent('pointerdown', { clientX: 50, clientY: 200, pointerId: 1, pointerType: 'touch' }),
      );

      expect(state.activePointerId).toBe(1);
      expect(state.startY).toBe(200);
      expect(gridContentEl.setPointerCapture).toHaveBeenCalledWith(1);
    });

    it('should ignore mouse pointerdown events', () => {
      setupTouchScrollListeners(gridContentEl, state, elements, controller.signal);

      gridContentEl.dispatchEvent(
        createPointerEvent('pointerdown', { clientX: 50, clientY: 200, pointerId: 1, pointerType: 'mouse' }),
      );

      expect(state.activePointerId).toBeNull();
      expect(state.startY).toBeNull();
    });

    it('should ignore second touch while first is active', () => {
      setupTouchScrollListeners(gridContentEl, state, elements, controller.signal);

      gridContentEl.dispatchEvent(
        createPointerEvent('pointerdown', { clientX: 50, clientY: 200, pointerId: 1, pointerType: 'touch' }),
      );
      gridContentEl.dispatchEvent(
        createPointerEvent('pointerdown', { clientX: 100, clientY: 300, pointerId: 2, pointerType: 'touch' }),
      );

      expect(state.activePointerId).toBe(1);
      expect(state.startY).toBe(200);
    });

    it('should remove listeners when signal is aborted', () => {
      setupTouchScrollListeners(gridContentEl, state, elements, controller.signal);

      // Dispatch pointerdown and verify it updates state
      gridContentEl.dispatchEvent(
        createPointerEvent('pointerdown', { clientX: 50, clientY: 200, pointerId: 1, pointerType: 'touch' }),
      );
      expect(state.startY).toBe(200);

      // Abort and reset state
      controller.abort();
      state.startY = null;
      state.activePointerId = null;

      // Dispatch again - should not update state
      gridContentEl.dispatchEvent(
        createPointerEvent('pointerdown', { clientX: 50, clientY: 300, pointerId: 2, pointerType: 'touch' }),
      );
      expect(state.startY).toBeNull();
    });

    it('should clean up state on pointercancel', () => {
      setupTouchScrollListeners(gridContentEl, state, elements, controller.signal);

      gridContentEl.dispatchEvent(
        createPointerEvent('pointerdown', { clientX: 50, clientY: 200, pointerId: 1, pointerType: 'touch' }),
      );
      expect(state.activePointerId).toBe(1);

      gridContentEl.dispatchEvent(createPointerEvent('pointercancel', { pointerId: 1, pointerType: 'touch' }));
      expect(state.activePointerId).toBeNull();
      expect(state.locked).toBe(false);
    });

    it('should clean up state on lostpointercapture', () => {
      setupTouchScrollListeners(gridContentEl, state, elements, controller.signal);

      gridContentEl.dispatchEvent(
        createPointerEvent('pointerdown', { clientX: 50, clientY: 200, pointerId: 1, pointerType: 'touch' }),
      );
      expect(state.activePointerId).toBe(1);

      gridContentEl.dispatchEvent(createPointerEvent('lostpointercapture', { pointerId: 1, pointerType: 'touch' }));
      expect(state.activePointerId).toBeNull();
      expect(state.locked).toBe(false);
    });
  });
});

/**
 * Helper to create pointer events for testing.
 */
function createPointerEvent(
  type: string,
  opts: { clientX?: number; clientY?: number; pointerId: number; pointerType: string },
): PointerEvent {
  return new PointerEvent(type, {
    clientX: opts.clientX ?? 0,
    clientY: opts.clientY ?? 0,
    pointerId: opts.pointerId,
    pointerType: opts.pointerType,
    bubbles: true,
    cancelable: true,
  });
}
