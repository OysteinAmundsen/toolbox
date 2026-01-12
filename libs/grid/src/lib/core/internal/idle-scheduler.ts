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

/**
 * Queue of deferred tasks to run during idle periods.
 */
interface DeferredTask {
  fn: () => void;
  priority: number; // Lower = higher priority
}

/**
 * Deferred work queue that runs tasks during idle periods.
 * Groups related work and processes in priority order.
 */
export class IdleQueue {
  private tasks: DeferredTask[] = [];
  private scheduled = false;
  private handle: number | null = null;

  /**
   * Add a task to the queue.
   * @param fn - Function to execute
   * @param priority - Priority (lower = run sooner). Default 10.
   */
  add(fn: () => void, priority = 10): void {
    this.tasks.push({ fn, priority });

    if (!this.scheduled) {
      this.scheduled = true;
      this.handle = scheduleIdle((deadline) => this.process(deadline), { timeout: 100 });
    }
  }

  /**
   * Process tasks until we run out of time or tasks.
   */
  private process(deadline: IdleDeadlineLike): void {
    // Sort by priority (stable sort for same priority)
    this.tasks.sort((a, b) => a.priority - b.priority);

    // Process tasks while we have time
    while (this.tasks.length > 0 && (deadline.timeRemaining() > 0 || deadline.didTimeout)) {
      const task = this.tasks.shift();
      if (task) {
        try {
          task.fn();
        } catch (error) {
          console.error('[IdleQueue] Task error:', error);
        }
      }
    }

    // If tasks remain, schedule another idle callback
    if (this.tasks.length > 0) {
      this.handle = scheduleIdle((d) => this.process(d), { timeout: 100 });
    } else {
      this.scheduled = false;
      this.handle = null;
    }
  }

  /**
   * Cancel all pending tasks.
   */
  cancel(): void {
    this.tasks = [];
    if (this.handle !== null) {
      cancelIdle(this.handle);
      this.handle = null;
    }
    this.scheduled = false;
  }

  /**
   * Check if the queue is empty.
   */
  get isEmpty(): boolean {
    return this.tasks.length === 0;
  }
}
