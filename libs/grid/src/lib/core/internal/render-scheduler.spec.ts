import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { RenderPhase, RenderScheduler, type RenderCallbacks } from './render-scheduler';

describe('RenderScheduler', () => {
  let callbacks: RenderCallbacks;
  let callOrder: string[];
  let scheduler: RenderScheduler;

  beforeEach(() => {
    callOrder = [];
    callbacks = {
      mergeConfig: vi.fn(() => callOrder.push('mergeConfig')),
      processColumns: vi.fn(() => callOrder.push('processColumns')),
      processRows: vi.fn(() => callOrder.push('processRows')),
      renderHeader: vi.fn(() => callOrder.push('renderHeader')),
      updateTemplate: vi.fn(() => callOrder.push('updateTemplate')),
      renderVirtualWindow: vi.fn(() => callOrder.push('renderVirtualWindow')),
      afterRender: vi.fn(() => callOrder.push('afterRender')),
      isConnected: vi.fn(() => true),
    };
    scheduler = new RenderScheduler(callbacks);
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
      expect(callbacks.processRows).toHaveBeenCalled();
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
      expect(callbacks.mergeConfig).not.toHaveBeenCalled();
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
      (callbacks.isConnected as ReturnType<typeof vi.fn>).mockReturnValue(false);

      scheduler.requestPhase(RenderPhase.FULL, 'test');
      await scheduler.whenReady();

      // No callbacks should be invoked
      expect(callbacks.mergeConfig).not.toHaveBeenCalled();
      expect(callbacks.afterRender).not.toHaveBeenCalled();
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

      expect(callbacks.afterRender).toHaveBeenCalledTimes(1);
    });
  });
});
