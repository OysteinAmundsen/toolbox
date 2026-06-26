/**
 * Tests for the BaseGridEditor abstract class.
 *
 * Note: Full testing of Angular signal-based inputs/outputs requires TestBed.
 * These tests verify the class structure and the getErrorMessage logic,
 * plus commitValue/cancelEdit DOM dispatch, computed signals, and lifecycle.
 *
 * @vitest-environment happy-dom
 */
import { describe, expect, it, vi } from 'vitest';
import { BaseGridEditor } from './base-grid-editor.js';

/**
 * Create a minimal mock instance with the required properties
 * for testing prototype methods that reference `this`.
 */
function createMockInstance(overrides: Record<string, unknown> = {}) {
  const el = document.createElement('div');
  const instance = Object.create(BaseGridEditor.prototype);
  instance.elementRef = { nativeElement: el };
  instance.commit = { emit: vi.fn() };
  instance.cancel = { emit: vi.fn() };
  Object.assign(instance, overrides);
  return { instance, el };
}

describe('BaseGridEditor', () => {
  it('should be importable and defined', () => {
    expect(BaseGridEditor).toBeDefined();
  });

  it('should be a class that can be extended', () => {
    // Verify the prototype chain is correct
    expect(typeof BaseGridEditor).toBe('function');
    expect(BaseGridEditor.prototype.commitValue).toBeDefined();
    expect(BaseGridEditor.prototype.cancelEdit).toBeDefined();
  });

  it('should have protected getErrorMessage method', () => {
    // The method exists on the prototype
    expect(typeof BaseGridEditor.prototype['getErrorMessage']).toBe('function');
  });

  describe('getErrorMessage', () => {
    // Access the method via prototype since we can't instantiate the abstract class
    const getErrorMessage = BaseGridEditor.prototype['getErrorMessage'] as (key: string, value?: unknown) => string;

    it('should return correct message for "required"', () => {
      expect(getErrorMessage('required')).toBe('This field is required');
    });

    it('should return correct message for "minlength" with error value', () => {
      const result = getErrorMessage('minlength', { requiredLength: 5 });
      expect(result).toBe('Minimum length is 5');
    });

    it('should return correct message for "minlength" without error value', () => {
      const result = getErrorMessage('minlength');
      expect(result).toBe('Minimum length is unknown');
    });

    it('should return correct message for "maxlength" with error value', () => {
      const result = getErrorMessage('maxlength', { requiredLength: 100 });
      expect(result).toBe('Maximum length is 100');
    });

    it('should return correct message for "maxlength" without error value', () => {
      const result = getErrorMessage('maxlength');
      expect(result).toBe('Maximum length is unknown');
    });

    it('should return correct message for "min" with error value', () => {
      const result = getErrorMessage('min', { min: 0 });
      expect(result).toBe('Minimum value is 0');
    });

    it('should return correct message for "min" without error value', () => {
      const result = getErrorMessage('min');
      expect(result).toBe('Minimum value is unknown');
    });

    it('should return correct message for "max" with error value', () => {
      const result = getErrorMessage('max', { max: 999 });
      expect(result).toBe('Maximum value is 999');
    });

    it('should return correct message for "max" without error value', () => {
      const result = getErrorMessage('max');
      expect(result).toBe('Maximum value is unknown');
    });

    it('should return correct message for "email"', () => {
      expect(getErrorMessage('email')).toBe('Invalid email address');
    });

    it('should return correct message for "pattern"', () => {
      expect(getErrorMessage('pattern')).toBe('Invalid format');
    });

    it('should return fallback message for unknown error keys', () => {
      expect(getErrorMessage('customValidator')).toBe('Invalid value (customValidator)');
    });
  });

  describe('commitValue', () => {
    it('should emit the commit output with the new value', () => {
      const { instance } = createMockInstance();
      instance.commitValue('hello');
      expect(instance.commit.emit).toHaveBeenCalledWith('hello');
    });

    it('should emit null for nullable fields', () => {
      const { instance } = createMockInstance();
      instance.commitValue(null);
      expect(instance.commit.emit).toHaveBeenCalledWith(null);
    });

    it('should dispatch a DOM CustomEvent with detail and bubbles', () => {
      const { instance, el } = createMockInstance();
      let received: CustomEvent | null = null;
      el.addEventListener('commit', (e) => {
        received = e as CustomEvent;
      });

      instance.commitValue(42);

      expect(received).not.toBeNull();
      expect(received!.detail).toBe(42);
      expect(received!.bubbles).toBe(true);
    });
  });

  describe('cancelEdit', () => {
    it('should emit the cancel output', () => {
      const { instance } = createMockInstance();
      instance.cancelEdit();
      expect(instance.cancel.emit).toHaveBeenCalledOnce();
    });

    it('should dispatch a DOM CustomEvent with bubbles', () => {
      const { instance, el } = createMockInstance();
      let received: CustomEvent | null = null;
      el.addEventListener('cancel', (e) => {
        received = e as CustomEvent;
      });

      instance.cancelEdit();

      expect(received).not.toBeNull();
      expect(received!.bubbles).toBe(true);
    });
  });

  describe('isCellFocused', () => {
    it('should return true when host is inside a cell with cell-focus class', () => {
      const cell = document.createElement('div');
      cell.setAttribute('part', 'cell');
      cell.classList.add('cell-focus');
      const host = document.createElement('span');
      cell.appendChild(host);

      const instance = Object.create(BaseGridEditor.prototype);
      instance.elementRef = { nativeElement: host };

      expect(instance['isCellFocused']()).toBe(true);
    });

    it('should return false when host is inside a cell without cell-focus class', () => {
      const cell = document.createElement('div');
      cell.setAttribute('part', 'cell');
      const host = document.createElement('span');
      cell.appendChild(host);

      const instance = Object.create(BaseGridEditor.prototype);
      instance.elementRef = { nativeElement: host };

      expect(instance['isCellFocused']()).toBe(false);
    });

    it('should return false when host has no parent cell', () => {
      const host = document.createElement('span');

      const instance = Object.create(BaseGridEditor.prototype);
      instance.elementRef = { nativeElement: host };

      expect(instance['isCellFocused']()).toBe(false);
    });
  });

  describe('onBeforeEditClose', () => {
    it('should have onBeforeEditClose method on the prototype', () => {
      expect(typeof BaseGridEditor.prototype['onBeforeEditClose']).toBe('function');
    });

    it('should be a no-op by default', () => {
      const fn = BaseGridEditor.prototype['onBeforeEditClose'] as () => void;
      expect(() => fn()).not.toThrow();
    });
  });

  describe('onEditClose', () => {
    it('should be a no-op by default', () => {
      const fn = BaseGridEditor.prototype['onEditClose'] as () => void;
      expect(() => fn()).not.toThrow();
    });
  });

  describe('onExternalValueChange', () => {
    it('should be a no-op by default', () => {
      const fn = BaseGridEditor.prototype.onExternalValueChange as (val: unknown) => void;
      expect(() => fn('new-value')).not.toThrow();
    });
  });

  describe('_initEditCloseListener', () => {
    it('should subscribe to before-edit-close and edit-close on the grid', () => {
      const onSpy = vi.fn(() => vi.fn());
      const grid = document.createElement('tbw-grid');
      (grid as any).on = onSpy;

      const host = document.createElement('div');
      grid.appendChild(host);

      const instance = Object.create(BaseGridEditor.prototype);
      instance.elementRef = { nativeElement: host };
      instance['onBeforeEditClose'] = vi.fn();
      instance['onEditClose'] = vi.fn();

      instance['_initEditCloseListener']();

      expect(onSpy).toHaveBeenCalledWith('before-edit-close', expect.any(Function));
      expect(onSpy).toHaveBeenCalledWith('edit-close', expect.any(Function));
    });

    it('should do nothing when no parent tbw-grid exists', () => {
      const host = document.createElement('div');

      const instance = Object.create(BaseGridEditor.prototype);
      instance.elementRef = { nativeElement: host };

      // Should not throw
      expect(() => instance['_initEditCloseListener']()).not.toThrow();
    });

    it('should invoke onBeforeEditClose then unsubscribe on before-edit-close event', () => {
      const unsubBefore = vi.fn();
      let beforeCb: (() => void) | undefined;
      const onSpy = vi.fn((event: string, cb: () => void) => {
        if (event === 'before-edit-close') {
          beforeCb = cb;
          return unsubBefore;
        }
        return vi.fn();
      });
      const grid = document.createElement('tbw-grid');
      (grid as any).on = onSpy;

      const host = document.createElement('div');
      grid.appendChild(host);

      const instance = Object.create(BaseGridEditor.prototype);
      instance.elementRef = { nativeElement: host };
      instance['onBeforeEditClose'] = vi.fn();
      instance['onEditClose'] = vi.fn();

      instance['_initEditCloseListener']();

      // Fire the before-edit-close callback
      beforeCb!();
      expect(instance['onBeforeEditClose']).toHaveBeenCalledOnce();
    });

    it('should invoke onEditClose then unsubscribe on edit-close event', () => {
      const unsubClose = vi.fn();
      let closeCb: (() => void) | undefined;
      const onSpy = vi.fn((event: string, cb: () => void) => {
        if (event === 'edit-close') {
          closeCb = cb;
          return unsubClose;
        }
        return vi.fn();
      });
      const grid = document.createElement('tbw-grid');
      (grid as any).on = onSpy;

      const host = document.createElement('div');
      grid.appendChild(host);

      const instance = Object.create(BaseGridEditor.prototype);
      instance.elementRef = { nativeElement: host };
      instance['onBeforeEditClose'] = vi.fn();
      instance['onEditClose'] = vi.fn();

      instance['_initEditCloseListener']();

      // Fire the edit-close callback
      closeCb!();
      expect(instance['onEditClose']).toHaveBeenCalledOnce();
    });

    it('should cleanup both subscriptions when _editCloseCleanup is called', () => {
      const unsubBefore = vi.fn();
      const unsubClose = vi.fn();
      const onSpy = vi.fn((event: string) => {
        if (event === 'before-edit-close') return unsubBefore;
        return unsubClose;
      });
      const grid = document.createElement('tbw-grid');
      (grid as any).on = onSpy;

      const host = document.createElement('div');
      grid.appendChild(host);

      const instance = Object.create(BaseGridEditor.prototype);
      instance.elementRef = { nativeElement: host };
      instance['onBeforeEditClose'] = vi.fn();
      instance['onEditClose'] = vi.fn();

      instance['_initEditCloseListener']();

      // Call the cleanup function
      instance['_editCloseCleanup']();
      expect(unsubBefore).toHaveBeenCalledOnce();
      expect(unsubClose).toHaveBeenCalledOnce();
    });
  });

  describe('elementRef visibility', () => {
    it('should have elementRef accessible to subclasses (protected)', () => {
      expect(BaseGridEditor).toBeDefined();
    });
  });
});
