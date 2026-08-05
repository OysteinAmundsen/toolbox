import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { startPointerDrag, type PointerDragHandlers } from './pointer-drag';

// #region Test helpers

/**
 * Minimal PointerEvent factory compatible with happy-dom.
 * happy-dom may not support the full PointerEvent constructor, so we build
 * a synthetic object that satisfies the properties our code reads.
 */
function makePointerEvent(
  type: string,
  init: Partial<{
    pointerId: number;
    clientX: number;
    clientY: number;
    pointerType: string;
    isPrimary: boolean;
    buttons: number;
    key: string;
    bubbles: boolean;
    cancelable: boolean;
  }> = {},
): PointerEvent {
  // Prefer native PointerEvent if available
  if (typeof PointerEvent !== 'undefined') {
    try {
      return new PointerEvent(type, {
        pointerId: init.pointerId ?? 1,
        clientX: init.clientX ?? 0,
        clientY: init.clientY ?? 0,
        pointerType: init.pointerType ?? 'mouse',
        isPrimary: init.isPrimary ?? true,
        buttons: init.buttons ?? 1,
        bubbles: init.bubbles ?? true,
        cancelable: init.cancelable ?? true,
      });
    } catch {
      // Fall through to synthetic object
    }
  }
  return {
    type,
    pointerId: init.pointerId ?? 1,
    clientX: init.clientX ?? 0,
    clientY: init.clientY ?? 0,
    pointerType: init.pointerType ?? 'mouse',
    isPrimary: init.isPrimary ?? true,
    buttons: init.buttons ?? 1,
    bubbles: init.bubbles ?? true,
    cancelable: init.cancelable ?? true,
    preventDefault: vi.fn(),
    stopPropagation: vi.fn(),
  } as unknown as PointerEvent;
}

function makeKeyboardEvent(key: string): KeyboardEvent {
  try {
    return new KeyboardEvent('keydown', { key, bubbles: true, cancelable: true });
  } catch {
    return { type: 'keydown', key, bubbles: true, cancelable: true } as KeyboardEvent;
  }
}

/**
 * Create a minimal element with the pointer-capture API stubbed.
 * Returns the element and capture state helpers.
 */
function makeCaptureTarget() {
  const el = document.createElement('div');
  document.body.appendChild(el);
  const capturedIds = new Set<number>();

  // Stub setPointerCapture / releasePointerCapture / hasPointerCapture
  el.setPointerCapture = (id: number) => {
    capturedIds.add(id);
  };
  el.releasePointerCapture = (id: number) => {
    capturedIds.delete(id);
  };
  el.hasPointerCapture = (id: number) => capturedIds.has(id);

  return { el, capturedIds };
}

function fire(el: EventTarget, event: Event): void {
  el.dispatchEvent(event);
}

// #endregion

