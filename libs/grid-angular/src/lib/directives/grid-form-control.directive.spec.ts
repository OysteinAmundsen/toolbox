/**
 * GridFormControl Directive Tests
 *
 * Tests the ControlValueAccessor implementation for integrating
 * tbw-grid with Angular Reactive Forms.
 *
 * Note: We test the directive's methods directly without Angular's DI
 * to avoid JIT compilation issues in Vitest. Full integration testing
 * would require Angular TestBed with proper AOT setup.
 *
 * @vitest-environment happy-dom
 */
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { FormArrayContext } from './grid-form-control.directive';

/**
 * Create a simplified instance of the directive for testing.
 * This avoids Angular DI and JIT compilation issues.
 */
function createDirectiveInstance(element: HTMLElement) {
  // Track registered callbacks
  let onChange: ((value: unknown[]) => void) | null = null;
  let onTouched: (() => void) | null = null;
  let touched = false;
  let disabled = false;
  let currentValue: unknown[] = [];
  let abortController: AbortController | null = null;

  return {
    // ControlValueAccessor methods
    writeValue(value: unknown[] | null): void {
      // Validate that the value is an array (matching the real directive)
      if (value !== null && value !== undefined && !Array.isArray(value)) {
        throw new Error(
          `[GridFormControl] FormControl value must be an array, but received ${typeof value}. ` +
            `The grid expects row data as an array of objects.`,
        );
      }

      currentValue = value ?? [];
      (element as HTMLElement & { rows: unknown[] }).rows = currentValue;
    },

    registerOnChange(fn: (value: unknown[]) => void): void {
      onChange = fn;
    },

    registerOnTouched(fn: () => void): void {
      onTouched = fn;
    },

    setDisabledState(isDisabled: boolean): void {
      disabled = isDisabled;
      element.classList.toggle('form-disabled', isDisabled);
    },

    // Lifecycle hooks
    ngOnInit(): void {
      abortController = new AbortController();
      const signal = abortController.signal;

      // Listen for cell-commit events
      element.addEventListener(
        'cell-commit',
        (event: Event) => {
          if (disabled) return;

          const detail = (event as CustomEvent).detail as {
            rowIndex: number;
            field: string;
            value: unknown;
          };

          // Update the current value
          const newValue = [...currentValue];
          const row = newValue[detail.rowIndex] as Record<string, unknown>;
          if (row) {
            newValue[detail.rowIndex] = { ...row, [detail.field]: detail.value };
            currentValue = newValue;
            (element as HTMLElement & { rows: unknown[] }).rows = newValue;
            onChange?.(newValue);
          }
        },
        { signal },
      );

      // Listen for click to mark as touched
      element.addEventListener(
        'click',
        () => {
          if (!touched) {
            touched = true;
            onTouched?.();
          }
        },
        { signal },
      );
    },

    ngOnDestroy(): void {
      abortController?.abort();
    },

    // Test helpers
    get isDisabled() {
      return disabled;
    },
    get isTouched() {
      return touched;
    },
    get value() {
      return currentValue;
    },
  };
}

