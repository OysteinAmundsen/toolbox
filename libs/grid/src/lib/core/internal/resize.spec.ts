import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { createResizeController } from './resize';

/**
 * Build a PointerEvent. happy-dom implements `PointerEvent` but not the pointer
 * capture APIs, so those are stubbed on the handle by {@link makeHandle}.
 */
function mockPointerEvent(type: string, props: Partial<PointerEvent> = {}) {
  return new PointerEvent(type, {
    bubbles: true,
    cancelable: true,
    clientX: props.clientX ?? 0,
    pointerId: props.pointerId ?? 1,
    pointerType: props.pointerType ?? 'mouse',
  });
}

/**
 * The resize handle doubles as the pointer-capture target so the drag stays
 * bound to it for the whole gesture. Stubs the capture API happy-dom lacks.
 */
function makeHandle(): HTMLElement {
  const handle = document.createElement('div');
  let captured = false;
  handle.setPointerCapture = () => {
    captured = true;
  };
  handle.hasPointerCapture = () => captured;
  handle.releasePointerCapture = () => {
    captured = false;
  };
  document.body.appendChild(handle);
  return handle;
}

function makeCell(width: number): HTMLElement {
  const cell = document.createElement('div');
  Object.defineProperty(cell, 'getBoundingClientRect', {
    value: () => ({ width, height: 20, left: 0, top: 0, right: width, bottom: 20 }),
  });
  return cell;
}

/**
 * A real element, because the width popover mounts inside the grid host to
 * inherit the theme's custom properties.
 */
function makeGrid(columns: unknown[]) {
  const el = document.createElement('div') as any;
  el._columns = columns;
  Object.defineProperty(el, '_visibleColumns', {
    get: () => el._columns.filter((c: any) => !c.hidden),
  });
  el.updateTemplate = vi.fn();
  el.dispatchEvent = vi.fn();
  el.requestStateChange = vi.fn();
  document.body.appendChild(el);
  return el;
}

afterEach(() => document.body.replaceChildren());

