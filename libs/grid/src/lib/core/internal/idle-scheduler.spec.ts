import { describe, expect, it, vi } from 'vitest';
import { cancelIdle, scheduleIdle } from './idle-scheduler';

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
});