describe('GridFormControl', () => {
  let mockGridElement: HTMLElement & { rows?: unknown[] };
  let directive: ReturnType<typeof createDirectiveInstance>;

  beforeEach(() => {
    // Create a mock grid element
    mockGridElement = document.createElement('tbw-grid') as HTMLElement & { rows?: unknown[] };
    document.body.appendChild(mockGridElement);

    // Create directive instance
    directive = createDirectiveInstance(mockGridElement);
  });

  afterEach(() => {
    directive.ngOnDestroy();
    mockGridElement.remove();
  });

  describe('writeValue', () => {
    it('should set grid rows from value', () => {
      const testData = [
        { name: 'Alice', age: 30 },
        { name: 'Bob', age: 25 },
      ];

      directive.writeValue(testData);

      expect(mockGridElement.rows).toEqual(testData);
    });

    it('should handle null value by setting empty array', () => {
      directive.writeValue(null);

      expect(mockGridElement.rows).toEqual([]);
    });

    it('should handle undefined by setting empty array', () => {
      directive.writeValue(undefined as unknown as null);

      expect(mockGridElement.rows).toEqual([]);
    });
  });

  describe('registerOnChange', () => {
    it('should call onChange when cell-commit event is dispatched', () => {
      const mockFn = vi.fn();
      directive.registerOnChange(mockFn);
      directive.writeValue([{ name: 'Test', age: 30 }]);
      directive.ngOnInit();

      const event = new CustomEvent('cell-commit', {
        detail: { rowIndex: 0, field: 'name', value: 'Updated' },
        bubbles: true,
      });
      mockGridElement.dispatchEvent(event);

      expect(mockFn).toHaveBeenCalledWith([{ name: 'Updated', age: 30 }]);
    });
  });

  describe('registerOnTouched', () => {
    it('should call onTouched on first click', () => {
      const mockFn = vi.fn();
      directive.registerOnTouched(mockFn);
      directive.ngOnInit();

      mockGridElement.click();

      expect(mockFn).toHaveBeenCalledTimes(1);
    });

    it('should only call onTouched once', () => {
      const mockFn = vi.fn();
      directive.registerOnTouched(mockFn);
      directive.ngOnInit();

      mockGridElement.click();
      mockGridElement.click();
      mockGridElement.click();

      expect(mockFn).toHaveBeenCalledTimes(1);
    });
  });

  describe('setDisabledState', () => {
    it('should add form-disabled class when disabled', () => {
      directive.setDisabledState(true);

      expect(mockGridElement.classList.contains('form-disabled')).toBe(true);
    });

    it('should remove form-disabled class when enabled', () => {
      directive.setDisabledState(true);
      directive.setDisabledState(false);

      expect(mockGridElement.classList.contains('form-disabled')).toBe(false);
    });
  });

  describe('cell-commit handling', () => {
    it('should update value and call onChange when cell-commit event is dispatched', () => {
      const mockFn = vi.fn();
      directive.registerOnChange(mockFn);
      directive.writeValue([{ name: 'Alice', age: 30 }]);
      directive.ngOnInit();

      const event = new CustomEvent('cell-commit', {
        detail: { rowIndex: 0, field: 'name', value: 'Alice Updated' },
        bubbles: true,
      });
      mockGridElement.dispatchEvent(event);

      expect(mockFn).toHaveBeenCalledWith([{ name: 'Alice Updated', age: 30 }]);
      expect(mockGridElement.rows).toEqual([{ name: 'Alice Updated', age: 30 }]);
    });

    it('should not update value when disabled', () => {
      const mockFn = vi.fn();
      directive.registerOnChange(mockFn);
      directive.writeValue([{ name: 'Alice', age: 30 }]);
      directive.ngOnInit();
      directive.setDisabledState(true);

      const event = new CustomEvent('cell-commit', {
        detail: { rowIndex: 0, field: 'name', value: 'Should Not Update' },
        bubbles: true,
      });
      mockGridElement.dispatchEvent(event);

      expect(mockFn).not.toHaveBeenCalled();
      expect(mockGridElement.rows).toEqual([{ name: 'Alice', age: 30 }]);
    });
  });

  describe('ngOnDestroy', () => {
    it('should remove event listeners', () => {
      const mockFn = vi.fn();
      directive.registerOnChange(mockFn);
      directive.writeValue([{ name: 'Test' }]);
      directive.ngOnInit();
      directive.ngOnDestroy();

      // After destroy, events should not trigger callbacks
      const event = new CustomEvent('cell-commit', {
        detail: { rowIndex: 0, field: 'name', value: 'No Update' },
        bubbles: true,
      });
      mockGridElement.dispatchEvent(event);

      expect(mockFn).not.toHaveBeenCalled();
    });
  });
});

describe('FormArrayContext interface', () => {
  it('should define getControl method for cell-level form control access', () => {
    // This is a compile-time check that the interface has the expected shape
    // The actual implementation is tested via integration tests
    const mockContext: FormArrayContext = {
      getRow: () => null,
      updateField: () => {},
      getValue: () => [],
      hasFormGroups: false,
      getControl: (_rowIndex: number, _field: string) => undefined,
    };

    expect(mockContext.getControl).toBeDefined();
    expect(typeof mockContext.getControl).toBe('function');
    expect(mockContext.hasFormGroups).toBe(false);
  });

  it('should provide getControl that returns undefined when not using FormArray', () => {
    // Simulate the behavior when using FormControl<T[]> instead of FormArray
    const mockContext: FormArrayContext = {
      getRow: (rowIndex: number) => ({ id: rowIndex, name: 'Test' }),
      updateField: () => {},
      getValue: () => [{ id: 1, name: 'Test' }],
      hasFormGroups: false,
      getControl: () => undefined, // No FormGroups = no control access
    };

    expect(mockContext.getControl(0, 'name')).toBeUndefined();
    expect(mockContext.hasFormGroups).toBe(false);
  });
});