describe('startPointerDrag', () => {
  afterEach(() => {
    document.body.innerHTML = '';
    vi.restoreAllMocks();
  });

  // #region Immediate (no threshold / no long-press)

  describe('immediate promotion (no threshold, no long-press)', () => {
    it('calls onMove on the first pointermove after pointerdown', () => {
      const { el } = makeCaptureTarget();
      const onMove = vi.fn();
      const onEnd = vi.fn();
      const start = makePointerEvent('pointerdown', { clientX: 10, clientY: 10 });
      startPointerDrag(start, el, { onMove, onEnd });

      const move = makePointerEvent('pointermove', { clientX: 20, clientY: 10 });
      fire(el, move);

      expect(onMove).toHaveBeenCalledTimes(1);
      expect(onMove).toHaveBeenCalledWith(move);
    });

    it('calls onEnd on pointerup after promotion', () => {
      const { el } = makeCaptureTarget();
      const onEnd = vi.fn();
      const start = makePointerEvent('pointerdown', { clientX: 0, clientY: 0 });
      startPointerDrag(start, el, { onMove: vi.fn(), onEnd });

      fire(el, makePointerEvent('pointermove', { clientX: 5, clientY: 0 }));
      const up = makePointerEvent('pointerup', { clientX: 5, clientY: 0 });
      fire(el, up);

      expect(onEnd).toHaveBeenCalledWith(up);
    });

    it('calls onEnd (not onCancel) on pointerup before any move when promoted up front', () => {
      const { el } = makeCaptureTarget();
      const onEnd = vi.fn();
      const onCancel = vi.fn();
      const start = makePointerEvent('pointerdown', { clientX: 0, clientY: 0 });
      startPointerDrag(start, el, { onMove: vi.fn(), onEnd, onCancel });

      // No move — just up
      fire(el, makePointerEvent('pointerup', { clientX: 0, clientY: 0 }));

      // With threshold=0 longPressDelay=0, promoted=true immediately,
      // so pointerup should call onEnd, NOT onCancel.
      expect(onEnd).toHaveBeenCalledTimes(1);
      expect(onCancel).not.toHaveBeenCalled();
    });

    it('sets pointer capture on captureTarget', () => {
      const { el, capturedIds } = makeCaptureTarget();
      const start = makePointerEvent('pointerdown', { pointerId: 7 });
      startPointerDrag(start, el, { onMove: vi.fn(), onEnd: vi.fn() });

      expect(capturedIds.has(7)).toBe(true);
    });

    it('releases pointer capture after pointerup', () => {
      const { el, capturedIds } = makeCaptureTarget();
      const start = makePointerEvent('pointerdown', { pointerId: 3 });
      startPointerDrag(start, el, { onMove: vi.fn(), onEnd: vi.fn() });

      fire(el, makePointerEvent('pointermove', { pointerId: 3 }));
      fire(el, makePointerEvent('pointerup', { pointerId: 3 }));

      expect(capturedIds.has(3)).toBe(false);
    });
  });

  // #endregion

  // #region Threshold promotion

  describe('threshold promotion', () => {
    it('does NOT call onMove until movement >= threshold', () => {
      const { el } = makeCaptureTarget();
      const onMove = vi.fn();
      const start = makePointerEvent('pointerdown', { clientX: 0, clientY: 0 });
      startPointerDrag(start, el, { onMove, onEnd: vi.fn() }, { threshold: 10 });

      fire(el, makePointerEvent('pointermove', { clientX: 5, clientY: 0 }));
      expect(onMove).not.toHaveBeenCalled();

      fire(el, makePointerEvent('pointermove', { clientX: 15, clientY: 0 }));
      expect(onMove).toHaveBeenCalledTimes(1);
    });

    it('continues calling onMove after promotion without re-checking threshold', () => {
      const { el } = makeCaptureTarget();
      const onMove = vi.fn();
      const start = makePointerEvent('pointerdown', { clientX: 0, clientY: 0 });
      startPointerDrag(start, el, { onMove, onEnd: vi.fn() }, { threshold: 10 });

      // Promote
      fire(el, makePointerEvent('pointermove', { clientX: 15, clientY: 0 }));
      // Move back toward start — should still call onMove
      fire(el, makePointerEvent('pointermove', { clientX: 2, clientY: 0 }));

      expect(onMove).toHaveBeenCalledTimes(2);
    });
  });

  // #endregion

  // #region Long-press promotion

  describe('long-press promotion', () => {
    beforeEach(() => {
      vi.useFakeTimers();
    });
    afterEach(() => {
      vi.useRealTimers();
    });

    it('does NOT call onMove before the long-press duration elapses', () => {
      const { el } = makeCaptureTarget();
      const onMove = vi.fn();
      const start = makePointerEvent('pointerdown', { clientX: 0, clientY: 0 });
      startPointerDrag(start, el, { onMove, onEnd: vi.fn() }, { longPressDuration: 400 });

      fire(el, makePointerEvent('pointermove', { clientX: 2, clientY: 0 }));
      expect(onMove).not.toHaveBeenCalled();
    });

    it('calls onMove after long-press elapses and subsequent move', () => {
      const { el } = makeCaptureTarget();
      const onMove = vi.fn();
      const start = makePointerEvent('pointerdown', { clientX: 0, clientY: 0 });
      startPointerDrag(start, el, { onMove, onEnd: vi.fn() }, { longPressDuration: 400 });

      vi.advanceTimersByTime(400);

      // Move after promotion
      fire(el, makePointerEvent('pointermove', { clientX: 5, clientY: 0 }));
      expect(onMove).toHaveBeenCalledTimes(1);
    });

    it('cancels drag when movement exceeds longPressSlop before timer fires', () => {
      const { el } = makeCaptureTarget();
      const onMove = vi.fn();
      const onCancel = vi.fn();
      const start = makePointerEvent('pointerdown', { clientX: 0, clientY: 0 });
      startPointerDrag(start, el, { onMove, onEnd: vi.fn(), onCancel }, { longPressDuration: 400, longPressSlop: 8 });

      // Move more than slop (9 px)
      fire(el, makePointerEvent('pointermove', { clientX: 9, clientY: 0 }));

      expect(onMove).not.toHaveBeenCalled();
      expect(onCancel).toHaveBeenCalledTimes(1);
    });

    it('does NOT cancel drag when movement stays within slop', () => {
      const { el } = makeCaptureTarget();
      const onMove = vi.fn();
      const onCancel = vi.fn();
      const start = makePointerEvent('pointerdown', { clientX: 0, clientY: 0 });
      startPointerDrag(start, el, { onMove, onEnd: vi.fn(), onCancel }, { longPressDuration: 400, longPressSlop: 8 });

      // Move within slop (5 px)
      fire(el, makePointerEvent('pointermove', { clientX: 5, clientY: 0 }));

      expect(onCancel).not.toHaveBeenCalled();

      // Promote
      vi.advanceTimersByTime(400);
      fire(el, makePointerEvent('pointermove', { clientX: 7, clientY: 0 }));
      expect(onMove).toHaveBeenCalledTimes(1);
    });

    it('calls onCancel on pointerup before long-press timer fires', () => {
      const { el } = makeCaptureTarget();
      const onEnd = vi.fn();
      const onCancel = vi.fn();
      const start = makePointerEvent('pointerdown', { clientX: 0, clientY: 0 });
      startPointerDrag(start, el, { onMove: vi.fn(), onEnd, onCancel }, { longPressDuration: 400 });

      // Release before timer
      fire(el, makePointerEvent('pointerup', { clientX: 0, clientY: 0 }));

      expect(onEnd).not.toHaveBeenCalled();
      expect(onCancel).toHaveBeenCalledTimes(1);
    });
  });

  // #endregion

  // #region Cancellation

  describe('cancellation', () => {
    it('calls onCancel on pointercancel', () => {
      const { el } = makeCaptureTarget();
      const onCancel = vi.fn();
      const start = makePointerEvent('pointerdown');
      startPointerDrag(start, el, { onMove: vi.fn(), onEnd: vi.fn(), onCancel });

      fire(el, makePointerEvent('pointercancel'));

      expect(onCancel).toHaveBeenCalledTimes(1);
    });

    it('calls onCancel on lostpointercapture', () => {
      const { el } = makeCaptureTarget();
      const onCancel = vi.fn();
      const start = makePointerEvent('pointerdown', { pointerId: 1 });
      startPointerDrag(start, el, { onMove: vi.fn(), onEnd: vi.fn(), onCancel });

      fire(el, makePointerEvent('lostpointercapture', { pointerId: 1 }));

      expect(onCancel).toHaveBeenCalledTimes(1);
    });

    it('calls onCancel on Escape keydown', () => {
      const { el } = makeCaptureTarget();
      const onCancel = vi.fn();
      const start = makePointerEvent('pointerdown');
      startPointerDrag(start, el, { onMove: vi.fn(), onEnd: vi.fn(), onCancel });

      fire(document, makeKeyboardEvent('Escape'));

      expect(onCancel).toHaveBeenCalledTimes(1);
    });

    it('does NOT call onCancel on non-Escape keydown', () => {
      const { el } = makeCaptureTarget();
      const onCancel = vi.fn();
      const start = makePointerEvent('pointerdown');
      startPointerDrag(start, el, { onMove: vi.fn(), onEnd: vi.fn(), onCancel });

      fire(document, makeKeyboardEvent('Enter'));

      expect(onCancel).not.toHaveBeenCalled();
    });

    it('returned cancel() function cancels the drag', () => {
      const { el } = makeCaptureTarget();
      const onCancel = vi.fn();
      const start = makePointerEvent('pointerdown');
      const cancel = startPointerDrag(start, el, { onMove: vi.fn(), onEnd: vi.fn(), onCancel });

      cancel();

      expect(onCancel).toHaveBeenCalledTimes(1);
    });

    it('cancel() is idempotent — second call is a no-op', () => {
      const { el } = makeCaptureTarget();
      const onCancel = vi.fn();
      const start = makePointerEvent('pointerdown');
      const cancel = startPointerDrag(start, el, { onMove: vi.fn(), onEnd: vi.fn(), onCancel });

      cancel();
      cancel();

      expect(onCancel).toHaveBeenCalledTimes(1);
    });
  });

  // #endregion

  // #region No-leak teardown

  describe('no-leak teardown', () => {
    it('does not call any handler after cancel()', () => {
      const { el } = makeCaptureTarget();
      const onMove = vi.fn();
      const onEnd = vi.fn();
      const onCancel = vi.fn();
      const start = makePointerEvent('pointerdown');
      const cancel = startPointerDrag(start, el, { onMove, onEnd, onCancel });

      cancel();

      // These events should be ignored after cancel
      fire(el, makePointerEvent('pointermove', { clientX: 100 }));
      fire(el, makePointerEvent('pointerup'));

      expect(onMove).not.toHaveBeenCalled();
      expect(onEnd).not.toHaveBeenCalled();
      // onCancel was called once by cancel(), not again by the events
      expect(onCancel).toHaveBeenCalledTimes(1);
    });

    it('removes listeners after pointerup — subsequent events are ignored', () => {
      const { el } = makeCaptureTarget();
      const onMove = vi.fn();
      const start = makePointerEvent('pointerdown');
      startPointerDrag(start, el, { onMove, onEnd: vi.fn() });

      fire(el, makePointerEvent('pointermove', { clientX: 10 }));
      fire(el, makePointerEvent('pointerup'));
      // After completion, moves should not fire
      fire(el, makePointerEvent('pointermove', { clientX: 20 }));

      expect(onMove).toHaveBeenCalledTimes(1); // only the one before pointerup
    });

    it('does not call Escape handler after drag ends', () => {
      const { el } = makeCaptureTarget();
      const onCancel = vi.fn();
      const start = makePointerEvent('pointerdown');
      startPointerDrag(start, el, { onMove: vi.fn(), onEnd: vi.fn(), onCancel });

      fire(el, makePointerEvent('pointermove', { clientX: 10 }));
      fire(el, makePointerEvent('pointerup'));
      // After successful end, Escape should not call onCancel
      fire(document, makeKeyboardEvent('Escape'));

      expect(onCancel).not.toHaveBeenCalled();
    });
  });

  // #endregion

  // #region Re-entrancy guard

  describe('re-entrancy guard', () => {
    it('ignores a second startPointerDrag with same element + pointerId', () => {
      const { el } = makeCaptureTarget();
      const onMove1 = vi.fn();
      const onMove2 = vi.fn();

      const start = makePointerEvent('pointerdown', { pointerId: 1 });
      startPointerDrag(start, el, { onMove: onMove1, onEnd: vi.fn() });
      startPointerDrag(start, el, { onMove: onMove2, onEnd: vi.fn() });

      fire(el, makePointerEvent('pointermove', { pointerId: 1, clientX: 10 }));

      expect(onMove1).toHaveBeenCalledTimes(1);
      expect(onMove2).not.toHaveBeenCalled();
    });

    it('allows a new drag after the previous one ends', () => {
      const { el } = makeCaptureTarget();
      const onMove = vi.fn();

      const start = makePointerEvent('pointerdown', { pointerId: 1 });
      startPointerDrag(start, el, { onMove, onEnd: vi.fn() });
      fire(el, makePointerEvent('pointerup', { pointerId: 1 }));

      // Start another drag
      startPointerDrag(start, el, { onMove, onEnd: vi.fn() });
      fire(el, makePointerEvent('pointermove', { pointerId: 1, clientX: 5 }));

      expect(onMove).toHaveBeenCalledTimes(1);
    });
  });

  // #endregion

  // #region Handlers type check (static)

  it('accepts undefined onCancel gracefully', () => {
    const { el } = makeCaptureTarget();
    const handlers: PointerDragHandlers = { onMove: vi.fn(), onEnd: vi.fn() };
    const start = makePointerEvent('pointerdown');

    expect(() => {
      const cancel = startPointerDrag(start, el, handlers);
      cancel();
    }).not.toThrow();
  });

  // #endregion
});