describe('resize controller', () => {
  it('updates column width & dispatches events', async () => {
    const grid = makeGrid([{ field: 'a', width: 100 }]);
    const controller = createResizeController(grid);
    const cell = makeCell(100);
    const handle = makeHandle();

    controller.start(mockPointerEvent('pointerdown', { clientX: 0 }), 0, cell, handle);
    handle.dispatchEvent(mockPointerEvent('pointermove', { clientX: 30 }));
    handle.dispatchEvent(mockPointerEvent('pointerup', { clientX: 30 }));

    expect(grid._columns[0].width).toBe(130);
    expect(grid._columns[0].__userResized).toBe(true);
    expect(grid.dispatchEvent).toHaveBeenCalled();
  });

  it('sets isResizing during drag and briefly after pointerup', async () => {
    const grid = makeGrid([{ field: 'a', width: 100 }]);
    const controller = createResizeController(grid);
    const cell = makeCell(100);
    const handle = makeHandle();

    expect(controller.isResizing).toBe(false);

    controller.start(mockPointerEvent('pointerdown', { clientX: 0 }), 0, cell, handle);
    expect(controller.isResizing).toBe(true);

    handle.dispatchEvent(mockPointerEvent('pointermove', { clientX: 30 }));
    expect(controller.isResizing).toBe(true);

    // Still true briefly after release, to suppress the click that follows.
    handle.dispatchEvent(mockPointerEvent('pointerup', { clientX: 30 }));
    expect(controller.isResizing).toBe(true);

    await new Promise((r) => requestAnimationFrame(r));
    expect(controller.isResizing).toBe(false);
  });

  it('respects column minWidth during drag resize', () => {
    const grid = makeGrid([{ field: 'a', width: 150, minWidth: 100 }]);
    const controller = createResizeController(grid);
    const cell = makeCell(150);
    const handle = makeHandle();

    controller.start(mockPointerEvent('pointerdown', { clientX: 0 }), 0, cell, handle);
    handle.dispatchEvent(mockPointerEvent('pointermove', { clientX: -80 }));
    handle.dispatchEvent(mockPointerEvent('pointerup', { clientX: -80 }));

    expect(grid._columns[0].width).toBe(100);
  });

  it('falls back to 40px minimum for non-positive minWidth values', () => {
    const grid = makeGrid([{ field: 'a', width: 80, minWidth: 0 }]);
    const controller = createResizeController(grid);
    const cell = makeCell(80);
    const handle = makeHandle();

    controller.start(mockPointerEvent('pointerdown', { clientX: 0 }), 0, cell, handle);
    handle.dispatchEvent(mockPointerEvent('pointermove', { clientX: -70 }));
    handle.dispatchEvent(mockPointerEvent('pointerup', { clientX: -70 }));

    expect(grid._columns[0].width).toBe(40);
  });

  it('restores document chrome when the drag is cancelled', () => {
    const grid = makeGrid([{ field: 'a', width: 100 }]);
    const controller = createResizeController(grid);
    const cell = makeCell(100);
    const handle = makeHandle();

    controller.start(mockPointerEvent('pointerdown', { clientX: 0 }), 0, cell, handle);
    handle.dispatchEvent(mockPointerEvent('pointermove', { clientX: 30 }));
    handle.dispatchEvent(mockPointerEvent('pointercancel', { clientX: 30 }));

    expect(document.body.style.userSelect).toBe('');
    expect(document.documentElement.style.cursor).toBe('');
  });

  it('reverts the column width when the drag is cancelled', () => {
    const grid = makeGrid([{ field: 'a', width: 100 }]);
    const controller = createResizeController(grid);
    const cell = makeCell(100);
    const handle = makeHandle();

    controller.start(mockPointerEvent('pointerdown', { clientX: 0 }), 0, cell, handle);
    handle.dispatchEvent(mockPointerEvent('pointermove', { clientX: 30 }));
    expect(grid._columns[0].width).toBe(130);

    // Escape / pointercancel means "abort", so the half-finished drag must not
    // be committed — the column goes back to the width it had at pointerdown.
    handle.dispatchEvent(mockPointerEvent('pointercancel', { clientX: 30 }));

    expect(grid._columns[0].width).toBe(100);
    expect(grid.requestStateChange).not.toHaveBeenCalled();
  });

  it('reverts the column width when the drag is cancelled with Escape', () => {
    const grid = makeGrid([{ field: 'a', width: 100 }]);
    const controller = createResizeController(grid);
    const cell = makeCell(100);
    const handle = makeHandle();

    controller.start(mockPointerEvent('pointerdown', { clientX: 0 }), 0, cell, handle);
    handle.dispatchEvent(mockPointerEvent('pointermove', { clientX: 40 }));
    document.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true }));

    expect(grid._columns[0].width).toBe(100);
    expect(grid.requestStateChange).not.toHaveBeenCalled();
  });

  it('commits and fires requestStateChange when the drag ends normally', () => {
    const grid = makeGrid([{ field: 'a', width: 100 }]);
    const controller = createResizeController(grid);
    const cell = makeCell(100);
    const handle = makeHandle();

    controller.start(mockPointerEvent('pointerdown', { clientX: 0 }), 0, cell, handle);
    handle.dispatchEvent(mockPointerEvent('pointermove', { clientX: 30 }));
    handle.dispatchEvent(mockPointerEvent('pointerup', { clientX: 30 }));

    expect(grid._columns[0].width).toBe(130);
    expect(grid.requestStateChange).toHaveBeenCalled();
  });

  it('dispose() tears down an in-flight drag', () => {
    const grid = makeGrid([{ field: 'a', width: 100 }]);
    const controller = createResizeController(grid);
    const cell = makeCell(100);
    const handle = makeHandle();

    controller.start(mockPointerEvent('pointerdown', { clientX: 0 }), 0, cell, handle);
    handle.dispatchEvent(mockPointerEvent('pointermove', { clientX: 30 }));
    controller.dispose();

    // Listeners are gone, so a later move must not keep resizing the column.
    handle.dispatchEvent(mockPointerEvent('pointermove', { clientX: 80 }));
    expect(grid._columns[0].width).not.toBe(180);
  });

  it('accepts a legacy MouseEvent for backwards compatibility', () => {
    const grid = makeGrid([{ field: 'a', width: 100 }]);
    const controller = createResizeController(grid);
    const cell = makeCell(100);
    const handle = makeHandle();

    // Pre-v3.5.0 callers passed the `mousedown` event straight through.
    expect(() =>
      controller.start(new MouseEvent('mousedown', { clientX: 0, bubbles: true }), 0, cell, handle),
    ).not.toThrow();
  });

  it('tracks a touch drag through the capture target', () => {
    const grid = makeGrid([{ field: 'a', width: 100 }]);
    const controller = createResizeController(grid);
    const cell = makeCell(100);
    const handle = makeHandle();

    controller.start(mockPointerEvent('pointerdown', { clientX: 0, pointerType: 'touch' }), 0, cell, handle);
    handle.dispatchEvent(mockPointerEvent('pointermove', { clientX: 25, pointerType: 'touch' }));
    handle.dispatchEvent(mockPointerEvent('pointerup', { clientX: 25, pointerType: 'touch' }));

    expect(grid._columns[0].width).toBe(125);
  });

  it('resetColumn restores original configured width', () => {
    const grid: any = {
      _columns: [{ field: 'a', width: 150, __originalWidth: 100, __userResized: true, __renderedWidth: 150 }],
      get _visibleColumns() {
        return this._columns.filter((c: any) => !c.hidden);
      },
      updateTemplate: vi.fn(),
      dispatchEvent: vi.fn(),
      requestStateChange: vi.fn(),
    };
    const controller = createResizeController(grid);

    controller.resetColumn(0);

    expect(grid._columns[0].width).toBe(100);
    expect(grid._columns[0].__userResized).toBe(false);
    expect(grid._columns[0].__renderedWidth).toBeUndefined();
    expect(grid.updateTemplate).toHaveBeenCalled();
    expect(grid.dispatchEvent).toHaveBeenCalledWith(
      expect.objectContaining({
        type: 'column-resize-reset',
        detail: { field: 'a', width: 100 },
      }),
    );
    expect(grid.requestStateChange).toHaveBeenCalled();
  });

  it('resetColumn clears width when no original was configured', () => {
    const grid: any = {
      _columns: [{ field: 'a', width: 150, __userResized: true, __renderedWidth: 150 }],
      get _visibleColumns() {
        return this._columns.filter((c: any) => !c.hidden);
      },
      updateTemplate: vi.fn(),
      dispatchEvent: vi.fn(),
      requestStateChange: vi.fn(),
    };
    const controller = createResizeController(grid);

    controller.resetColumn(0);

    expect(grid._columns[0].width).toBeUndefined();
    expect(grid._columns[0].__userResized).toBe(false);
    expect(grid._columns[0].__renderedWidth).toBeUndefined();
    expect(grid.updateTemplate).toHaveBeenCalled();
  });

  /**
   * WCAG 2.2 SC 2.5.7 "Dragging Movements" — every drag must have a
   * single-pointer alternative that is not itself a drag. A keyboard equivalent
   * would *not* satisfy the criterion; the alternative has to be clickable.
   */
  describe('non-drag width control (SC 2.5.7)', () => {
    /** Mirrors `DOUBLE_CLICK_WINDOW_MS` in resize.ts. */
    const TAP_DELAY_MS = 300;

    // Only the timer the tap defers on — faking rAF would strand `commitWidth`.
    beforeEach(() => vi.useFakeTimers({ toFake: ['setTimeout', 'clearTimeout'] }));
    afterEach(() => vi.useRealTimers());

    const popover = () => document.querySelector<HTMLElement>('.tbw-size-popover');
    const buttonLabelled = (label: string) =>
      popover()?.querySelector<HTMLButtonElement>(`button[aria-label="${label}"]`);
    const widthInput = () => popover()?.querySelector<HTMLInputElement>('input');

    /** Press and release the handle without moving — a tap, not a drag. */
    function press(controller: ReturnType<typeof createResizeController>, cell: HTMLElement, handle: HTMLElement) {
      controller.start(mockPointerEvent('pointerdown', { clientX: 10 }), 0, cell, handle);
      handle.dispatchEvent(mockPointerEvent('pointerup', { clientX: 10 }));
    }

    /** A tap, then the wait that lets the popover through. */
    function tap(controller: ReturnType<typeof createResizeController>, cell: HTMLElement, handle: HTMLElement) {
      press(controller, cell, handle);
      vi.advanceTimersByTime(TAP_DELAY_MS);
    }

    it('setColumnWidth commits without a gesture and clamps to minWidth', () => {
      const grid = makeGrid([{ field: 'a', width: 150, minWidth: 100 }]);
      const controller = createResizeController(grid);

      controller.setColumnWidth(0, 200);
      expect(grid._columns[0].width).toBe(200);
      expect(grid._columns[0].__userResized).toBe(true);
      expect(grid.dispatchEvent).toHaveBeenCalledWith(
        expect.objectContaining({ type: 'column-resize', detail: { field: 'a', width: 200 } }),
      );
      expect(grid.requestStateChange).toHaveBeenCalled();

      controller.setColumnWidth(0, 10);
      expect(grid._columns[0].width).toBe(100);

      controller.dispose();
    });

    it('getColumnWidth prefers the rendered width', () => {
      const grid = makeGrid([{ field: 'a', width: 150, __renderedWidth: 175 }]);
      const controller = createResizeController(grid);

      expect(controller.getColumnWidth(0)).toBe(175);

      controller.dispose();
    });

    it('tapping the handle opens a click-only width popover', () => {
      const grid = makeGrid([{ field: 'a', header: 'Alpha', width: 100 }]);
      const controller = createResizeController(grid);
      const cell = makeCell(100);
      const handle = makeHandle();

      expect(popover()).toBeNull();
      tap(controller, cell, handle);

      const el = popover();
      expect(el).toBeTruthy();
      expect(el!.hidden).toBe(false);
      expect(el!.getAttribute('aria-label')).toBe('Width of column Alpha');
      // The width did not change — a tap commits nothing.
      expect(grid._columns[0].width).toBe(100);

      controller.dispose();
    });

    it('dragging the handle does not open the popover', () => {
      const grid = makeGrid([{ field: 'a', width: 100 }]);
      const controller = createResizeController(grid);
      const cell = makeCell(100);
      const handle = makeHandle();

      controller.start(mockPointerEvent('pointerdown', { clientX: 0 }), 0, cell, handle);
      handle.dispatchEvent(mockPointerEvent('pointermove', { clientX: 30 }));
      handle.dispatchEvent(mockPointerEvent('pointerup', { clientX: 30 }));
      vi.advanceTimersByTime(TAP_DELAY_MS);

      expect(popover()).toBeNull();
      expect(grid._columns[0].width).toBe(130);

      controller.dispose();
    });

    it('holds the popover back until the double-click window has passed', () => {
      const grid = makeGrid([{ field: 'a', width: 100 }]);
      const controller = createResizeController(grid);
      const cell = makeCell(100);
      const handle = makeHandle();

      press(controller, cell, handle);
      // A reset may still arrive as the second half of a double-click.
      expect(popover()).toBeNull();

      vi.advanceTimersByTime(TAP_DELAY_MS);
      expect(popover()).toBeTruthy();

      controller.dispose();
    });

    it('a double-click reset cancels the pending popover instead of flashing it', () => {
      const grid = makeGrid([{ field: 'a', width: 100, __originalWidth: 100 }]);
      const controller = createResizeController(grid);
      const cell = makeCell(100);
      const handle = makeHandle();

      // What the handle's own `dblclick` listener does: two taps, then a reset.
      press(controller, cell, handle);
      press(controller, cell, handle);
      controller.resetColumn(0);

      vi.advanceTimersByTime(TAP_DELAY_MS * 2);
      expect(popover()).toBeNull();

      controller.dispose();
    });

    it('step buttons and the numeric input resize the column with plain clicks', () => {
      const grid = makeGrid([{ field: 'a', width: 100 }]);
      const controller = createResizeController(grid);
      const cell = makeCell(100);
      const handle = makeHandle();

      tap(controller, cell, handle);

      buttonLabelled('Wider')!.click();
      expect(grid._columns[0].width).toBe(116);

      buttonLabelled('Narrower')!.click();
      expect(grid._columns[0].width).toBe(100);

      const input = widthInput()!;
      expect(input.value).toBe('100');
      input.value = '240';
      input.dispatchEvent(new Event('change', { bubbles: true }));
      expect(grid._columns[0].width).toBe(240);
      expect(input.value).toBe('240');

      controller.dispose();
    });

    it('reset restores the configured width from the popover', () => {
      const grid = makeGrid([{ field: 'a', width: 100, __originalWidth: 100 }]);
      const controller = createResizeController(grid);
      const cell = makeCell(100);
      const handle = makeHandle();

      tap(controller, cell, handle);
      buttonLabelled('Wider')!.click();
      expect(grid._columns[0].width).toBe(116);

      buttonLabelled('Reset size')!.click();
      expect(grid._columns[0].width).toBe(100);
      expect(grid._columns[0].__userResized).toBe(false);

      controller.dispose();
    });

    it('Escape closes the popover and dispose() removes it', () => {
      const grid = makeGrid([{ field: 'a', width: 100 }]);
      const controller = createResizeController(grid);
      const cell = makeCell(100);
      const handle = makeHandle();

      tap(controller, cell, handle);
      expect(popover()!.hidden).toBe(false);

      document.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true }));
      expect(popover()!.hidden).toBe(true);

      controller.dispose();
      expect(popover()).toBeNull();
    });

    it('mounts inside the grid host so theme custom properties cascade in', () => {
      const grid = makeGrid([{ field: 'a', width: 100 }]);
      const controller = createResizeController(grid);
      const cell = makeCell(100);
      const handle = makeHandle();

      tap(controller, cell, handle);
      expect(popover()!.parentElement).toBe(grid);

      controller.dispose();
    });

    it('keeps a stable position and marks the handle it belongs to', () => {
      const grid = makeGrid([{ field: 'a', width: 100 }]);
      const controller = createResizeController(grid);
      const cell = makeCell(100);
      const handle = makeHandle();

      tap(controller, cell, handle);
      expect(handle.hasAttribute('data-tbw-size-open')).toBe(true);

      // Repeated clicks must not walk the button out from under the pointer.
      const { left, top } = popover()!.style;
      buttonLabelled('Wider')!.click();
      buttonLabelled('Wider')!.click();
      expect(grid._columns[0].width).toBe(132);
      expect(popover()!.style.left).toBe(left);
      expect(popover()!.style.top).toBe(top);

      document.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true }));
      expect(handle.hasAttribute('data-tbw-size-open')).toBe(false);

      controller.dispose();
    });

    it('closes when focus tabs out, since there is no trigger to tab back to', () => {
      const grid = makeGrid([{ field: 'a', width: 100 }]);
      const controller = createResizeController(grid);
      const cell = makeCell(100);
      const handle = makeHandle();
      const outside = document.createElement('button');
      document.body.appendChild(outside);

      tap(controller, cell, handle);
      const el = popover()!;
      expect(el.hidden).toBe(false);

      // Focus staying inside must not dismiss it.
      el.dispatchEvent(new FocusEvent('focusout', { relatedTarget: el.querySelector('button') }));
      expect(el.hidden).toBe(false);

      el.dispatchEvent(new FocusEvent('focusout', { relatedTarget: outside }));
      expect(el.hidden).toBe(true);

      controller.dispose();
    });
  });
});
