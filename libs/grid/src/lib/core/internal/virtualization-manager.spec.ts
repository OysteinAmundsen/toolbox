import { afterEach, describe, expect, it, vi } from 'vitest';
import type { InternalGrid } from '../types';
import { computeScrollMapping, getRowIndexAtOffset, toVirtualScrollTop } from './virtualization';
import { VirtualizationManager } from './virtualization-manager';

describe('VirtualizationManager scroll mapping after row count changes (#681)', () => {
  function createElements(scrollTop: number) {
    vi.spyOn(window, 'requestAnimationFrame').mockReturnValue(1);
    const body = document.createElement('div');
    const container = document.createElement('div');
    const spacer = document.createElement('div');
    Object.defineProperty(container, 'clientHeight', { value: 500 });
    container.scrollTop = scrollTop;
    return { body, container, spacer };
  }

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it.each([
    { oldCount: 1_000_000, newCount: 2_000_000, scrollTop: 14_000_000 },
    { oldCount: 2_000_000, newCount: 3_000_000, scrollTop: 14_000_000 },
    { oldCount: 2_000_000, newCount: 1_000_000, scrollTop: 14_000_000 },
    { oldCount: 2_000_000, newCount: 1_000_000, scrollTop: 33_000_000 },
  ])('renders the first fixed-height window with the new mapping: $oldCount -> $newCount', (test) => {
    const { body, container, spacer } = createElements(test.scrollTop);
    const render = vi.fn<(start: number, end: number, epoch?: number) => void>();
    const grid: Partial<InternalGrid> = {
      _bodyEl: body,
      _rows: new Array(test.newCount),
      _renderVisibleRows: render,
      _adjustPluginVirtualStart: () => undefined,
      _updateAriaCounts: vi.fn<InternalGrid['_updateAriaCounts']>(),
      _requestSchedulerPhase: vi.fn<InternalGrid['_requestSchedulerPhase']>(),
    };
    const manager = new VirtualizationManager(grid as InternalGrid, {
      container,
      viewportEl: container,
      totalHeightEl: spacer,
      scrollMapping: computeScrollMapping(test.oldCount * 28, 500),
    });

    manager.refreshVirtualWindow(true, true);

    const mapping = computeScrollMapping(test.newCount * 28, 500);
    const nativeScrollTop = Math.min(test.scrollTop, mapping.spacerHeight - 500);
    const index = Math.floor(toVirtualScrollTop(nativeScrollTop, mapping) / 28);
    const expectedStart = index - (index % 2);
    expect(manager.state.scrollMapping).toEqual(mapping);
    expect(render).toHaveBeenCalledOnce();
    expect(render.mock.calls[0][0]).toBe(expectedStart);
    expect(body.style.transform).toBe(
      `translateY(${-(toVirtualScrollTop(nativeScrollTop, mapping) - expectedStart * 28)}px)`,
    );
  });

  it.each([
    { oldCount: 1_000, newCount: 2_000 },
    { oldCount: 2_000, newCount: 3_000 },
    { oldCount: 2_000, newCount: 1_000 },
  ])('uses the rebuilt variable-height cache: $oldCount -> $newCount', (test) => {
    const { body, container, spacer } = createElements(14_000_000);
    const render = vi.fn<(start: number, end: number, epoch?: number) => void>();
    const grid: Partial<InternalGrid> = {
      _bodyEl: body,
      _rows: Array.from({ length: test.newCount }, (_, id) => ({ id })),
      _renderVisibleRows: render,
      _adjustPluginVirtualStart: () => undefined,
      _getPluginRowHeight: (_row: object, index: number) => (index % 2 === 0 ? 20_000 : 40_000),
      _updateAriaCounts: vi.fn<InternalGrid['_updateAriaCounts']>(),
      _requestSchedulerPhase: vi.fn<InternalGrid['_requestSchedulerPhase']>(),
    };
    const manager = new VirtualizationManager(grid as InternalGrid, {
      container,
      viewportEl: container,
      totalHeightEl: spacer,
      rowHeight: 30_000,
      variableHeights: true,
      scrollMapping: computeScrollMapping(test.oldCount * 30_000, 500),
    });

    manager.refreshVirtualWindow(true, true);

    const mapping = computeScrollMapping(test.newCount * 30_000, 500);
    const index = getRowIndexAtOffset(manager.state.positionCache!, toVirtualScrollTop(14_000_000, mapping));
    expect(manager.state.scrollMapping).toEqual(mapping);
    expect(render).toHaveBeenCalledOnce();
    expect(render.mock.calls[0][0]).toBe(index - (index % 2));
  });

  it.each([
    { scrollTop: 14_000_000, height: 8_000_000, start: 934, renders: 2 },
    { scrollTop: 14_000, height: 8_000_000, start: 0, renders: 1 },
    { scrollTop: 14_000_000, height: 15_000, start: 932, renders: 1 },
  ])('reconciles window and transform after row measurement: $scrollTop / $height', (test) => {
    const { body, container, spacer } = createElements(test.scrollTop);
    const render = vi.fn((_start: number, end: number) => {
      const row = document.createElement('div');
      row.className = 'data-grid-row';
      row.setAttribute('aria-rowindex', String(end + 1));
      Object.defineProperty(row, 'offsetHeight', { value: test.height });
      body.replaceChildren(row);
    });
    const grid: Partial<InternalGrid> = {
      _bodyEl: body,
      _rows: Array.from({ length: 2_000 }, (_, id) => ({ id })),
      _renderVisibleRows: render,
      _adjustPluginVirtualStart: () => undefined,
      _getPluginRowHeight: () => undefined,
      _updateAriaCounts: vi.fn<InternalGrid['_updateAriaCounts']>(),
      _requestSchedulerPhase: vi.fn<InternalGrid['_requestSchedulerPhase']>(),
    };
    const manager = new VirtualizationManager(grid as InternalGrid, {
      container,
      viewportEl: container,
      totalHeightEl: spacer,
      rowHeight: 15_000,
      variableHeights: true,
      scrollMapping: computeScrollMapping(30_000_000, 500),
    });

    manager.refreshVirtualWindow(true, true);

    const mappedTop = toVirtualScrollTop(test.scrollTop, manager.state.scrollMapping);
    const rowOffset = manager.state.positionCache![test.start].offset;
    expect(manager.state.start).toBe(test.start);
    expect(render).toHaveBeenCalledTimes(test.renders);
    expect(render.mock.lastCall?.[0]).toBe(test.start);
    expect(Number.parseFloat(body.style.transform.slice('translateY('.length))).toBeCloseTo(-(mappedTop - rowOffset));
  });
});
