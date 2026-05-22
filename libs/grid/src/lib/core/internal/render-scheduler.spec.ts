import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { InternalGrid } from '../types';
import { RenderPhase, RenderScheduler } from './render-scheduler';

describe('RenderScheduler', () => {
  let grid: InternalGrid;
  let callOrder: string[];
  let scheduler: RenderScheduler;

  beforeEach(() => {
    callOrder = [];
    grid = {
      _schedulerMergeConfig: vi.fn(() => callOrder.push('mergeConfig')),
      _schedulerProcessColumns: vi.fn(() => callOrder.push('processColumns')),
      _schedulerProcessRows: vi.fn(() => callOrder.push('processRows')),
      _schedulerRenderHeader: vi.fn(() => callOrder.push('renderHeader')),
      _schedulerUpdateTemplate: vi.fn(() => callOrder.push('updateTemplate')),
      refreshVirtualWindow: vi.fn(() => {
        callOrder.push('renderVirtualWindow');
        return true;
      }),
      _schedulerAfterRender: vi.fn(() => callOrder.push('afterRender')),
      _schedulerIsConnected: true,
      _hostElement: document.createElement('div'),
    } as unknown as InternalGrid;
    scheduler = new RenderScheduler(grid);
  });

  afterEach(() => {
    scheduler.cancel();
  });

  describe('requestPhase', () => {
    it('should schedule a RAF when requesting a phase', async () => {
      scheduler.requestPhase(RenderPhase.STYLE, 'test');
      expect(scheduler.isPending).toBe(true);
      expect(scheduler.pendingPhase).toBe(RenderPhase.STYLE);

      await scheduler.whenReady();
      expect(scheduler.isPending).toBe(false);
    });

    it('should merge multiple requests to highest phase', async () => {
      scheduler.requestPhase(RenderPhase.STYLE, 'test1');
      scheduler.requestPhase(RenderPhase.ROWS, 'test2');
      scheduler.requestPhase(RenderPhase.HEADER, 'test3');

      expect(scheduler.pendingPhase).toBe(RenderPhase.ROWS);

      await scheduler.whenReady();
      expect(grid._schedulerProcessRows).toHaveBeenCalled();
    });

    it('should not downgrade pending phase', async () => {
      scheduler.requestPhase(RenderPhase.FULL, 'test1');
      scheduler.requestPhase(RenderPhase.STYLE, 'test2');

      expect(scheduler.pendingPhase).toBe(RenderPhase.FULL);
    });
  });

  describe('phase execution order', () => {
    it('should execute STYLE phase (afterRender only)', async () => {
      scheduler.requestPhase(RenderPhase.STYLE, 'test');
      await scheduler.whenReady();

      expect(callOrder).toEqual(['afterRender']);
    });

    it('should execute VIRTUALIZATION phase', async () => {
      scheduler.requestPhase(RenderPhase.VIRTUALIZATION, 'test');
      await scheduler.whenReady();

      expect(callOrder).toEqual(['renderVirtualWindow', 'afterRender']);
    });

    it('should execute HEADER phase', async () => {
      scheduler.requestPhase(RenderPhase.HEADER, 'test');
      await scheduler.whenReady();

      expect(callOrder).toEqual(['renderHeader', 'renderVirtualWindow', 'afterRender']);
    });

    it('should execute ROWS phase', async () => {
      scheduler.requestPhase(RenderPhase.ROWS, 'test');
      await scheduler.whenReady();

      // ROWS phase: processRows → renderHeader → virtualWindow → afterRender
      // (no updateTemplate because that's part of COLUMNS phase)
      expect(callOrder).toEqual(['processRows', 'renderHeader', 'renderVirtualWindow', 'afterRender']);
    });

    it('should execute COLUMNS phase', async () => {
      scheduler.requestPhase(RenderPhase.COLUMNS, 'test');
      await scheduler.whenReady();

      // COLUMNS phase: now includes mergeConfig to pick up framework adapter renderers
      // mergeConfig → processRows → processColumns → ... (order matters for tree plugin)
      expect(callOrder).toEqual([
        'mergeConfig',
        'processRows',
        'processColumns',
        'updateTemplate',
        'renderHeader',
        'renderVirtualWindow',
        'afterRender',
      ]);
    });

    it('should execute FULL phase', async () => {
      scheduler.requestPhase(RenderPhase.FULL, 'test');
      await scheduler.whenReady();

      // FULL phase: mergeConfig → processRows → processColumns → ...
      expect(callOrder).toEqual([
        'mergeConfig',
        'processRows',
        'processColumns',
        'updateTemplate',
        'renderHeader',
        'renderVirtualWindow',
        'afterRender',
      ]);
    });
  });

  describe('whenReady', () => {
    it('should return resolved promise when no render pending', async () => {
      const result = scheduler.whenReady();
      await expect(result).resolves.toBeUndefined();
    });

    it('should return promise that resolves after render', async () => {
      let resolved = false;
      scheduler.requestPhase(RenderPhase.STYLE, 'test');

      scheduler.whenReady().then(() => {
        resolved = true;
      });

      expect(resolved).toBe(false);
      await scheduler.whenReady();
      expect(resolved).toBe(true);
    });

    it('should batch multiple whenReady calls', async () => {
      scheduler.requestPhase(RenderPhase.STYLE, 'test');

      const p1 = scheduler.whenReady();
      const p2 = scheduler.whenReady();

      expect(p1).toBe(p2);
      await Promise.all([p1, p2]);
    });
  });

  describe('initial ready resolver', () => {
    it('should fire initial ready resolver on first render', async () => {
      const initialReady = vi.fn();
      scheduler.setInitialReadyResolver(initialReady);

      scheduler.requestPhase(RenderPhase.STYLE, 'test');
      await scheduler.whenReady();

      expect(initialReady).toHaveBeenCalledTimes(1);
    });

    it('should fire initial ready resolver only once', async () => {
      const initialReady = vi.fn();
      scheduler.setInitialReadyResolver(initialReady);

      scheduler.requestPhase(RenderPhase.STYLE, 'test1');
      await scheduler.whenReady();

      scheduler.requestPhase(RenderPhase.STYLE, 'test2');
      await scheduler.whenReady();

      expect(initialReady).toHaveBeenCalledTimes(1);
    });
  });

  describe('cancel', () => {
    it('should cancel pending render', async () => {
      scheduler.requestPhase(RenderPhase.FULL, 'test');
      expect(scheduler.isPending).toBe(true);

      scheduler.cancel();
      expect(scheduler.isPending).toBe(false);
      expect(scheduler.pendingPhase).toBe(0);

      // Wait a frame to ensure RAF doesn't fire
      await new Promise((r) => requestAnimationFrame(r));
      expect(grid._schedulerMergeConfig).not.toHaveBeenCalled();
    });

    it('should resolve pending ready promise on cancel', async () => {
      scheduler.requestPhase(RenderPhase.STYLE, 'test');
      const ready = scheduler.whenReady();

      scheduler.cancel();

      // Should resolve, not hang
      await expect(ready).resolves.toBeUndefined();
    });
  });

  describe('disconnected handling', () => {
    it('should bail early if component disconnected', async () => {
      (grid as any)._schedulerIsConnected = false;

      scheduler.requestPhase(RenderPhase.FULL, 'test');
      await scheduler.whenReady();

      // No callbacks should be invoked
      expect(grid._schedulerMergeConfig).not.toHaveBeenCalled();
      expect(grid._schedulerAfterRender).not.toHaveBeenCalled();
    });
  });

  describe('batching behavior', () => {
    it('should only schedule one RAF for multiple requests', async () => {
      const rafSpy = vi.spyOn(globalThis, 'requestAnimationFrame');

      scheduler.requestPhase(RenderPhase.STYLE, 'test1');
      scheduler.requestPhase(RenderPhase.ROWS, 'test2');
      scheduler.requestPhase(RenderPhase.HEADER, 'test3');

      // Only one RAF should be scheduled
      expect(rafSpy).toHaveBeenCalledTimes(1);

      await scheduler.whenReady();
      rafSpy.mockRestore();
    });

    it('should execute callbacks only once per batch', async () => {
      scheduler.requestPhase(RenderPhase.STYLE, 'test1');
      scheduler.requestPhase(RenderPhase.STYLE, 'test2');
      scheduler.requestPhase(RenderPhase.STYLE, 'test3');

      await scheduler.whenReady();

      expect(grid._schedulerAfterRender).toHaveBeenCalledTimes(1);
    });
  });

  describe('render event', () => {
    let events: CustomEvent[];
    let host: HTMLElement;
    let evtGrid: InternalGrid;
    let evtScheduler: RenderScheduler;

    beforeEach(() => {
      events = [];
      host = document.createElement('div');
      host.addEventListener('render', (ev) => events.push(ev as CustomEvent));
      // Narrowed mock shape — covers exactly the InternalGrid surface the
      // scheduler touches. Direct `as InternalGrid` cast avoids the
      // forbidden `as unknown as` escape hatch (see typescript-conventions).
      const mock: Pick<
        InternalGrid,
        | '_schedulerMergeConfig'
        | '_schedulerProcessColumns'
        | '_schedulerProcessRows'
        | '_schedulerRenderHeader'
        | '_schedulerUpdateTemplate'
        | 'refreshVirtualWindow'
        | '_schedulerAfterRender'
        | '_schedulerIsConnected'
        | '_rows'
        | '_virtualization'
        | '_hostElement'
      > = {
        _schedulerMergeConfig: vi.fn(),
        _schedulerProcessColumns: vi.fn(),
        _schedulerProcessRows: vi.fn(),
        _schedulerRenderHeader: vi.fn(),
        _schedulerUpdateTemplate: vi.fn(),
        refreshVirtualWindow: vi.fn(() => true),
        _schedulerAfterRender: vi.fn(),
        _schedulerIsConnected: true,
        _rows: [{ id: 1 }, { id: 2 }, { id: 3 }],
        _virtualization: { enabled: true, start: 0, end: 3 } as InternalGrid['_virtualization'],
        _hostElement: host,
      };
      evtGrid = mock as InternalGrid;
      evtScheduler = new RenderScheduler(evtGrid);
    });

    afterEach(() => {
      evtScheduler.cancel();
    });

    it('dispatches a "render" CustomEvent after each flush', async () => {
      evtScheduler.requestPhase(RenderPhase.STYLE, 'test');
      await evtScheduler.whenReady();

      expect(events).toHaveLength(1);
      expect(events[0].type).toBe('render');
      expect(events[0].bubbles).toBe(true);
      expect(events[0].composed).toBe(true);
    });

    it('includes phase, initial, rowCount and visibleRange in the detail', async () => {
      evtScheduler.requestPhase(RenderPhase.ROWS, 'test');
      await evtScheduler.whenReady();

      expect(events[0].detail).toEqual({
        phase: RenderPhase.ROWS,
        initial: true,
        rowCount: 3,
        visibleRange: { start: 0, end: 3 },
      });
    });

    it('marks initial=true only on the first flush', async () => {
      evtScheduler.requestPhase(RenderPhase.STYLE, 'first');
      await evtScheduler.whenReady();
      evtScheduler.requestPhase(RenderPhase.STYLE, 'second');
      await evtScheduler.whenReady();

      expect(events).toHaveLength(2);
      expect(events[0].detail.initial).toBe(true);
      expect(events[1].detail.initial).toBe(false);
    });

    it('reports null visibleRange when virtualization is disabled', async () => {
      evtGrid._virtualization = {
        enabled: false,
        start: 0,
        end: 0,
      } as InternalGrid['_virtualization'];
      evtScheduler.requestPhase(RenderPhase.STYLE, 'test');
      await evtScheduler.whenReady();

      expect(events[0].detail.visibleRange).toBeNull();
    });

    it('reports { start: 0, end: 0 } when virtualization is enabled but empty (NOT null)', async () => {
      evtGrid._virtualization = {
        enabled: true,
        start: 0,
        end: 0,
      } as InternalGrid['_virtualization'];
      evtGrid._rows = [];
      evtScheduler.requestPhase(RenderPhase.STYLE, 'test');
      await evtScheduler.whenReady();

      expect(events[0].detail.visibleRange).toEqual({ start: 0, end: 0 });
    });

    it('does NOT dispatch "render" when the grid is disconnected', async () => {
      (evtGrid as { _schedulerIsConnected: boolean })._schedulerIsConnected = false;
      evtScheduler.requestPhase(RenderPhase.FULL, 'test');
      await evtScheduler.whenReady();

      expect(events).toHaveLength(0);
    });

    it('dispatches "render" AFTER plugin afterRender hooks run', async () => {
      const order: string[] = [];
      (evtGrid._schedulerAfterRender as ReturnType<typeof vi.fn>).mockImplementation(() =>
        order.push('afterRender'),
      );
      host.addEventListener('render', () => order.push('event:render'), { once: true });
      // Drop the recorder added in beforeEach so we don't double-count
      events.length = 0;

      evtScheduler.requestPhase(RenderPhase.STYLE, 'test');
      await evtScheduler.whenReady();

      expect(order).toEqual(['afterRender', 'event:render']);
    });

    it('dispatches "render" AFTER whenReady() resolves', async () => {
      const order: string[] = [];
      host.addEventListener('render', () => order.push('event:render'), { once: true });

      evtScheduler.requestPhase(RenderPhase.STYLE, 'test');
      await evtScheduler.whenReady().then(() => order.push('ready'));

      // ready resolves inside the flush, BEFORE dispatch — but the `.then()`
      // microtask runs after the synchronous flush returns. So the observed
      // order must be: render-event dispatched (sync inside flush), then the
      // ready microtask. The contract: the event fires after ready() has
      // already been resolved internally, so a listener can safely call
      // grid.ready() and not wait extra cycles.
      expect(order).toEqual(['event:render', 'ready']);
    });
  });
});
