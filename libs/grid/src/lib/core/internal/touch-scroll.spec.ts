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
      expect(state.scrollTop).toBeNull();
      expect(state.scrollLeft).toBeNull();
      expect(state.lastY).toBeNull();
      expect(state.lastX).toBeNull();
      expect(state.lastTime).toBeNull();
      expect(state.velocityY).toBe(0);
      expect(state.velocityX).toBe(0);
      expect(state.momentumRaf).toBe(0);
    });
  });

  describe('resetTouchState', () => {
    it('should reset position and time values to null', () => {
      const state = createTouchScrollState();
      state.startY = 100;
      state.startX = 50;
      state.scrollTop = 200;
      state.scrollLeft = 100;
      state.lastY = 90;
      state.lastX = 45;
      state.lastTime = 1000;

      resetTouchState(state);

      expect(state.startY).toBeNull();
      expect(state.startX).toBeNull();
      expect(state.scrollTop).toBeNull();
      expect(state.scrollLeft).toBeNull();
      expect(state.lastY).toBeNull();
      expect(state.lastX).toBeNull();
      expect(state.lastTime).toBeNull();
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
    let elements: TouchScrollElements;
    let fauxScrollbar: HTMLElement;

    beforeEach(() => {
      state = createTouchScrollState();
      fauxScrollbar = document.createElement('div');
      Object.defineProperty(fauxScrollbar, 'scrollTop', { value: 100, writable: true });
      elements = { fauxScrollbar, scrollArea: null };
    });

    it('should initialize touch state on single touch', () => {
      const event = createTouchEvent('touchstart', [{ clientX: 50, clientY: 200 }]);

      handleTouchStart(event, state, elements);

      expect(state.startY).toBe(200);
      expect(state.startX).toBe(50);
      expect(state.lastY).toBe(200);
      expect(state.lastX).toBe(50);
      expect(state.scrollTop).toBe(100);
      expect(state.velocityY).toBe(0);
      expect(state.velocityX).toBe(0);
    });

    it('should ignore multi-touch events', () => {
      const event = createTouchEvent('touchstart', [
        { clientX: 50, clientY: 200 },
        { clientX: 100, clientY: 300 },
      ]);

      handleTouchStart(event, state, elements);

      expect(state.startY).toBeNull();
      expect(state.startX).toBeNull();
    });

    it('should cancel ongoing momentum animation', () => {
      const cancelSpy = vi.spyOn(globalThis, 'cancelAnimationFrame');
      state.momentumRaf = 789;
      const event = createTouchEvent('touchstart', [{ clientX: 50, clientY: 200 }]);

      handleTouchStart(event, state, elements);

      expect(cancelSpy).toHaveBeenCalledWith(789);
      expect(state.momentumRaf).toBe(0);
      cancelSpy.mockRestore();
    });

    it('should capture scrollLeft from scrollArea when present', () => {
      const scrollArea = document.createElement('div');
      Object.defineProperty(scrollArea, 'scrollLeft', { value: 75, writable: true });
      elements.scrollArea = scrollArea;
      const event = createTouchEvent('touchstart', [{ clientX: 50, clientY: 200 }]);

      handleTouchStart(event, state, elements);

      expect(state.scrollLeft).toBe(75);
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
      state.scrollTop = 100;
      state.scrollLeft = 0;
      state.lastY = 200;
      state.lastX = 50;
      state.lastTime = performance.now() - 16; // 16ms ago
    });

    it('should return false when state is not initialized', () => {
      state.startY = null;
      const event = createTouchEvent('touchmove', [{ clientX: 50, clientY: 180 }]);

      const result = handleTouchMove(event, state, elements);

      expect(result).toBe(false);
    });

    it('should return false for multi-touch events', () => {
      const event = createTouchEvent('touchmove', [
        { clientX: 50, clientY: 180 },
        { clientX: 100, clientY: 280 },
      ]);

      const result = handleTouchMove(event, state, elements);

      expect(result).toBe(false);
    });

    it('should return true when scrolling vertically is possible', () => {
      const event = createTouchEvent('touchmove', [{ clientX: 50, clientY: 180 }]);

      const result = handleTouchMove(event, state, elements);

      expect(result).toBe(true);
    });

    it('should update velocity based on touch movement', () => {
      const event = createTouchEvent('touchmove', [{ clientX: 50, clientY: 180 }]);

      handleTouchMove(event, state, elements);

      // Velocity should be calculated (direction: positive = scrolling down)
      expect(state.velocityY).toBeGreaterThan(0);
      expect(state.lastY).toBe(180);
    });

    it('should apply vertical scroll delta', () => {
      const event = createTouchEvent('touchmove', [{ clientX: 50, clientY: 180 }]);

      handleTouchMove(event, state, elements);

      // scrollTop should increase (finger moved up = content scrolls down)
      // deltaY = startY - currentY = 200 - 180 = 20
      expect(fauxScrollbar.scrollTop).toBe(120); // 100 + 20
    });

    it('should handle horizontal scrolling when scrollArea is present', () => {
      const scrollArea = document.createElement('div');
      Object.defineProperties(scrollArea, {
        scrollLeft: { value: 50, writable: true },
        scrollWidth: { value: 800 },
        clientWidth: { value: 400 },
      });
      elements.scrollArea = scrollArea;
      state.scrollLeft = 50;

      const event = createTouchEvent('touchmove', [{ clientX: 30, clientY: 200 }]);

      const result = handleTouchMove(event, state, elements);

      expect(result).toBe(true);
      // deltaX = startX - currentX = 50 - 30 = 20
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
      state.scrollTop = 100;
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
      expect(state.scrollTop).toBeNull();
      expect(state.lastY).toBeNull();
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
  });

  describe('setupTouchScrollListeners', () => {
    let gridContentEl: HTMLElement;
    let state: TouchScrollState;
    let elements: TouchScrollElements;
    let controller: AbortController;

    beforeEach(() => {
      gridContentEl = document.createElement('div');
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

    it('should add touch event listeners', () => {
      const addSpy = vi.spyOn(gridContentEl, 'addEventListener');

      setupTouchScrollListeners(gridContentEl, state, elements, controller.signal);

      expect(addSpy).toHaveBeenCalledTimes(3);
      expect(addSpy).toHaveBeenCalledWith(
        'touchstart',
        expect.any(Function),
        expect.objectContaining({ passive: true }),
      );
      expect(addSpy).toHaveBeenCalledWith(
        'touchmove',
        expect.any(Function),
        expect.objectContaining({ passive: false }),
      );
      expect(addSpy).toHaveBeenCalledWith('touchend', expect.any(Function), expect.objectContaining({ passive: true }));
    });

    it('should remove listeners when signal is aborted', () => {
      setupTouchScrollListeners(gridContentEl, state, elements, controller.signal);

      // Dispatch touchstart and verify it updates state
      const startEvent = createTouchEvent('touchstart', [{ clientX: 50, clientY: 200 }]);
      gridContentEl.dispatchEvent(startEvent);
      expect(state.startY).toBe(200);

      // Abort and reset state
      controller.abort();
      state.startY = null;

      // Dispatch again - should not update state
      const startEvent2 = createTouchEvent('touchstart', [{ clientX: 50, clientY: 300 }]);
      gridContentEl.dispatchEvent(startEvent2);
      expect(state.startY).toBeNull();
    });
  });
});

/**
 * Helper to create touch events for testing.
 */
function createTouchEvent(type: string, touches: Array<{ clientX: number; clientY: number }>): TouchEvent {
  const touchList = touches.map(
    (t, i) =>
      ({
        identifier: i,
        target: document.body,
        clientX: t.clientX,
        clientY: t.clientY,
        pageX: t.clientX,
        pageY: t.clientY,
        screenX: t.clientX,
        screenY: t.clientY,
        radiusX: 0,
        radiusY: 0,
        rotationAngle: 0,
        force: 1,
      }) as Touch,
  );

  return new TouchEvent(type, {
    touches: touchList,
    targetTouches: touchList,
    changedTouches: touchList,
    bubbles: true,
    cancelable: true,
  });
}
