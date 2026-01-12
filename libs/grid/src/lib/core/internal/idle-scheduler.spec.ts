import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { cancelIdle, IdleQueue, scheduleIdle } from './idle-scheduler';

describe('idle-scheduler', () => {
  describe('scheduleIdle', () => {
    it('should schedule a callback', async () => {
      const callback = vi.fn();
      scheduleIdle(callback);

      // Wait for callback to be invoked
      await new Promise((r) => setTimeout(r, 100));
      expect(callback).toHaveBeenCalled();
    });

    it('should provide a deadline-like object to callback', async () => {
      let receivedDeadline: { didTimeout: boolean; timeRemaining: () => number } | null = null;

      scheduleIdle((deadline) => {
        receivedDeadline = deadline;
      });

      await new Promise((r) => setTimeout(r, 100));
      expect(receivedDeadline).not.toBeNull();
      expect(typeof receivedDeadline!.didTimeout).toBe('boolean');
      expect(typeof receivedDeadline!.timeRemaining).toBe('function');
    });

    it('should return a handle for cancellation', () => {
      const callback = vi.fn();
      const handle = scheduleIdle(callback);
      // Handle could be number (requestIdleCallback) or object (setTimeout mock) depending on environment
      expect(handle).toBeDefined();
      expect(() => cancelIdle(handle)).not.toThrow();
    });
  });

  describe('cancelIdle', () => {
    it('should cancel a scheduled callback', async () => {
      const callback = vi.fn();
      const handle = scheduleIdle(callback);
      cancelIdle(handle);

      await new Promise((r) => setTimeout(r, 100));
      expect(callback).not.toHaveBeenCalled();
    });
  });

  describe('IdleQueue', () => {
    let queue: IdleQueue;

    beforeEach(() => {
      queue = new IdleQueue();
    });

    afterEach(() => {
      queue.cancel();
    });

    it('should start empty', () => {
      expect(queue.isEmpty).toBe(true);
    });

    it('should add tasks to the queue', () => {
      queue.add(() => {
        /* noop */
      });
      expect(queue.isEmpty).toBe(false);
    });

    it('should execute tasks during idle time', async () => {
      const results: number[] = [];
      queue.add(() => results.push(1));
      queue.add(() => results.push(2));

      await new Promise((r) => setTimeout(r, 200));
      expect(results).toEqual([1, 2]);
    });

    it('should execute tasks in priority order', async () => {
      const results: number[] = [];
      queue.add(() => results.push(3), 30); // low priority
      queue.add(() => results.push(1), 10); // high priority
      queue.add(() => results.push(2), 20); // medium priority

      await new Promise((r) => setTimeout(r, 200));
      expect(results).toEqual([1, 2, 3]);
    });

    it('should use default priority of 10', async () => {
      const results: number[] = [];
      queue.add(() => results.push(1)); // default priority 10
      queue.add(() => results.push(2), 5); // higher priority
      queue.add(() => results.push(3), 15); // lower priority

      await new Promise((r) => setTimeout(r, 200));
      expect(results).toEqual([2, 1, 3]);
    });

    it('should cancel all pending tasks', async () => {
      const results: number[] = [];
      queue.add(() => results.push(1));
      queue.add(() => results.push(2));
      queue.cancel();

      await new Promise((r) => setTimeout(r, 200));
      expect(results).toEqual([]);
      expect(queue.isEmpty).toBe(true);
    });

    it('should handle task errors gracefully', async () => {
      const consoleError = vi.spyOn(console, 'error').mockImplementation(() => {
        /* noop */
      });
      const results: number[] = [];

      queue.add(() => {
        throw new Error('test error');
      });
      queue.add(() => results.push(1));

      await new Promise((r) => setTimeout(r, 200));

      expect(consoleError).toHaveBeenCalled();
      expect(results).toEqual([1]); // Second task should still run
      consoleError.mockRestore();
    });
  });
});
