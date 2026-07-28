import { describe, expect, it, vi } from 'vitest';
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

function makeGrid(columns: unknown[]) {
  return {
    _columns: columns,
    get _visibleColumns() {
      return this._columns.filter((c: any) => !c.hidden);
    },
    updateTemplate: vi.fn(),
    dispatchEvent: vi.fn(),
    requestStateChange: vi.fn(),
  } as any;
}

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
});
