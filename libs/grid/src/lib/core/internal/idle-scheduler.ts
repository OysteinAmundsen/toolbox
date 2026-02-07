/**
 * Idle Scheduler - Defer non-critical work to browser idle periods.
 *
 * Uses requestIdleCallback where available, with fallback to setTimeout.
 * This allows the main thread to remain responsive during startup.
 */

/**
 * Check if requestIdleCallback is available (not in Safari < 17.4).
 */
const hasIdleCallback = typeof requestIdleCallback === 'function';

/**
 * IdleDeadline-compatible interface for fallback.
 */
interface IdleDeadlineLike {
  didTimeout: boolean;
  timeRemaining(): number;
}

/**
 * Schedule work to run during browser idle time.
 * Falls back to setTimeout(0) if requestIdleCallback is not available.
 *
 * @param callback - Work to run when idle
 * @param options - Optional timeout configuration
 * @returns Handle for cancellation
 */
export function scheduleIdle(callback: (deadline: IdleDeadlineLike) => void, options?: { timeout?: number }): number {
  if (hasIdleCallback) {
    return requestIdleCallback(callback, options);
  }

  // Fallback for Safari (before 17.4) and older browsers
  return window.setTimeout(() => {
    const start = Date.now();
    callback({
      didTimeout: false,
      timeRemaining: () => Math.max(0, 50 - (Date.now() - start)),
    });
  }, 1) as unknown as number;
}

/**
 * Cancel a scheduled idle callback.
 */
export function cancelIdle(handle: number): void {
  if (hasIdleCallback) {
    cancelIdleCallback(handle);
  } else {
    clearTimeout(handle);
  }
}
