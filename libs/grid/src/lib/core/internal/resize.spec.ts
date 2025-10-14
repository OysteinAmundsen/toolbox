import { describe, expect, it, vi } from 'vitest';
import { createResizeController } from './resize';

function mockMouseEvent(type: string, props: Partial<MouseEvent> = {}) {
  const e = new MouseEvent(type, { bubbles: true, cancelable: true, clientX: props.clientX || 0 });
  return e;
}

describe('resize controller', () => {
  it('updates column width & dispatches events', async () => {
    const grid: any = {
      _columns: [{ field: 'a', width: 100 }],
      get visibleColumns() {
        return this._columns.filter((c: any) => !c.hidden);
      },
      updateTemplate: vi.fn(),
      dispatchEvent: vi.fn(),
    };
    const controller = createResizeController(grid);
    const cell = document.createElement('div');
    Object.defineProperty(cell, 'getBoundingClientRect', {
      value: () => ({ width: 100, height: 20, left: 0, top: 0, right: 100, bottom: 20 }),
    });
    controller.start(mockMouseEvent('mousedown', { clientX: 0 }), 0, cell);
    window.dispatchEvent(mockMouseEvent('mousemove', { clientX: 30 }));
    window.dispatchEvent(mockMouseEvent('mouseup', { clientX: 30 }));
    expect(grid._columns[0].width).toBe(130);
    expect(grid._columns[0].__userResized).toBe(true);
    expect(grid.dispatchEvent).toHaveBeenCalled();
  });

  it('sets isResizing during drag and briefly after mouseup', async () => {
    const grid: any = {
      _columns: [{ field: 'a', width: 100 }],
      get visibleColumns() {
        return this._columns.filter((c: any) => !c.hidden);
      },
      updateTemplate: vi.fn(),
      dispatchEvent: vi.fn(),
    };
    const controller = createResizeController(grid);
    const cell = document.createElement('div');
    Object.defineProperty(cell, 'getBoundingClientRect', {
      value: () => ({ width: 100, height: 20, left: 0, top: 0, right: 100, bottom: 20 }),
    });

    // Not resizing initially
    expect(controller.isResizing).toBe(false);

    // Start resize
    controller.start(mockMouseEvent('mousedown', { clientX: 0 }), 0, cell);
    expect(controller.isResizing).toBe(true);

    // During drag
    window.dispatchEvent(mockMouseEvent('mousemove', { clientX: 30 }));
    expect(controller.isResizing).toBe(true);

    // After mouseup, still true briefly to suppress click
    window.dispatchEvent(mockMouseEvent('mouseup', { clientX: 30 }));
    expect(controller.isResizing).toBe(true);

    // After RAF, should be false
    await new Promise((r) => requestAnimationFrame(r));
    expect(controller.isResizing).toBe(false);
  });
});
