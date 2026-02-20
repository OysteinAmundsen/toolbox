/**
 * Tests for editor wiring helpers.
 *
 * These tests focus on wireEditorCallbacks / subscribeToOutput to verify
 * that commit and cancel fire exactly once even when a component emits
 * both an Angular output AND a DOM CustomEvent (the BaseGridEditor pattern).
 *
 * @vitest-environment jsdom
 */
import { describe, expect, it, vi } from 'vitest';
import { subscribeToOutput, wireEditorCallbacks } from './editor-wiring';

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/**
 * Simulate an Angular output() / EventEmitter — an object with `subscribe()`.
 * Calling `emit()` triggers all subscribers synchronously.
 */
function createMockOutput<T = unknown>() {
  const subscribers: ((value: T) => void)[] = [];
  return {
    subscribe: (fn: (value: T) => void) => subscribers.push(fn),
    emit: (value: T) => subscribers.forEach((fn) => fn(value)),
  };
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('wireEditorCallbacks', () => {
  // -------------------------------------------------------------------------
  // Components WITH Angular outputs (BaseGridEditor pattern)
  // -------------------------------------------------------------------------

  describe('when component has Angular outputs', () => {
    it('should call commit exactly once when output AND DOM event both fire', () => {
      const host = document.createElement('div');
      const commitOutput = createMockOutput<string>();
      const cancelOutput = createMockOutput<void>();
      const instance = { commit: commitOutput, cancel: cancelOutput };

      const commitSpy = vi.fn();
      const cancelSpy = vi.fn();
      wireEditorCallbacks(host, instance, commitSpy, cancelSpy);

      // Simulate BaseGridEditor.commitValue(): emit Angular output then DOM event
      commitOutput.emit('new-value');
      host.dispatchEvent(new CustomEvent('commit', { detail: 'new-value', bubbles: true }));

      expect(commitSpy).toHaveBeenCalledTimes(1);
      expect(commitSpy).toHaveBeenCalledWith('new-value');
    });

    it('should call cancel exactly once when output AND DOM event both fire', () => {
      const host = document.createElement('div');
      const commitOutput = createMockOutput<string>();
      const cancelOutput = createMockOutput<void>();
      const instance = { commit: commitOutput, cancel: cancelOutput };

      const commitSpy = vi.fn();
      const cancelSpy = vi.fn();
      wireEditorCallbacks(host, instance, commitSpy, cancelSpy);

      // Simulate BaseGridEditor.cancelEdit(): emit Angular output then DOM event
      cancelOutput.emit(undefined as never);
      host.dispatchEvent(new CustomEvent('cancel', { bubbles: true }));

      expect(cancelSpy).toHaveBeenCalledTimes(1);
    });

    it('should handle multiple sequential commits without leaking flags', () => {
      const host = document.createElement('div');
      const commitOutput = createMockOutput<number>();
      const cancelOutput = createMockOutput<void>();
      const instance = { commit: commitOutput, cancel: cancelOutput };

      const commitSpy = vi.fn();
      wireEditorCallbacks(host, instance, commitSpy, vi.fn());

      // First commit cycle
      commitOutput.emit(1);
      host.dispatchEvent(new CustomEvent('commit', { detail: 1, bubbles: true }));

      // Second commit cycle
      commitOutput.emit(2);
      host.dispatchEvent(new CustomEvent('commit', { detail: 2, bubbles: true }));

      expect(commitSpy).toHaveBeenCalledTimes(2);
      expect(commitSpy).toHaveBeenNthCalledWith(1, 1);
      expect(commitSpy).toHaveBeenNthCalledWith(2, 2);
    });

    it('should handle multiple sequential cancels without leaking flags', () => {
      const host = document.createElement('div');
      const commitOutput = createMockOutput<string>();
      const cancelOutput = createMockOutput<void>();
      const instance = { commit: commitOutput, cancel: cancelOutput };

      const cancelSpy = vi.fn();
      wireEditorCallbacks(host, instance, vi.fn(), cancelSpy);

      // First cancel cycle
      cancelOutput.emit(undefined as never);
      host.dispatchEvent(new CustomEvent('cancel', { bubbles: true }));

      // Second cancel cycle
      cancelOutput.emit(undefined as never);
      host.dispatchEvent(new CustomEvent('cancel', { bubbles: true }));

      expect(cancelSpy).toHaveBeenCalledTimes(2);
    });

    it('should handle interleaved commit and cancel', () => {
      const host = document.createElement('div');
      const commitOutput = createMockOutput<string>();
      const cancelOutput = createMockOutput<void>();
      const instance = { commit: commitOutput, cancel: cancelOutput };

      const commitSpy = vi.fn();
      const cancelSpy = vi.fn();
      wireEditorCallbacks(host, instance, commitSpy, cancelSpy);

      // Commit then cancel — each with output + DOM pair
      commitOutput.emit('val');
      host.dispatchEvent(new CustomEvent('commit', { detail: 'val', bubbles: true }));
      cancelOutput.emit(undefined as never);
      host.dispatchEvent(new CustomEvent('cancel', { bubbles: true }));

      expect(commitSpy).toHaveBeenCalledTimes(1);
      expect(cancelSpy).toHaveBeenCalledTimes(1);
    });

    it('should stop propagation on DOM commit event', () => {
      const host = document.createElement('div');
      const parent = document.createElement('div');
      parent.appendChild(host);

      const commitOutput = createMockOutput<string>();
      const instance = { commit: commitOutput };

      wireEditorCallbacks(host, instance, vi.fn(), vi.fn());

      const parentSpy = vi.fn();
      parent.addEventListener('commit', parentSpy);

      commitOutput.emit('val');
      host.dispatchEvent(new CustomEvent('commit', { detail: 'val', bubbles: true }));

      expect(parentSpy).not.toHaveBeenCalled();
    });
  });

  // -------------------------------------------------------------------------
  // Components WITHOUT Angular outputs (plain web components / DOM-only)
  // -------------------------------------------------------------------------

  describe('when component has NO Angular outputs', () => {
    it('should fall back to DOM event for commit', () => {
      const host = document.createElement('div');
      const instance = {}; // No commit/cancel outputs

      const commitSpy = vi.fn();
      wireEditorCallbacks(host, instance, commitSpy, vi.fn());

      host.dispatchEvent(new CustomEvent('commit', { detail: 42, bubbles: true }));

      expect(commitSpy).toHaveBeenCalledTimes(1);
      expect(commitSpy).toHaveBeenCalledWith(42);
    });

    it('should fall back to DOM event for cancel', () => {
      const host = document.createElement('div');
      const instance = {};

      const cancelSpy = vi.fn();
      wireEditorCallbacks(host, instance, vi.fn(), cancelSpy);

      host.dispatchEvent(new CustomEvent('cancel', { bubbles: true }));

      expect(cancelSpy).toHaveBeenCalledTimes(1);
    });

    it('should handle multiple DOM-only commits', () => {
      const host = document.createElement('div');
      const instance = {};

      const commitSpy = vi.fn();
      wireEditorCallbacks(host, instance, commitSpy, vi.fn());

      host.dispatchEvent(new CustomEvent('commit', { detail: 'a', bubbles: true }));
      host.dispatchEvent(new CustomEvent('commit', { detail: 'b', bubbles: true }));

      expect(commitSpy).toHaveBeenCalledTimes(2);
      expect(commitSpy).toHaveBeenNthCalledWith(1, 'a');
      expect(commitSpy).toHaveBeenNthCalledWith(2, 'b');
    });
  });

  // -------------------------------------------------------------------------
  // Mixed: component has only one of the two outputs
  // -------------------------------------------------------------------------

  describe('when component has only commit output (no cancel output)', () => {
    it('should use Angular output for commit and DOM event for cancel', () => {
      const host = document.createElement('div');
      const commitOutput = createMockOutput<string>();
      const instance = { commit: commitOutput }; // No cancel output

      const commitSpy = vi.fn();
      const cancelSpy = vi.fn();
      wireEditorCallbacks(host, instance, commitSpy, cancelSpy);

      // commit fires both — should still be once
      commitOutput.emit('val');
      host.dispatchEvent(new CustomEvent('commit', { detail: 'val', bubbles: true }));

      // cancel fires DOM only — should fire once
      host.dispatchEvent(new CustomEvent('cancel', { bubbles: true }));

      expect(commitSpy).toHaveBeenCalledTimes(1);
      expect(cancelSpy).toHaveBeenCalledTimes(1);
    });
  });
});

describe('subscribeToOutput', () => {
  it('should subscribe to Observable-like outputs and return true', () => {
    const output = createMockOutput<number>();
    const instance = { myOutput: output };
    const callback = vi.fn();

    const result = subscribeToOutput(instance, 'myOutput', callback);

    expect(result).toBe(true);
    output.emit(42);
    expect(callback).toHaveBeenCalledWith(42);
  });

  it('should return false when output does not exist', () => {
    const instance = {};
    const callback = vi.fn();

    const result = subscribeToOutput(instance, 'nonExistent', callback);

    expect(result).toBe(false);
    expect(callback).not.toHaveBeenCalled();
  });

  it('should return false for non-subscribable properties', () => {
    const instance = { notAnOutput: 'just a string' };
    const callback = vi.fn();

    const result = subscribeToOutput(instance, 'notAnOutput', callback);

    expect(result).toBe(false);
    expect(callback).not.toHaveBeenCalled();
  });
});
